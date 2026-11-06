-- Phase 5: AI Tutor — saved conversations, daily usage, settings, library search.

create type public.tutor_mode as enum ('tea', 'clinical');
create type public.message_role as enum ('user', 'assistant');

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  title           text not null default 'New conversation',
  mode            public.tutor_mode not null default 'tea',
  subject_id      uuid references public.subjects (id) on delete set null,
  summary         text,          -- short study summary, kept up to date by the tutor
  next_step       text,          -- suggested next topic
  topics          text[] not null default '{}',
  message_count   integer not null default 0,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create index conversations_student_idx on public.conversations (student_id, last_message_at desc);
create index conversations_subject_idx on public.conversations (subject_id);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            public.message_role not null,
  content         text not null,
  sources         jsonb not null default '[]'::jsonb,  -- [{n, document_id, title, page, source_type, status}]
  mode            public.tutor_mode,
  provider        text,
  model           text,
  safety_mode     boolean not null default false,       -- Clinical Mode forced for a safety topic
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, id);

-- Daily answers per student (days counted in Philippine time).
create table public.ai_usage (
  student_id uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  answers    integer not null default 0,
  primary key (student_id, day)
);

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('daily_answer_limit', '10'::jsonb),
  ('default_tutor_mode', '"tea"'::jsonb);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ai_usage enable row level security;
alter table public.app_settings enable row level security;

-- Conversations are private to the student (the admin does not read them — D-005).
create policy "conversations: own" on public.conversations for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "conversations: rename or switch mode" on public.conversations for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()))
  with check (student_id = (select auth.uid()));
create policy "conversations: delete own" on public.conversations for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
revoke insert, update on public.conversations from authenticated;
grant update (title, mode, subject_id) on public.conversations to authenticated;

create policy "messages: own" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c
                 where c.id = conversation_id and c.student_id = (select auth.uid()))
         and (select public.is_active_user()));
revoke insert, update, delete on public.messages from authenticated;

create policy "ai_usage: own or admin" on public.ai_usage for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_admin()));
revoke insert, update, delete on public.ai_usage from authenticated;

create policy "settings: read" on public.app_settings for select to authenticated
  using ((select public.is_active_user()));
create policy "settings: admin writes" on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke insert, delete on public.app_settings from authenticated;

revoke all on public.conversations, public.messages, public.ai_usage, public.app_settings from anon;

-- Library search for the tutor: meaning (embeddings) + keywords, with higher
-- priority for authoritative sources, the student's subject, and active
-- (non-archived) materials. Called only by the server.
create or replace function public.search_library(
  query_embedding extensions.vector(384),
  query_text text,
  preferred_subject uuid default null,
  match_count int default 6
)
returns table (
  chunk_id bigint, document_id uuid, title text, page_number int, content text,
  source_type public.source_type, status public.doc_status, subject_id uuid, score double precision
)
language sql stable set search_path = ''
as $$
  with candidates as (
    select c.id
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where d.visibility = 'shared' and d.processing = 'ready' and c.embedding is not null
    order by c.embedding operator(extensions.<#>) query_embedding
    limit 40
  ),
  keyword as (
    select c.id
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    where d.visibility = 'shared' and d.processing = 'ready'
      and c.fts @@ websearch_to_tsquery('english', query_text)
    limit 20
  ),
  pool as (select id from candidates union select id from keyword)
  select c.id, c.document_id, d.title, c.page_number, c.content, d.source_type, d.status, d.subject_id,
    ( coalesce(-(c.embedding operator(extensions.<#>) query_embedding), 0)                     -- meaning (0..1)
      + 0.15 * least(ts_rank(c.fts, websearch_to_tsquery('english', query_text)), 1)            -- keywords
      + case d.source_type when 'official_guidance' then 0.08 when 'textbook' then 0.06
                           when 'school_material' then 0.04 when 'review_center' then 0.02 else 0 end
      + case when preferred_subject is not null and d.subject_id = preferred_subject then 0.05 else 0 end
      - case when d.status = 'archived' then 0.05 else 0 end
    )::double precision as score
  from pool
  join public.document_chunks c on c.id = pool.id
  join public.documents d on d.id = c.document_id
  order by score desc
  limit least(match_count, 12);
$$;
revoke execute on function public.search_library(extensions.vector, text, uuid, int) from public, anon, authenticated;
