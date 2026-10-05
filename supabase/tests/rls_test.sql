-- Controleert de regels en de rijbeveiliging. Elke fout stopt het script.
\set ON_ERROR_STOP on

create or replace function pg_temp.als(email text)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', email)::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function pg_temp.verwacht_fout(sql text, deel text)
returns void
language plpgsql
as $$
begin
  execute sql;
  raise exception 'VERWACHTE FOUT BLEEF UIT: %', sql;
exception
  when others then
    if sqlerrm like 'VERWACHTE FOUT BLEEF UIT%' then raise; end if;
    if position(deel in sqlerrm) = 0 then
      raise exception 'Andere fout dan verwacht bij "%": %', sql, sqlerrm;
    end if;
end;
$$;

create or replace function pg_temp.zeker(ok boolean, wat text)
returns void
language plpgsql
as $$
begin
  if not ok then raise exception 'MISLUKT: %', wat; end if;
end;
$$;

-- 1. Een buitenstaander ziet niets en kan niets toevoegen.
begin;
select pg_temp.als('vreemde@example.com');
select pg_temp.zeker((select count(*) from public.teamleden) = 0, 'buitenstaander ziet geen teamleden');
select pg_temp.verwacht_fout(
  $q$insert into public.posts (datum, kanaal, idee) values ('2026-10-07', 'reel', 'test')$q$,
  'row-level security');
rollback;

-- 2. Anoniem heeft helemaal geen toegang.
begin;
set local role anon;
select pg_temp.verwacht_fout('select count(*) from public.posts', 'permission denied');
rollback;

-- 3. Posts: Mila plant, alleen Daan keurt goed, wijzigen trekt goedkeuring in.
begin;
select pg_temp.als('mila@test.nl');
insert into public.posts (id, datum, kanaal, thema, idee)
values ('00000000-0000-0000-0000-000000000001', '2026-10-08', 'reel', 'vuur', 'Houtgrill van dichtbij');
select pg_temp.zeker(
  (select status = 'tekst_nodig' and not tekst_goedgekeurd and aangemaakt_door = 'mila@test.nl'
   from public.posts where id = '00000000-0000-0000-0000-000000000001'),
  'nieuwe post wacht op tekst');
select pg_temp.verwacht_fout(
  $q$update public.posts set tekst = 'Mijn tekst', tekst_goedgekeurd = true
     where id = '00000000-0000-0000-0000-000000000001'$q$,
  'Alleen de eigenaar');
update public.posts set tekst = 'Uitgetypt van Daans memo'
where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select tekst_door = 'mila@test.nl' and status = 'tekst_nodig'
   from public.posts where id = '00000000-0000-0000-0000-000000000001'),
  'tekst van Mila is nog niet goedgekeurd');

select pg_temp.als('daan@test.nl');
update public.posts set tekst_goedgekeurd = true where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select tekst_goedgekeurd and status = 'tekst_klaar'
   from public.posts where id = '00000000-0000-0000-0000-000000000001'),
  'Daan keurt goed, status wordt tekst_klaar');

select pg_temp.als('mila@test.nl');
update public.posts set tekst = 'Toch iets anders' where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select not tekst_goedgekeurd and status = 'tekst_nodig'
   from public.posts where id = '00000000-0000-0000-0000-000000000001'),
  'gewijzigde tekst moet opnieuw goedgekeurd');

select pg_temp.als('daan@test.nl');
update public.posts set tekst = 'Daans eigen woorden', tekst_goedgekeurd = true
where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select tekst_goedgekeurd and tekst_door = 'daan@test.nl' and status = 'tekst_klaar'
   from public.posts where id = '00000000-0000-0000-0000-000000000001'),
  'Daan schrijft en keurt in een keer goed');
select pg_temp.verwacht_fout(
  $q$update public.posts set tekst = '', tekst_goedgekeurd = true
     where id = '00000000-0000-0000-0000-000000000001'$q$,
  'geen tekst');

update public.posts set status = 'ingepland' where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select status = 'ingepland' from public.posts where id = '00000000-0000-0000-0000-000000000001'),
  'goedgekeurde post kan worden ingepland');
rollback;

-- 4. Weektaken: maximaal drie, open taken van eerdere weken tellen mee.
begin;
select pg_temp.als('mila@test.nl');
select pg_temp.verwacht_fout(
  $q$insert into public.weektaken (titel, eigenaar, week_start) values ('Dinsdag', 'mila@test.nl', '2026-10-06')$q$,
  'week_start_check');
insert into public.weektaken (titel, eigenaar, week_start) values
  ('Nulmeting', 'mila@test.nl', '2026-10-05'),
  ('Lunch op Google', 'daan@test.nl', '2026-10-05'),
  ('Reviewkaartjes', 'beau@test.nl', '2026-10-05');
