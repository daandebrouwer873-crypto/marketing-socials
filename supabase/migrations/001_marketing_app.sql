-- Marketing-app Pellens: tabellen, regels en rijbeveiliging.
-- Uitvoeren in de SQL-editor van het Supabase-project (eenmalig, in deze volgorde: 001, 002, daarna seed.sql).

-- ---------------------------------------------------------------------------
-- Team en identiteit
-- ---------------------------------------------------------------------------

create table if not exists public.teamleden (
  email      text primary key check (email = lower(email)),
  naam       text not null check (char_length(naam) between 1 and 40),
  rol        text not null check (rol in ('eigenaar', 'social', 'manager')),
  actief     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.teamleden is
  'Wie de app mag gebruiken. Beheer deze lijst in de SQL-editor; de app zelf kan hem niet wijzigen.';

create or replace function public.mijn_email()
returns text
language sql
stable
as $$
  select lower(coalesce(nullif(auth.jwt() ->> 'email', ''), ''))
$$;

create or replace function public.is_teamlid()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teamleden t
    where t.email = public.mijn_email() and t.actief
  )
$$;

create or replace function public.mijn_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.rol from public.teamleden t
  where t.email = public.mijn_email() and t.actief
$$;

-- ---------------------------------------------------------------------------
-- Weektaken: maximaal drie per week, open taken schuiven door
-- ---------------------------------------------------------------------------

create table if not exists public.weektaken (
  id              uuid primary key default gen_random_uuid(),
  titel           text not null check (char_length(btrim(titel)) between 1 and 140),
  eigenaar        text not null references public.teamleden (email) on update cascade,
  minimumversie   text check (char_length(minimumversie) <= 280),
  klaar_wanneer   text check (char_length(klaar_wanneer) <= 280),
  week_start      date not null check (extract(isodow from week_start) = 1),
  status          text not null default 'open' check (status in ('open', 'af')),
  afgerond_op     timestamptz,
  aangemaakt_door text not null default public.mijn_email(),
  created_at      timestamptz not null default now()
);

create index if not exists weektaken_week_idx on public.weektaken (week_start, status);

create or replace function public.weektaken_regels()
returns trigger
language plpgsql
as $$
declare
  bezet integer;
begin
  if tg_op = 'INSERT' then
    -- Eén slot per keer, zodat twee mensen niet tegelijk de vierde taak toevoegen.
    perform pg_advisory_xact_lock(hashtext('weektaken'));
    select count(*) into bezet
    from public.weektaken w
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

drop trigger if exists weektaken_regels on public.weektaken;
create trigger weektaken_regels
  before insert or update on public.weektaken
  for each row execute function public.weektaken_regels();

-- ---------------------------------------------------------------------------
-- Posts: Mila plant, Daan levert en keurt de tekst
-- ---------------------------------------------------------------------------

