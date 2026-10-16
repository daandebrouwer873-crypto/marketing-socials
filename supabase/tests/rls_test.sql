-- Controleert de regels en de rijbeveiliging. Elke fout stopt het script.
\set ON_ERROR_STOP on

create or replace function pg_temp.als(adres text)
returns void
language plpgsql
as $$
declare
  gebruiker uuid;
begin
  -- Rol terugzetten zodat auth.users leesbaar is, daarna inloggen als die gebruiker.
  execute 'reset role';
  select u.id into gebruiker from auth.users u where lower(u.email) = lower(adres);
  perform set_config('request.jwt.claims', json_build_object('email', lower(adres), 'sub', gebruiker)::text, true);
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
select pg_temp.zeker((select count(*) from public.marketing_teamleden) = 0, 'buitenstaander ziet geen teamleden');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_posts (datum, kanaal, idee) values ('2026-10-07', 'reel', 'test')$q$,
  'row-level security');
rollback;

-- 2. Anoniem heeft helemaal geen toegang.
begin;
set local role anon;
select pg_temp.verwacht_fout('select count(*) from public.marketing_posts', 'permission denied');
rollback;

-- 3. Posts: Mila plant, alleen Daan keurt goed, wijzigen trekt goedkeuring in.
begin;
select pg_temp.als('mila@test.nl');
insert into public.marketing_posts (id, datum, kanaal, thema, idee)
values ('00000000-0000-0000-0000-000000000001', '2026-10-08', 'reel', 'vuur', 'Houtgrill van dichtbij');
select pg_temp.zeker(
  (select status = 'tekst_nodig' and not tekst_goedgekeurd and aangemaakt_door = 'mila@test.nl'
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000001'),
  'nieuwe post wacht op tekst');
select pg_temp.verwacht_fout(
  $q$update public.marketing_posts set tekst = 'Mijn tekst', tekst_goedgekeurd = true
     where id = '00000000-0000-0000-0000-000000000001'$q$,
  'Alleen de eigenaar');
update public.marketing_posts set tekst = 'Uitgetypt van Daans memo'
where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select tekst_door = 'mila@test.nl' and status = 'tekst_nodig'
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000001'),
  'tekst van Mila is nog niet goedgekeurd');

select pg_temp.als('daan@test.nl');
update public.marketing_posts set tekst_goedgekeurd = true where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select tekst_goedgekeurd and status = 'tekst_klaar'
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000001'),
  'Daan keurt goed, status wordt tekst_klaar');

select pg_temp.als('mila@test.nl');
update public.marketing_posts set tekst = 'Toch iets anders' where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select not tekst_goedgekeurd and status = 'tekst_nodig'
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000001'),
  'gewijzigde tekst moet opnieuw goedgekeurd');

select pg_temp.als('daan@test.nl');
update public.marketing_posts set tekst = 'Daans eigen woorden', tekst_goedgekeurd = true
where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select tekst_goedgekeurd and tekst_door = 'daan@test.nl' and status = 'tekst_klaar'
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000001'),
  'Daan schrijft en keurt in een keer goed');
select pg_temp.verwacht_fout(
  $q$update public.marketing_posts set tekst = '', tekst_goedgekeurd = true
     where id = '00000000-0000-0000-0000-000000000001'$q$,
  'geen tekst');

update public.marketing_posts set status = 'ingepland' where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.zeker(
  (select status = 'ingepland' from public.marketing_posts where id = '00000000-0000-0000-0000-000000000001'),
  'goedgekeurde post kan worden ingepland');
rollback;

-- 4. Weektaken: maximaal drie, open taken van eerdere weken tellen mee.
begin;
select pg_temp.als('mila@test.nl');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_weektaken (titel, eigenaar, week_start) values ('Dinsdag', 'mila@test.nl', '2026-10-06')$q$,
  'week_start_check');