select pg_temp.verwacht_fout(
  $q$insert into public.weektaken (titel, eigenaar, week_start) values ('Vierde', 'mila@test.nl', '2026-10-05')$q$,
  'zit vol');

update public.weektaken set status = 'af' where titel in ('Nulmeting', 'Lunch op Google');
select pg_temp.zeker(
  (select count(*) = 2 from public.weektaken where status = 'af' and afgerond_op is not null),
  'afgevinkte taken krijgen een tijdstip');
-- Volgende week: Reviewkaartjes staat nog open en schuift door, dus nog twee plekken.
insert into public.weektaken (titel, eigenaar, week_start) values
  ('Kerstaanbod', 'daan@test.nl', '2026-10-12'),
  ('Google-post', 'mila@test.nl', '2026-10-12');
select pg_temp.verwacht_fout(
  $q$insert into public.weektaken (titel, eigenaar, week_start) values ('Te veel', 'mila@test.nl', '2026-10-12')$q$,
  'zit vol');
update public.weektaken set status = 'open' where titel = 'Nulmeting';
select pg_temp.zeker(
  (select afgerond_op is null from public.weektaken where titel = 'Nulmeting'),
  'heropende taak verliest zijn tijdstip');
rollback;

-- 5. Routines: alleen je eigen vinkjes.
begin;
select pg_temp.als('beau@test.nl');
insert into public.routine_checks (datum, routine) values ('2026-10-07', 'reviewvraag');
select pg_temp.zeker(
  (select email = 'beau@test.nl' from public.routine_checks where routine = 'reviewvraag'),
  'vinkje staat op naam van Beau');
select pg_temp.verwacht_fout(
  $q$insert into public.routine_checks (datum, routine, email) values ('2026-10-07', 'story', 'mila@test.nl')$q$,
  'row-level security');
select pg_temp.als('mila@test.nl');
delete from public.routine_checks where routine = 'reviewvraag';
select pg_temp.als('beau@test.nl');
select pg_temp.zeker(
  (select count(*) = 1 from public.routine_checks where routine = 'reviewvraag'),
  'Mila kan het vinkje van Beau niet weghalen');
rollback;

-- 6. Doelen: alleen de eigenaar past ze aan.
begin;
select pg_temp.als('mila@test.nl');
update public.doelen set doel_maart = 1 where metric = 'gasten_diner';
select pg_temp.zeker(
  (select doel_maart = 35 from public.doelen where metric = 'gasten_diner'),
  'Mila kan doelen niet wijzigen');
select pg_temp.als('daan@test.nl');
update public.doelen set doel_maart = 36 where metric = 'gasten_diner';
select pg_temp.zeker(
  (select doel_maart = 36 from public.doelen where metric = 'gasten_diner'),
  'Daan kan doelen wijzigen');
rollback;

-- 7. Metingen: invuller wordt vastgelegd, negatieve waarden geweigerd.
begin;
select pg_temp.als('beau@test.nl');
insert into public.metingen (metric, periode_start, waarde, ingevuld_door)
values ('gasten_diner', '2026-09-28', 29.5, 'iemand@anders.nl');
select pg_temp.zeker(
  (select ingevuld_door = 'beau@test.nl' from public.metingen where metric = 'gasten_diner'),
  'invuller is altijd de ingelogde gebruiker');
select pg_temp.verwacht_fout(
  $q$insert into public.metingen (metric, periode_start, waarde) values ('x', '2026-09-28', -1)$q$,
  'waarde_check');
rollback;

-- 8. Uploads en spraakmemo's: alleen teamleden, op eigen naam.
begin;
select pg_temp.als('mila@test.nl');
insert into public.uploads (drive_file_id, naam, onderwerp) values ('abc', 'foto.jpg', 'gerechten');
select pg_temp.verwacht_fout(
  $q$insert into public.uploads (drive_file_id, naam, onderwerp, email) values ('abc', 'x.jpg', 'gerechten', 'daan@test.nl')$q$,
  'row-level security');
insert into storage.objects (bucket_id, name) values ('spraakmemos', 'post/memo.webm');
select pg_temp.als('vreemde@example.com');
select pg_temp.verwacht_fout(
  $q$insert into storage.objects (bucket_id, name) values ('spraakmemos', 'x.webm')$q$,
  'row-level security');
select pg_temp.zeker((select count(*) = 0 from storage.objects), 'buitenstaander ziet geen memo''s');
rollback;

-- 9. Een gedeactiveerd teamlid verliest direct de toegang.
begin;
update public.teamleden set actief = false where email = 'beau@test.nl';
select pg_temp.als('beau@test.nl');
select pg_temp.zeker((select count(*) = 0 from public.doelen), 'inactief teamlid ziet niets');
rollback;

\echo 'Alle databasetests geslaagd.'
