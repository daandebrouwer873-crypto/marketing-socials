-- Plaatsen op Instagram en Facebook vanuit de app. Volgorde: na 001 en 002.
-- De serverfunctie marketing-plaatsen (supabase/functions) roept Meta aan met het paginatoken en
-- werkt met de inlog van de eigenaar. Wat mag, regelt de database: alleen de eigenaar, alleen
-- een goedgekeurde tekst, alleen de status Klaar of Ingepland, en nooit twee keer tegelijk.

-- ---------------------------------------------------------------------------
-- Wat er online gaat en wat Meta teruggaf
-- ---------------------------------------------------------------------------

alter table public.marketing_posts
  add column if not exists media jsonb not null default '[]'::jsonb
    check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  add column if not exists ig_media_id text,
  add column if not exists ig_link text,
  add column if not exists fb_post_id text,
  add column if not exists geplaatst_op timestamptz,
  add column if not exists geplaatst_door text,
  add column if not exists plaatsen_stand jsonb,
  add column if not exists plaatsen_bezig_sinds timestamptz,
  add column if not exists plaatsen_fout text;

comment on column public.marketing_posts.media is
  'De definitieve foto''s of video in volgorde: [{pad, soort, mime, grootte, breedte, hoogte, duur}] in de opslag marketing-plaatsen.';
comment on column public.marketing_posts.plaatsen_stand is
  'Hoe ver het plaatsen bij Meta is (containers en video-id''s), zodat opnieuw drukken verdergaat waar het was.';

-- Wat Meta teruggaf, zet alleen de knop Plaatsen (via de functies hieronder), niet de app zelf.
create or replace function public.marketing_posts_plaatsen_bescherming()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('marketing.plaatsen', true) is distinct from 'aan' and (
       (tg_op = 'INSERT' and (new.ig_media_id, new.ig_link, new.fb_post_id, new.geplaatst_op, new.geplaatst_door,
                              new.plaatsen_stand, new.plaatsen_bezig_sinds, new.plaatsen_fout) is distinct from
                             (null::text, null::text, null::text, null::timestamptz, null::text, null::jsonb, null::timestamptz, null::text))
    or (tg_op = 'UPDATE' and (new.ig_media_id, new.ig_link, new.fb_post_id, new.geplaatst_op, new.geplaatst_door,
                              new.plaatsen_stand, new.plaatsen_bezig_sinds, new.plaatsen_fout) is distinct from
                             (old.ig_media_id, old.ig_link, old.fb_post_id, old.geplaatst_op, old.geplaatst_door,
                              old.plaatsen_stand, old.plaatsen_bezig_sinds, old.plaatsen_fout))
  ) then
    raise exception 'Dit zet alleen de knop Plaatsen.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_posts_plaatsen_bescherming on public.marketing_posts;
create trigger marketing_posts_plaatsen_bescherming
  before insert or update on public.marketing_posts
  for each row execute function public.marketing_posts_plaatsen_bescherming();

-- ---------------------------------------------------------------------------
-- De knop Plaatsen: eerst de post pakken, daarna per stap bewaren
-- ---------------------------------------------------------------------------

-- Pakt een post om te plaatsen. Weigert als de regels het niet toestaan of als er net al een
-- aanroep mee bezig is. Die houdt de post hooguit drie minuten vast; een serverfunctie duurt
-- nooit langer, dus een vastgelopen poging blokkeert niet voor altijd.
create or replace function public.marketing_plaatsen_pak(p_post uuid, p_kanalen text[])
returns public.marketing_posts
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.marketing_posts;
begin
  if public.marketing_mijn_rol() is distinct from 'eigenaar' then
    raise exception 'Alleen de eigenaar plaatst posts.' using errcode = 'P0001';
  end if;
  if p_kanalen is null or cardinality(p_kanalen) = 0
     or not (p_kanalen <@ array['instagram', 'facebook']::text[]) then
    raise exception 'Kies Instagram, Facebook of allebei.' using errcode = 'P0001';
  end if;

  select * into r from public.marketing_posts where id = p_post for update;
  if not found then
    raise exception 'Deze post bestaat niet meer.' using errcode = 'P0001';
  end if;
  if r.status = 'geplaatst' then
    raise exception 'Deze post staat al online.' using errcode = 'P0001';
  end if;
  if not r.tekst_goedgekeurd then
    raise exception 'De tekst is nog niet goedgekeurd.' using errcode = 'P0001';
  end if;
  if r.status not in ('tekst_klaar', 'ingepland') then
    raise exception 'Alleen een post met de status Klaar of Ingepland kan online.' using errcode = 'P0001';
  end if;
  if r.kanaal not in ('foto', 'carrousel', 'reel', 'story', 'facebook') then
    raise exception 'Dit kanaal plaatst de app niet zelf.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(r.media) = 0 then
    raise exception 'Zet eerst de foto''s of de video klaar bij Wat gaat er online.' using errcode = 'P0001';
  end if;
  if r.plaatsen_bezig_sinds > now() - interval '3 minutes' then
    raise exception 'Deze post wordt op dit moment al geplaatst. Even geduld.' using errcode = 'P0001';
  end if;

  perform set_config('marketing.plaatsen', 'aan', true);
  update public.marketing_posts
     set plaatsen_bezig_sinds = now(),
         plaatsen_fout = null,
         plaatsen_stand = coalesce(plaatsen_stand, '{}'::jsonb) || jsonb_build_object('kanalen', to_jsonb(p_kanalen))
   where id = p_post
  returning * into r;
  perform set_config('marketing.plaatsen', '', true);
  return r;
