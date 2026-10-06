-- Marketing-app Pellens: tabellen, regels en rijbeveiliging.
-- Draait in hetzelfde Supabase-project als de team-app, zodat iedereen met zijn
-- bestaande Pellens-account inlogt. Alles heeft het voorvoegsel marketing_ en
-- raakt geen bestaande tabellen. Volgorde: 001, 002, daarna seed.sql.

do $$
begin
  if to_regclass('public.app_memberships') is null then
    raise exception 'app_memberships ontbreekt: dit is niet het Supabase-project van de team-app.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Team en identiteit
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_teamleden (
  email      text primary key check (email = lower(email)),
  naam       text not null check (char_length(naam) between 1 and 40),
  rol        text not null check (rol in ('eigenaar', 'social', 'manager')),
  actief     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.marketing_teamleden is
  'Wie de marketing-app mag gebruiken, met welke rol. Beheer in de SQL-editor; de app zelf kan hem niet wijzigen.';

create or replace function public.marketing_mijn_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(coalesce(nullif(auth.jwt() ->> 'email', ''), ''))
$$;

create or replace function public.marketing_is_teamlid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Alleen met een actief Pellens-account dat zijn eigen wachtwoord al koos.
  select exists (
    select 1
    from public.marketing_teamleden t
    join public.app_memberships m on m.user_id = auth.uid()
    where t.email = public.marketing_mijn_email()
      and t.actief and m.active and not m.must_change_password
  )
$$;

create or replace function public.marketing_mijn_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.rol
  from public.marketing_teamleden t
  join public.app_memberships m on m.user_id = auth.uid()
  where t.email = public.marketing_mijn_email()
    and t.actief and m.active and not m.must_change_password
$$;

-- ---------------------------------------------------------------------------
-- Weektaken: maximaal drie per week, open taken schuiven door
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_weektaken (
  id              uuid primary key default gen_random_uuid(),
  titel           text not null check (char_length(btrim(titel)) between 1 and 140),
  eigenaar        text not null references public.marketing_teamleden (email) on update cascade,
  minimumversie   text check (char_length(minimumversie) <= 280),
  klaar_wanneer   text check (char_length(klaar_wanneer) <= 280),
  week_start      date not null check (extract(isodow from week_start) = 1),
  status          text not null default 'open' check (status in ('open', 'af')),
  afgerond_op     timestamptz,
  aangemaakt_door text not null default public.marketing_mijn_email(),
  created_at      timestamptz not null default now()
);

create index if not exists marketing_weektaken_week_idx on public.marketing_weektaken (week_start, status);

create or replace function public.marketing_weektaken_regels()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  bezet integer;
begin
  if tg_op = 'INSERT' then
    -- Eén slot per keer, zodat twee mensen niet tegelijk de vierde taak toevoegen.
    perform pg_advisory_xact_lock(hashtext('marketing_weektaken'));
    select count(*) into bezet
    from public.marketing_weektaken w
    where w.week_start = new.week_start
       or (w.status = 'open' and w.week_start < new.week_start);
    if bezet >= 3 then
      raise exception 'Deze week zit vol: maximaal drie taken, en wat nog openstaat schuift door.'
        using errcode = 'P0001';
    end if;
  end if;

  if new.status = 'af' and (tg_op = 'INSERT' or old.status is distinct from 'af') then
    new.afgerond_op := now();
  elsif new.status = 'open' then
    new.afgerond_op := null;
  end if;
  return new;
end;
$$;

drop trigger if exists marketing_weektaken_regels on public.marketing_weektaken;
create trigger marketing_weektaken_regels
  before insert or update on public.marketing_weektaken
  for each row execute function public.marketing_weektaken_regels();

-- ---------------------------------------------------------------------------
-- Posts: Mila plant, Daan levert en keurt de tekst
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_posts (
  id                uuid primary key default gen_random_uuid(),
  datum             date not null,
  merk              text not null default 'pellens' check (merk in ('pellens', 'brouwerij')),
  kanaal            text not null check (kanaal in (
                      'reel', 'carrousel', 'foto', 'story', 'tiktok',
                      'google', 'facebook', 'linkedin', 'mail')),
  thema             text check (thema in ('land', 'vuur', 'tafel', 'mensen', 'boeken')),
  idee              text not null check (char_length(btrim(idee)) between 1 and 600),
  tekst             text check (char_length(tekst) <= 2200),
  tekst_door        text,
  tekst_goedgekeurd boolean not null default false,
  spraakmemo_pad    text,
  beeld             jsonb not null default '[]'::jsonb check (jsonb_typeof(beeld) = 'array'),
  status            text not null default 'tekst_nodig' check (status in (
                      'idee', 'tekst_nodig', 'tekst_klaar', 'ingepland', 'geplaatst')),
  aangemaakt_door   text not null default public.marketing_mijn_email(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists marketing_posts_datum_idx on public.marketing_posts (datum);

create or replace function public.marketing_posts_regels()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  was_goedgekeurd boolean := case when tg_op = 'UPDATE' then old.tekst_goedgekeurd else false end;
  oude_tekst text := case when tg_op = 'UPDATE' then old.tekst else null end;
begin
  if new.tekst_goedgekeurd and not was_goedgekeurd
     and public.marketing_mijn_rol() is distinct from 'eigenaar' then
    raise exception 'Alleen de eigenaar keurt teksten goed.' using errcode = 'P0001';
  end if;

  if new.tekst is distinct from oude_tekst then
    new.tekst_door := public.marketing_mijn_email();
    -- Een gewijzigde tekst moet opnieuw worden goedgekeurd, tenzij de eigenaar hem nu zelf goedkeurt.
    if not (new.tekst_goedgekeurd and public.marketing_mijn_rol() = 'eigenaar') then
      new.tekst_goedgekeurd := false;
    end if;
  end if;

  if new.tekst_goedgekeurd and coalesce(btrim(new.tekst), '') = '' then
    raise exception 'Er is nog geen tekst om goed te keuren.' using errcode = 'P0001';
  end if;

  if new.tekst_goedgekeurd and new.status in ('idee', 'tekst_nodig') then
    new.status := 'tekst_klaar';
  elsif not new.tekst_goedgekeurd and new.status = 'tekst_klaar' then
    new.status := 'tekst_nodig';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_posts_regels on public.marketing_posts;
create trigger marketing_posts_regels
  before insert or update on public.marketing_posts
  for each row execute function public.marketing_posts_regels();

-- ---------------------------------------------------------------------------
-- Dagelijkse routines, metingen, doelen en uploads
-- ---------------------------------------------------------------------------

create table if not exists public.marketing_routine_checks (
  datum      date not null,
  routine    text not null check (char_length(routine) between 1 and 60),
  email      text not null default public.marketing_mijn_email(),
  created_at timestamptz not null default now(),
  primary key (datum, routine, email)
);

create table if not exists public.marketing_metingen (
  metric        text not null check (char_length(metric) between 1 and 60),
  periode_start date not null,
  waarde        numeric not null check (waarde >= 0),
  ingevuld_door text not null default public.marketing_mijn_email(),
  updated_at    timestamptz not null default now(),
  primary key (metric, periode_start)
);

create or replace function public.marketing_metingen_bijwerken()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.ingevuld_door := public.marketing_mijn_email();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists marketing_metingen_bijwerken on public.marketing_metingen;
create trigger marketing_metingen_bijwerken
  before insert or update on public.marketing_metingen
  for each row execute function public.marketing_metingen_bijwerken();

create table if not exists public.marketing_doelen (
  metric        text primary key,
  label         text not null,
  start_waarde  numeric,
  doel_december numeric,
  doel_maart    numeric,
  volgorde      integer not null default 0
);

create table if not exists public.marketing_uploads (
  id            uuid primary key default gen_random_uuid(),
  drive_file_id text not null,
  naam          text not null,
  onderwerp     text not null,
  mime          text,
  grootte       bigint,
  link          text,
  email         text not null default public.marketing_mijn_email(),
  created_at    timestamptz not null default now()
);

create index if not exists marketing_uploads_created_idx on public.marketing_uploads (created_at desc);

-- ---------------------------------------------------------------------------
-- Rijbeveiliging: alleen actieve teamleden zien en wijzigen iets
-- ---------------------------------------------------------------------------

alter table public.marketing_teamleden      enable row level security;
alter table public.marketing_weektaken      enable row level security;
alter table public.marketing_posts          enable row level security;
alter table public.marketing_routine_checks enable row level security;
alter table public.marketing_metingen       enable row level security;
alter table public.marketing_doelen         enable row level security;
alter table public.marketing_uploads        enable row level security;

drop policy if exists "marketing teamleden lezen" on public.marketing_teamleden;
create policy "marketing teamleden lezen" on public.marketing_teamleden
  for select to authenticated using (public.marketing_is_teamlid());

drop policy if exists "marketing weektaken team" on public.marketing_weektaken;
create policy "marketing weektaken team" on public.marketing_weektaken
  for all to authenticated
  using (public.marketing_is_teamlid())
  with check (public.marketing_is_teamlid());

drop policy if exists "marketing posts team" on public.marketing_posts;
create policy "marketing posts team" on public.marketing_posts
  for all to authenticated
  using (public.marketing_is_teamlid())
  with check (public.marketing_is_teamlid());

drop policy if exists "marketing routines lezen" on public.marketing_routine_checks;
create policy "marketing routines lezen" on public.marketing_routine_checks
  for select to authenticated using (public.marketing_is_teamlid());

drop policy if exists "marketing routines eigen afvinken" on public.marketing_routine_checks;
create policy "marketing routines eigen afvinken" on public.marketing_routine_checks
  for insert to authenticated
  with check (public.marketing_is_teamlid() and email = public.marketing_mijn_email());

drop policy if exists "marketing routines eigen terugzetten" on public.marketing_routine_checks;
create policy "marketing routines eigen terugzetten" on public.marketing_routine_checks
  for delete to authenticated
  using (public.marketing_is_teamlid() and email = public.marketing_mijn_email());

drop policy if exists "marketing metingen team" on public.marketing_metingen;
create policy "marketing metingen team" on public.marketing_metingen
  for all to authenticated
  using (public.marketing_is_teamlid())
  with check (public.marketing_is_teamlid());

drop policy if exists "marketing doelen lezen" on public.marketing_doelen;
create policy "marketing doelen lezen" on public.marketing_doelen
  for select to authenticated using (public.marketing_is_teamlid());

drop policy if exists "marketing doelen eigenaar" on public.marketing_doelen;
create policy "marketing doelen eigenaar" on public.marketing_doelen
  for update to authenticated
  using (public.marketing_mijn_rol() = 'eigenaar')
  with check (public.marketing_mijn_rol() = 'eigenaar');

drop policy if exists "marketing uploads lezen" on public.marketing_uploads;
create policy "marketing uploads lezen" on public.marketing_uploads
  for select to authenticated using (public.marketing_is_teamlid());

drop policy if exists "marketing uploads eigen vastleggen" on public.marketing_uploads;
create policy "marketing uploads eigen vastleggen" on public.marketing_uploads
  for insert to authenticated
  with check (public.marketing_is_teamlid() and email = public.marketing_mijn_email());

-- ---------------------------------------------------------------------------
-- Rechten: niets voor anonieme bezoekers
-- ---------------------------------------------------------------------------

revoke all on public.marketing_teamleden, public.marketing_weektaken, public.marketing_posts, public.marketing_routine_checks,
  public.marketing_metingen, public.marketing_doelen, public.marketing_uploads from anon;

grant select on public.marketing_teamleden to authenticated;
grant select, insert, update, delete on public.marketing_weektaken, public.marketing_posts, public.marketing_metingen to authenticated;
grant select, insert, delete on public.marketing_routine_checks to authenticated;
grant select, update on public.marketing_doelen to authenticated;
grant select, insert on public.marketing_uploads to authenticated;

revoke execute on function public.marketing_is_teamlid(), public.marketing_mijn_rol() from public, anon;
grant execute on function public.marketing_mijn_email(), public.marketing_is_teamlid(), public.marketing_mijn_rol() to authenticated;