insert into public.marketing_weektaken (titel, eigenaar, week_start) values
  ('Nulmeting', 'mila@test.nl', '2026-10-05'),
  ('Lunch op Google', 'daan@test.nl', '2026-10-05'),
  ('Reviewkaartjes', 'beau@test.nl', '2026-10-05');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_weektaken (titel, eigenaar, week_start) values ('Vierde', 'mila@test.nl', '2026-10-05')$q$,
  'zit vol');

update public.marketing_weektaken set status = 'af' where titel in ('Nulmeting', 'Lunch op Google');
select pg_temp.zeker(
  (select count(*) = 2 from public.marketing_weektaken where status = 'af' and afgerond_op is not null),
  'afgevinkte taken krijgen een tijdstip');
-- Volgende week: Reviewkaartjes staat nog open en schuift door, dus nog twee plekken.
insert into public.marketing_weektaken (titel, eigenaar, week_start) values
  ('Kerstaanbod', 'daan@test.nl', '2026-10-12'),
  ('Google-post', 'mila@test.nl', '2026-10-12');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_weektaken (titel, eigenaar, week_start) values ('Te veel', 'mila@test.nl', '2026-10-12')$q$,
  'zit vol');
update public.marketing_weektaken set status = 'open' where titel = 'Nulmeting';
select pg_temp.zeker(
  (select afgerond_op is null from public.marketing_weektaken where titel = 'Nulmeting'),
  'heropende taak verliest zijn tijdstip');
rollback;

-- 5. Routines: alleen je eigen vinkjes.
begin;
select pg_temp.als('beau@test.nl');
insert into public.marketing_routine_checks (datum, routine) values ('2026-10-07', 'reviewvraag');
select pg_temp.zeker(
  (select email = 'beau@test.nl' from public.marketing_routine_checks where routine = 'reviewvraag'),
  'vinkje staat op naam van Beau');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_routine_checks (datum, routine, email) values ('2026-10-07', 'story', 'mila@test.nl')$q$,
  'row-level security');
select pg_temp.als('mila@test.nl');
delete from public.marketing_routine_checks where routine = 'reviewvraag';
select pg_temp.als('beau@test.nl');
select pg_temp.zeker(
  (select count(*) = 1 from public.marketing_routine_checks where routine = 'reviewvraag'),
  'Mila kan het vinkje van Beau niet weghalen');
rollback;

-- 6. Doelen: alleen de eigenaar past ze aan.
begin;
select pg_temp.als('mila@test.nl');
update public.marketing_doelen set doel_maart = 1 where metric = 'gasten_diner';
select pg_temp.zeker(
  (select doel_maart = 35 from public.marketing_doelen where metric = 'gasten_diner'),
  'Mila kan doelen niet wijzigen');
select pg_temp.als('daan@test.nl');
update public.marketing_doelen set doel_maart = 36 where metric = 'gasten_diner';
select pg_temp.zeker(
  (select doel_maart = 36 from public.marketing_doelen where metric = 'gasten_diner'),
  'Daan kan doelen wijzigen');
rollback;

-- 7. Metingen: invuller wordt vastgelegd, negatieve waarden geweigerd.
begin;
select pg_temp.als('beau@test.nl');
insert into public.marketing_metingen (metric, periode_start, waarde, ingevuld_door)
values ('gasten_diner', '2026-09-28', 29.5, 'iemand@anders.nl');
select pg_temp.zeker(
  (select ingevuld_door = 'beau@test.nl' from public.marketing_metingen where metric = 'gasten_diner'),
  'invuller is altijd de ingelogde gebruiker');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_metingen (metric, periode_start, waarde) values ('x', '2026-09-28', -1)$q$,
  'waarde_check');
rollback;

-- 8. Uploads en spraakmemo's: alleen teamleden, op eigen naam.
begin;
select pg_temp.als('mila@test.nl');
insert into public.marketing_uploads (drive_file_id, naam, onderwerp) values ('abc', 'foto.jpg', 'gerechten');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_uploads (drive_file_id, naam, onderwerp, email) values ('abc', 'x.jpg', 'gerechten', 'daan@test.nl')$q$,
  'row-level security');
