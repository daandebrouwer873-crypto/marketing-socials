-- Opslag voor ingesproken spraakmemo's bij posts. Privé: alleen actieve teamleden.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketing-spraakmemos', 'marketing-spraakmemos', false, 26214400,
        array['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/aac'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "marketing spraakmemos lezen" on storage.objects;
create policy "marketing spraakmemos lezen" on storage.objects
  for select to authenticated
  using (bucket_id = 'marketing-spraakmemos' and public.marketing_is_teamlid());

drop policy if exists "marketing spraakmemos opslaan" on storage.objects;
create policy "marketing spraakmemos opslaan" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marketing-spraakmemos' and public.marketing_is_teamlid());

drop policy if exists "marketing spraakmemos verwijderen" on storage.objects;
create policy "marketing spraakmemos verwijderen" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marketing-spraakmemos' and public.marketing_is_teamlid());
