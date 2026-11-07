-- D-062: "Background knowledge" documents (Erika's decision).
-- Material the AI may learn from but students never see in the Library: it can't be listed,
-- opened or downloaded by students. The AI functions search it on the server (service role),
-- and cite it only as "Nurse Mira review notes" (no file, no page).
alter table public.documents add column if not exists background boolean not null default false;

drop policy if exists "documents: read shared, own or admin" on public.documents;
create policy "documents: read shared, own or admin" on public.documents for select to authenticated
  using ((select public.is_active_user()) and (
    (select public.is_admin())
    or (not background and (visibility = 'shared' or uploader_id = (select auth.uid())))));

drop policy if exists "chunks: read shared or own" on public.document_chunks;
create policy "chunks: read shared or own" on public.document_chunks for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and (select public.is_active_user())
      and ((select public.is_admin())
           or (not d.background and (d.visibility = 'shared' or d.uploader_id = (select auth.uid()))))));

-- Duplicate check must not reveal hidden material to students.
create or replace function public.find_shared_duplicate(p_sha256 text)
returns table (id uuid, title text, status public.doc_status)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.title, d.status from public.documents d
  where (select public.is_active_user()) and d.sha256 = p_sha256 and d.visibility = 'shared'
    and (not d.background or (select public.is_admin()))
  limit 1;
$$;
