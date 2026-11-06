-- Erika's decision (D-027): every student upload goes into the shared library,
-- and students see ONLY the documents they added themselves — not other
-- students' uploads, titles, text or files. Nurse Mira's AI still learns from
-- everything (it reads the library on the server, in Phase 5).

-- Students can only add shared documents.
drop policy "documents: upload own" on public.documents;
create policy "documents: upload own (always shared)" on public.documents for insert to authenticated
  with check (uploader_id = (select auth.uid()) and (select public.is_active_user())
              and (visibility = 'shared' or (select public.is_admin())));

-- Students see only their own documents; the admin sees all.
drop policy "documents: read" on public.documents;
create policy "documents: read own or admin" on public.documents for select to authenticated
  using ((select public.is_active_user()) and (uploader_id = (select auth.uid()) or (select public.is_admin())));

-- Text pieces: students read only their own; the admin reads shared ones.
drop policy "chunks: read" on public.document_chunks;
create policy "chunks: read own or admin" on public.document_chunks for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and (select public.is_active_user())
      and (d.uploader_id = (select auth.uid()) or ((select public.is_admin()) and d.visibility = 'shared'))));

-- Original files: only the uploader and the admin.
drop policy "files: read own, admin, or downloadable shared" on storage.objects;
create policy "files: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select public.is_active_user()) and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or ((select public.is_admin()) and exists (select 1 from public.documents d
               where d.file_path = name and d.visibility = 'shared'))));

-- Duplicate check now answers only "already in Nurse Mira or not" — it never
-- reveals another student's document title.
drop function public.find_shared_duplicate(text);
create or replace function public.library_has_file(p_sha256 text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select public.is_active_user()) and exists (
    select 1 from public.documents d where d.sha256 = p_sha256 and d.visibility = 'shared');
$$;
revoke execute on function public.library_has_file(text) from public, anon;
grant execute on function public.library_has_file(text) to authenticated;
