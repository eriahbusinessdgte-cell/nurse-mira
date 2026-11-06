-- Phase 4: shared library, private documents, search index, storage.
create extension if not exists vector with schema extensions;

create type public.doc_visibility as enum ('shared', 'private');
create type public.doc_status as enum ('active', 'archived');
create type public.doc_processing as enum ('uploading', 'processing', 'ready', 'failed');
create type public.source_type as enum ('official_guidance', 'textbook', 'school_material', 'review_center', 'student_notes', 'other');

create table public.documents (
  id                uuid primary key default gen_random_uuid(),
  uploader_id       uuid references public.profiles (id) on delete set null,
  title             text not null check (char_length(title) between 1 and 300),
  original_filename text not null,
  mime_type         text not null,
  file_size         bigint not null check (file_size >= 0),
  file_path         text,                       -- null once the original is removed ("keep text only")
  sha256            text not null,
  visibility        public.doc_visibility not null default 'shared',
  status            public.doc_status not null default 'active',
  processing        public.doc_processing not null default 'uploading',
  processing_error  text,
  subject_id        uuid references public.subjects (id) on delete set null,
  topic_id          uuid references public.topics (id) on delete set null,
  year_level        smallint check (year_level between 1 and 4),
  semester          smallint check (semester between 1 and 2),
  source_type       public.source_type not null default 'student_notes',
  author            text,
  published_on      text,
  rights_confirmed  boolean not null default false,
  allow_download    boolean not null default false,
  page_count        integer,
  chunk_count       integer not null default 0,
  text_chars        integer not null default 0,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index documents_uploader_idx on public.documents (uploader_id);
create index documents_subject_idx on public.documents (subject_id);
create index documents_topic_idx on public.documents (topic_id);
create index documents_sha_idx on public.documents (sha256);
create index documents_created_idx on public.documents (created_at desc);

create trigger documents_touch before update on public.documents
  for each row execute function private.touch_updated_at();

create table public.document_chunks (
  id          bigint generated always as identity primary key,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null,
  page_number integer,
  content     text not null,
  embedding   extensions.vector(384),
  fts         tsvector generated always as (to_tsvector('english', content)) stored,
  unique (document_id, chunk_index)
);
create index document_chunks_doc_idx on public.document_chunks (document_id);
create index document_chunks_fts_idx on public.document_chunks using gin (fts);
create index document_chunks_embedding_idx on public.document_chunks using hnsw (embedding extensions.vector_ip_ops);

alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;

create policy "documents: read" on public.documents for select to authenticated
  using ((select public.is_active_user()) and (
    uploader_id = (select auth.uid()) or (select public.is_admin()) or visibility = 'shared'));

create policy "documents: upload own" on public.documents for insert to authenticated
  with check (uploader_id = (select auth.uid()) and (select public.is_active_user()));

create policy "documents: edit own or admin" on public.documents for update to authenticated
  using ((select public.is_active_user()) and (uploader_id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_user()) and (uploader_id = (select auth.uid()) or (select public.is_admin())));

create policy "documents: delete own or admin" on public.documents for delete to authenticated
  using ((select public.is_active_user()) and (uploader_id = (select auth.uid()) or (select public.is_admin())));

-- Text pieces: shared ones are readable by everyone signed in (that is how
-- Student B benefits from Student A's reviewer). Private ones only by the owner
-- — not by the admin.
create policy "chunks: read" on public.document_chunks for select to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and (select public.is_active_user())
      and (d.visibility = 'shared' or d.uploader_id = (select auth.uid()))));

create policy "chunks: add to own document" on public.document_chunks for insert to authenticated
  with check (exists (
    select 1 from public.documents d
    where d.id = document_id and d.uploader_id = (select auth.uid()) and (select public.is_active_user())));

create policy "chunks: remove from own document or admin" on public.document_chunks for delete to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_id and (select public.is_active_user())
      and (d.uploader_id = (select auth.uid()) or (select public.is_admin()))));

revoke all on public.documents, public.document_chunks from anon;
-- Embeddings are written only by the server (Edge Function).
revoke update on public.document_chunks from authenticated;

-- Students may not change the admin-controlled fields of their own uploads.
create or replace function private.guard_document_update()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    if new.allow_download is distinct from old.allow_download
       or new.status is distinct from old.status
       or new.uploader_id is distinct from old.uploader_id
       or new.sha256 is distinct from old.sha256
       or new.file_size is distinct from old.file_size then
      raise exception 'Only the administrator can change that.';
    end if;
  end if;
  if new.visibility = 'shared' and old.visibility = 'private' and not new.rights_confirmed then
    raise exception 'Please confirm you are allowed to share this document.';
  end if;
  return new;
end;
$$;
create trigger documents_guard before update on public.documents
  for each row execute function private.guard_document_update();

-- Duplicate check before uploading: is this exact file already in the shared library?
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

-- Storage numbers for the admin dashboard.
create or replace function public.admin_storage_stats()
returns json language plpgsql stable security definer set search_path = ''
as $$
declare result json;
begin
  if not (select public.is_admin()) then
    raise exception 'Only the administrator can see storage details.';
  end if;
  select json_build_object(
    'database_bytes', pg_database_size(current_database()),
    'file_bytes', coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects where bucket_id = 'documents'), 0),
    'file_count', (select count(*) from storage.objects where bucket_id = 'documents'),
    'index_bytes', pg_total_relation_size('public.document_chunks')
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_storage_stats() from public, anon;
grant execute on function public.admin_storage_stats() to authenticated;

-- ---------- File storage ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)  -- 25 MB per file
on conflict (id) do nothing;

-- Files live at <uploader id>/<document id>/<file name>.
create policy "files: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.is_active_user()));

create policy "files: read own, admin, or downloadable shared" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select public.is_active_user()) and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    -- The admin may open shared files (to review them), but not students' private documents.
    or ((select public.is_admin()) and exists (select 1 from public.documents d
               where d.file_path = name and d.visibility = 'shared'))
    or exists (select 1 from public.documents d
               where d.file_path = name and d.visibility = 'shared' and d.allow_download and d.status = 'active')));

create policy "files: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (select public.is_active_user()) and (
    (storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
