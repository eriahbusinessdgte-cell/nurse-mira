-- D-070: Oral Revalida Practice — private, case-based flashcard sessions with question history.
-- revalida_cases     one row per case a student practises (a saved case study, or pasted/uploaded text).
--                    Slightly edited pasted cases are matched to the same row (revision number goes up).
-- revalida_sessions  every practice session, never overwritten; holds the case text snapshot it used.
-- revalida_questions every generated question with its metadata, answer, state and a meaning "fingerprint"
--                    (embedding) used to reject repeats across all sessions of the same case.

create table public.revalida_cases (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  source         text not null check (source in ('case_study', 'pasted', 'upload')),
  case_study_id  uuid references public.case_studies(id) on delete set null,
  title          text not null check (char_length(title) between 1 and 200),
  content        text not null default '' check (char_length(content) <= 40000),  -- latest text (pasted/uploaded)
  revision       int not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index revalida_cases_one_per_case_study on public.revalida_cases (student_id, case_study_id) where case_study_id is not null;
create index revalida_cases_student on public.revalida_cases (student_id, updated_at desc);

create table public.revalida_sessions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles(id) on delete cascade,
  case_id         uuid not null references public.revalida_cases(id) on delete cascade,
  case_title      text not null,
  case_revision   int not null default 1,
  case_snapshot   text not null default '' check (char_length(case_snapshot) <= 40000),
  requested       int not null check (requested between 1 and 40),
  types           text[] not null default '{}',
  difficulty      text not null default 'challenging' check (difficulty in ('moderate', 'challenging', 'instructor')),
  status          text not null default 'generating' check (status in ('generating', 'ready', 'completed')),
  generation_note text,
  position        int not null default 0,
  attempts        int not null default 0,   -- generation calls used (bounded)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index revalida_sessions_student on public.revalida_sessions (student_id, created_at desc);
create index revalida_sessions_case on public.revalida_sessions (case_id);

create table public.revalida_questions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.revalida_sessions(id) on delete cascade,
  student_id    uuid not null references public.profiles(id) on delete cascade,
  case_id       uuid not null references public.revalida_cases(id) on delete cascade,
  position      int not null,
  qtype         text not null,
  category      text not null default '',
  concept       text not null default '',
  scenario      text not null default '',
  skill         text not null default '',
  difficulty    text not null default '',
  hypothetical  boolean not null default false,
  question      text not null,
  options       jsonb not null default '[]',
  answer_index  int,
  answer        text not null default '',      -- correct answer / model answer
  key_points    jsonb not null default '[]',
  rationale     text not null default '',
  case_link     text not null default '',      -- why it matters for this case
  norm_text     text not null default '',      -- normalised question text for exact-repeat checks
  embedding     extensions.halfvec(384),       -- meaning fingerprint for similar-repeat checks
  revealed      boolean not null default false,
  skipped       boolean not null default false,
  bookmarked    boolean not null default false,
  self_assess   text check (self_assess in ('knew', 'partial', 'didnt')),
  viewed        boolean not null default false,
  created_at    timestamptz not null default now()
);
create unique index revalida_questions_order on public.revalida_questions (session_id, position);
create index revalida_questions_case on public.revalida_questions (student_id, case_id);

alter table public.revalida_cases enable row level security;
alter table public.revalida_sessions enable row level security;
alter table public.revalida_questions enable row level security;

-- Students read, update (state only) and delete their own rows. Creating rows happens in the server function.
create policy "revalida cases: own" on public.revalida_cases for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "revalida cases: delete own" on public.revalida_cases for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "revalida sessions: own" on public.revalida_sessions for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "revalida sessions: update own" on public.revalida_sessions for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user())) with check (student_id = (select auth.uid()));
create policy "revalida sessions: delete own" on public.revalida_sessions for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "revalida questions: own" on public.revalida_questions for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "revalida questions: update own" on public.revalida_questions for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user())) with check (student_id = (select auth.uid()));

revoke all on public.revalida_cases, public.revalida_sessions, public.revalida_questions from authenticated, anon;
grant select, delete on public.revalida_cases, public.revalida_sessions to authenticated;
-- Every column except the meaning fingerprint (the browser doesn't need it).
grant select (id, session_id, student_id, case_id, position, qtype, category, concept, scenario, skill, difficulty, hypothetical,
              question, options, answer_index, answer, key_points, rationale, case_link, norm_text, revealed, skipped,
              bookmarked, self_assess, viewed, created_at) on public.revalida_questions to authenticated;
grant update (position, status, completed_at, updated_at) on public.revalida_sessions to authenticated;
grant update (revealed, skipped, bookmarked, self_assess, viewed) on public.revalida_questions to authenticated;

-- Similar-question check for the server function: closest earlier question (same student + case) to each new one.
create or replace function public.revalida_nearest(p_student uuid, p_case uuid, p_embeddings text[])
returns table (idx int, similarity float, question text)
language sql stable security definer set search_path = ''
as $$
  select e.idx::int, n.sim, n.question
  from unnest(p_embeddings) with ordinality as e(vec, idx)
  cross join lateral (
    select 1 - (q.embedding operator(extensions.<=>) e.vec::extensions.halfvec(384)) as sim, q.question
    from public.revalida_questions q
    where q.student_id = p_student and q.case_id = p_case and q.embedding is not null
    order by q.embedding operator(extensions.<=>) e.vec::extensions.halfvec(384)
    limit 1
  ) n;
$$;
revoke execute on function public.revalida_nearest(uuid, uuid, text[]) from public, anon, authenticated;

-- Generation bookkeeping (applied as a second step, "oral_revalida_generation_state").
alter table public.revalida_sessions
  add column analysis jsonb not null default '{}',     -- what Nurse Mira found in the case, incl. what's missing
  add column empty_batches int not null default 0,     -- batches that produced no new (non-repeated) question
  add column generating_until timestamptz;             -- short lock so two tabs don't generate at once
