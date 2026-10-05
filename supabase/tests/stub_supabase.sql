-- Minimale nabootsing van wat Supabase levert, zodat de migraties lokaal te testen zijn.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;

grant usage on schema public to anon, authenticated;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

grant execute on function auth.jwt() to anon, authenticated;

create schema if not exists storage;
grant usage on schema storage to anon, authenticated;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null
);

alter table storage.objects enable row level security;
grant select, insert, delete on storage.objects to authenticated;

-- Accounts en lidmaatschappen zoals in het project van de team-app.
create table if not exists auth.users (
  id uuid primary key,
  email text not null
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

grant execute on function auth.uid() to anon, authenticated;

create table if not exists public.app_memberships (
  user_id uuid primary key references auth.users (id),
  role text not null,
  active boolean not null default true,
  must_change_password boolean not null default false,
  profile_id text
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000d', 'Daan@Test.nl'),
  ('00000000-0000-0000-0000-00000000000a', 'mila@test.nl'),
  ('00000000-0000-0000-0000-00000000000b', 'beau@test.nl'),
  ('00000000-0000-0000-0000-00000000000f', 'vreemde@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'frits@test.nl')
on conflict do nothing;

insert into public.app_memberships (user_id, role, active, must_change_password, profile_id) values
  ('00000000-0000-0000-0000-00000000000d', 'owner', true, false, 'daan'),
  ('00000000-0000-0000-0000-00000000000a', 'team', true, false, 'mila'),
  ('00000000-0000-0000-0000-00000000000b', 'team', true, false, 'beau'),
  ('00000000-0000-0000-0000-00000000000e', 'team', true, false, 'frits')
on conflict do nothing;
