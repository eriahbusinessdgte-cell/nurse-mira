-- Erika's decision (D-027, revised): ONE shared library. Every upload goes into
-- it (no private documents), and every student can browse it — so students can
-- see a reviewer already exists instead of uploading a duplicate. Original-file
-- downloads stay controlled by the admin (per document).

-- Everyone signed in can see shared documents; uploaders still see their own.
drop policy "documents: read own or admin" on public.documents;
create policy "documents: read shared, own or admin" on public.documents for select to authenticated
  using ((select public.is_active_user()) and (
    visibility = 'shared' or uploader_id = (select auth.uid()) or (select public.is_admin())));

drop policy "chunks: read own or admin" on public.document_chunks;
create policy "chunks: read shared or own" on public.document_chunks for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and (select public.is_active_user())
      and (d.visibility = 'shared' or d.uploader_id = (select auth.uid()))));

drop policy "files: read own or admin" on storage.objects;
create policy "files: read own, admin, or downloadable shared" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select public.is_active_user()) and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or ((select public.is_admin()) and exists (select 1 from public.documents d
               where d.file_path = name and d.visibility = 'shared'))
    or exists (select 1 from public.documents d
               where d.file_path = name and d.visibility = 'shared' and d.allow_download and d.status = 'active')));

-- Duplicate check can name the existing reviewer again (the library is open to all).
drop function public.library_has_file(text);
create or replace function public.find_shared_duplicate(p_sha256 text)
returns table (id uuid, title text, status public.doc_status)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.title, d.status from public.documents d
  where (select public.is_active_user()) and d.sha256 = p_sha256 and d.visibility = 'shared'
  limit 1;
$$;
revoke execute on function public.find_shared_duplicate(text) from public, anon;
grant execute on function public.find_shared_duplicate(text) to authenticated;

-- (Uploads stay shared-only for students — policy "documents: upload own (always shared)".)