insert into storage.objects (bucket_id, name) values ('marketing-spraakmemos', 'post/memo.webm');
select pg_temp.als('vreemde@example.com');
select pg_temp.verwacht_fout(
  $q$insert into storage.objects (bucket_id, name) values ('marketing-spraakmemos', 'x.webm')$q$,
  'row-level security');
select pg_temp.zeker((select count(*) = 0 from storage.objects), 'buitenstaander ziet geen memo''s');
rollback;

-- 9. Een gedeactiveerd teamlid verliest direct de toegang.
begin;
update public.marketing_teamleden set actief = false where email = 'beau@test.nl';
select pg_temp.als('beau@test.nl');
select pg_temp.zeker((select count(*) = 0 from public.marketing_doelen), 'inactief teamlid ziet niets');
rollback;

-- 10. Koppeling met de team-app: wie zijn wachtwoord nog moet kiezen of geen actief
--     lidmaatschap heeft, komt er niet in, ook al staat die op de marketinglijst.
begin;
update public.app_memberships set must_change_password = true where profile_id = 'mila';
select pg_temp.als('mila@test.nl');
select pg_temp.zeker((select count(*) = 0 from public.marketing_doelen), 'eerst eigen wachtwoord kiezen in de team-app');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_posts (datum, kanaal, idee) values ('2026-10-07', 'reel', 'test')$q$,
  'row-level security');
rollback;

begin;
update public.app_memberships set active = false where profile_id = 'beau';
select pg_temp.als('beau@test.nl');
select pg_temp.zeker((select count(*) = 0 from public.marketing_doelen), 'uit de team-app is ook uit de marketing-app');
rollback;

-- 11. Een collega met een Pellens-account maar zonder marketingrol ziet niets.
begin;
select pg_temp.als('frits@test.nl');
select pg_temp.zeker((select count(*) = 0 from public.marketing_teamleden), 'Frits staat niet op de marketinglijst');
rollback;

-- 12. Plaatsen: alleen de eigenaar, alleen een goedgekeurde tekst, en nooit twee keer.
begin;
select pg_temp.als('mila@test.nl');
insert into public.marketing_posts (id, datum, kanaal, idee, media)
values ('00000000-0000-0000-0000-000000000002', '2026-10-20', 'foto', 'Het eerste bord',
        '[{"pad": "00000000-0000-0000-0000-000000000002/1.jpg", "soort": "foto"}]');
select pg_temp.zeker(
  (select jsonb_array_length(media) = 1 and ig_media_id is null
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000002'),
  'Mila zet de foto klaar');
select pg_temp.verwacht_fout(
  $q$update public.marketing_posts set ig_media_id = '1789' where id = '00000000-0000-0000-0000-000000000002'$q$,
  'alleen de knop Plaatsen');
select pg_temp.verwacht_fout(
  $q$insert into public.marketing_posts (datum, kanaal, idee, fb_post_id) values ('2026-10-20', 'foto', 'x', '168_1')$q$,
  'alleen de knop Plaatsen');
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['instagram'])$q$,
  'Alleen de eigenaar');
update public.marketing_posts set tekst = 'Uitgetypt van Daans memo' where id = '00000000-0000-0000-0000-000000000002';

select pg_temp.als('daan@test.nl');
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['instagram'])$q$,
  'nog niet goedgekeurd');
update public.marketing_posts set tekst_goedgekeurd = true where id = '00000000-0000-0000-0000-000000000002';
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['tiktok'])$q$,
  'Kies Instagram');
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array[]::text[])$q$,
  'Kies Instagram');
select pg_temp.zeker(
  (select plaatsen_bezig_sinds is not null and plaatsen_stand -> 'kanalen' = '["instagram", "facebook"]'::jsonb
   from public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['instagram', 'facebook'])),
  'de eigenaar pakt een goedgekeurde post');
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['instagram'])$q$,
  'op dit moment al geplaatst');
select pg_temp.verwacht_fout(
  $q$update public.marketing_posts set fb_post_id = '168_1' where id = '00000000-0000-0000-0000-000000000002'$q$,
  'alleen de knop Plaatsen');