create table if not exists public.posts (
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
  aangemaakt_door   text not null default public.mijn_email(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists posts_datum_idx on public.posts (datum);

create or replace function public.posts_regels()
returns trigger
language plpgsql
as $$
declare
  was_goedgekeurd boolean := case when tg_op = 'UPDATE' then old.tekst_goedgekeurd else false end;
  oude_tekst text := case when tg_op = 'UPDATE' then old.tekst else null end;
begin
  if new.tekst_goedgekeurd and not was_goedgekeurd
     and public.mijn_rol() is distinct from 'eigenaar' then
    raise exception 'Alleen de eigenaar keurt teksten goed.' using errcode = 'P0001';
  end if;

  if new.tekst is distinct from oude_tekst then
    new.tekst_door := public.mijn_email();
    -- Een gewijzigde tekst moet opnieuw worden goedgekeurd, tenzij de eigenaar hem nu zelf goedkeurt.
    if not (new.tekst_goedgekeurd and public.mijn_rol() = 'eigenaar') then
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

drop trigger if exists posts_regels on public.posts;
create trigger posts_regels
  before insert or update on public.posts
  for each row execute function public.posts_regels();

-- ---------------------------------------------------------------------------
-- Dagelijkse routines, metingen, doelen en uploads
-- ---------------------------------------------------------------------------

create table if not exists public.routine_checks (
  datum      date not null,
  routine    text not null check (char_length(routine) between 1 and 60),
  email      text not null default public.mijn_email(),
  created_at timestamptz not null default now(),
  primary key (datum, routine, email)
);

create table if not exists public.metingen (
  metric        text not null check (char_length(metric) between 1 and 60),
  periode_start date not null,
  waarde        numeric not null check (waarde >= 0),
  ingevuld_door text not null default public.mijn_email(),
  updated_at    timestamptz not null default now(),
  primary key (metric, periode_start)
);

create or replace function public.metingen_bijwerken()
returns trigger
language plpgsql
as $$
begin
  new.ingevuld_door := public.mijn_email();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists metingen_bijwerken on public.metingen;
create trigger metingen_bijwerken
  before insert or update on public.metingen
  for each row execute function public.metingen_bijwerken();

create table if not exists public.doelen (
  metric        text primary key,
  label         text not null,
  start_waarde  numeric,
  doel_december numeric,
  doel_maart    numeric,
  volgorde      integer not null default 0
);

create table if not exists public.uploads (
  id            uuid primary key default gen_random_uuid(),
  drive_file_id text not null,
  naam          text not null,
  onderwerp     text not null,
  mime          text,
  grootte       bigint,
  link          text,
  email         text not null default public.mijn_email(),
  created_at    timestamptz not null default now()
);

create index if not exists uploads_created_idx on public.uploads (created_at desc);

-- ---------------------------------------------------------------------------
-- Rijbeveiliging: alleen actieve teamleden zien en wijzigen iets
-- ---------------------------------------------------------------------------

alter table public.teamleden      enable row level security;
alter table public.weektaken      enable row level security;
alter table public.posts          enable row level security;
alter table public.routine_checks enable row level security;
alter table public.metingen       enable row level security;
alter table public.doelen         enable row level security;
alter table public.uploads        enable row level security;

drop policy if exists "teamleden lezen" on public.teamleden;
create policy "teamleden lezen" on public.teamleden
  for select to authenticated using (public.is_teamlid());

drop policy if exists "weektaken team" on public.weektaken;
create policy "weektaken team" on public.weektaken
  for all to authenticated
  using (public.is_teamlid())
  with check (public.is_teamlid());

drop policy if exists "posts team" on public.posts;
create policy "posts team" on public.posts
  for all to authenticated
  using (public.is_teamlid())
  with check (public.is_teamlid());

drop policy if exists "routines lezen" on public.routine_checks;
create policy "routines lezen" on public.routine_checks
  for select to authenticated using (public.is_teamlid());

drop policy if exists "routines eigen afvinken" on public.routine_checks;
create policy "routines eigen afvinken" on public.routine_checks
  for insert to authenticated
  with check (public.is_teamlid() and email = public.mijn_email());

drop policy if exists "routines eigen terugzetten" on public.routine_checks;
create policy "routines eigen terugzetten" on public.routine_checks
  for delete to authenticated
  using (public.is_teamlid() and email = public.mijn_email());

drop policy if exists "metingen team" on public.metingen;
create policy "metingen team" on public.metingen
  for all to authenticated
  using (public.is_teamlid())
  with check (public.is_teamlid());

drop policy if exists "doelen lezen" on public.doelen;
create policy "doelen lezen" on public.doelen
  for select to authenticated using (public.is_teamlid());

drop policy if exists "doelen eigenaar" on public.doelen;
create policy "doelen eigenaar" on public.doelen
  for update to authenticated
  using (public.mijn_rol() = 'eigenaar')
  with check (public.mijn_rol() = 'eigenaar');

drop policy if exists "uploads lezen" on public.uploads;
create policy "uploads lezen" on public.uploads
  for select to authenticated using (public.is_teamlid());

drop policy if exists "uploads eigen vastleggen" on public.uploads;
create policy "uploads eigen vastleggen" on public.uploads
  for insert to authenticated
  with check (public.is_teamlid() and email = public.mijn_email());

-- ---------------------------------------------------------------------------
-- Rechten: niets voor anonieme bezoekers
-- ---------------------------------------------------------------------------

revoke all on public.teamleden, public.weektaken, public.posts, public.routine_checks,
  public.metingen, public.doelen, public.uploads from anon;

grant select on public.teamleden to authenticated;
grant select, insert, update, delete on public.weektaken, public.posts, public.metingen to authenticated;
grant select, insert, delete on public.routine_checks to authenticated;
grant select, update on public.doelen to authenticated;
grant select, insert on public.uploads to authenticated;

revoke execute on function public.is_teamlid(), public.mijn_rol() from public, anon;
grant execute on function public.mijn_email(), public.is_teamlid(), public.mijn_rol() to authenticated;