end;
$$;

-- Bewaart wat Meta teruggaf. Een id dat er al staat, wordt nooit overschreven, zodat een post
-- die op Instagram al online staat bij opnieuw proberen niet nog een keer geplaatst wordt.
create or replace function public.marketing_plaatsen_bewaar(
  p_post uuid,
  p_stand jsonb default null,
  p_ig_media_id text default null,
  p_ig_link text default null,
  p_fb_post_id text default null,
  p_fout text default null,
  p_klaar boolean default false,
  p_loslaten boolean default false
)
returns public.marketing_posts
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.marketing_posts;
begin
  if public.marketing_mijn_rol() is distinct from 'eigenaar' then
    raise exception 'Alleen de eigenaar plaatst posts.' using errcode = 'P0001';
  end if;

  select * into r from public.marketing_posts where id = p_post for update;
  if not found then
    raise exception 'Deze post bestaat niet meer.' using errcode = 'P0001';
  end if;
  if r.plaatsen_bezig_sinds is null then
    raise exception 'Deze post is niet aan het plaatsen. Druk opnieuw op Plaatsen.' using errcode = 'P0001';
  end if;

  perform set_config('marketing.plaatsen', 'aan', true);
  update public.marketing_posts
     set plaatsen_stand = coalesce(p_stand, plaatsen_stand),
         ig_media_id = coalesce(ig_media_id, nullif(btrim(p_ig_media_id), '')),
         ig_link = coalesce(ig_link, nullif(btrim(p_ig_link), '')),
         fb_post_id = coalesce(fb_post_id, nullif(btrim(p_fb_post_id), '')),
         plaatsen_fout = left(nullif(btrim(p_fout), ''), 600),
         status = case when p_klaar then 'geplaatst' else status end,
         geplaatst_op = case when p_klaar then now() else geplaatst_op end,
         geplaatst_door = case when p_klaar then public.marketing_mijn_email() else geplaatst_door end,
         plaatsen_bezig_sinds = case when p_klaar or p_loslaten then null else now() end
   where id = p_post
  returning * into r;
  perform set_config('marketing.plaatsen', '', true);
  return r;
end;
$$;

revoke execute on function public.marketing_plaatsen_pak(uuid, text[]) from public, anon;
revoke execute on function public.marketing_plaatsen_bewaar(uuid, jsonb, text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.marketing_plaatsen_pak(uuid, text[]) to authenticated;
grant execute on function public.marketing_plaatsen_bewaar(uuid, jsonb, text, text, text, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Opslag voor wat er online gaat. Privé: Meta krijgt per bestand een link die een uur werkt.
-- Geen eigen maximale grootte: dan geldt die van het project (gratis plan 50 MB).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-plaatsen', 'marketing-plaatsen', false, null,
        array['image/jpeg', 'video/mp4', 'video/quicktime'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "marketing plaatsen lezen" on storage.objects;
create policy "marketing plaatsen lezen" on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing-plaatsen' and public.marketing_is_teamlid());

drop policy if exists "marketing plaatsen opslaan" on storage.objects;
create policy "marketing plaatsen opslaan" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marketing-plaatsen' and public.marketing_is_teamlid());

drop policy if exists "marketing plaatsen verwijderen" on storage.objects;
create policy "marketing plaatsen verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketing-plaatsen' and public.marketing_is_teamlid());