-- Instagram lukt, Facebook niet: het Instagram-id blijft, het slot gaat los, de fout staat erbij.
select public.marketing_plaatsen_bewaar('00000000-0000-0000-0000-000000000002',
  p_stand => '{"kanalen": ["instagram", "facebook"], "instagram": {"container": "c1"}}',
  p_ig_media_id => '1789', p_ig_link => 'https://www.instagram.com/p/abc/',
  p_fout => 'Facebook: Meta weigert.', p_loslaten => true);
select pg_temp.zeker(
  (select ig_media_id = '1789' and ig_link = 'https://www.instagram.com/p/abc/' and plaatsen_bezig_sinds is null
      and plaatsen_fout = 'Facebook: Meta weigert.' and status = 'tekst_klaar' and plaatsen_stand -> 'instagram' ->> 'container' = 'c1'
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000002'),
  'Instagram bewaard, slot los, fout zichtbaar');
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_bewaar('00000000-0000-0000-0000-000000000002', p_fout => 'x')$q$,
  'niet aan het plaatsen');

-- Opnieuw: alleen Facebook. Een bewaard id wordt nooit overschreven.
select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['facebook']);
select pg_temp.zeker(
  (select plaatsen_fout is null and plaatsen_stand -> 'instagram' ->> 'container' = 'c1'
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000002'),
  'opnieuw pakken wist de fout en houdt de stand');
select public.marketing_plaatsen_bewaar('00000000-0000-0000-0000-000000000002',
  p_ig_media_id => 'ander', p_fb_post_id => '168_99', p_klaar => true);
select pg_temp.zeker(
  (select ig_media_id = '1789' and fb_post_id = '168_99' and status = 'geplaatst' and geplaatst_door = 'daan@test.nl'
      and geplaatst_op is not null and plaatsen_bezig_sinds is null and plaatsen_fout is null
   from public.marketing_posts where id = '00000000-0000-0000-0000-000000000002'),
  'geplaatst, met beide ids en wie het deed');
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['instagram'])$q$,
  'staat al online');

-- Een kanaal dat de app niet zelf plaatst, of een post zonder beeld, kan niet.
insert into public.marketing_posts (id, datum, kanaal, idee, tekst, tekst_goedgekeurd)
values ('00000000-0000-0000-0000-000000000003', '2026-10-21', 'google', 'Lunch op Google', 'Vrijdag weer lunch.', true);
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000003', array['facebook'])$q$,
  'niet zelf');
update public.marketing_posts set kanaal = 'reel' where id = '00000000-0000-0000-0000-000000000003';
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000003', array['instagram'])$q$,
  'Zet eerst');
select pg_temp.verwacht_fout(
  $q$update public.marketing_posts set media = (select jsonb_agg(jsonb_build_object('pad', g)) from generate_series(1, 11) g)
     where id = '00000000-0000-0000-0000-000000000003'$q$,
  'media_check');
rollback;

-- 13. Opslag voor wat er online gaat: alleen teamleden.
begin;
select pg_temp.als('mila@test.nl');
insert into storage.objects (bucket_id, name) values ('marketing-plaatsen', 'post/1.jpg');
select pg_temp.als('vreemde@example.com');
select pg_temp.verwacht_fout(
  $q$insert into storage.objects (bucket_id, name) values ('marketing-plaatsen', 'x.jpg')$q$,
  'row-level security');
select pg_temp.zeker((select count(*) = 0 from storage.objects), 'buitenstaander ziet geen beelden');
rollback;

begin;
set local role anon;
select pg_temp.verwacht_fout(
  $q$select public.marketing_plaatsen_pak('00000000-0000-0000-0000-000000000002', array['instagram'])$q$,
  'permission denied');
rollback;

-- 14. De startgegevens koppelen precies Daan, Mila en Beau, in kleine letters.
select pg_temp.zeker(
  (select string_agg(email || ':' || rol, ',' order by email) from public.marketing_teamleden)
    = 'beau@test.nl:manager,daan@test.nl:eigenaar,mila@test.nl:social',
  'startgegevens koppelen de juiste accounts');

\echo 'Alle databasetests geslaagd.'
