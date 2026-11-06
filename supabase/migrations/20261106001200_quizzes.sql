-- Quizzes & Exams: private to each student (their questions, attempts and scores).
create type public.quiz_kind as enum ('quiz', 'exam');

create table public.quizzes (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid not null references public.profiles(id) on delete cascade,
  title              text not null check (char_length(title) between 2 and 160),
  subject_id         uuid references public.subjects(id) on delete set null,
  focus              text,                         -- topic, or null for a whole-subject exam
  kind               public.quiz_kind not null default 'quiz',
  time_limit_minutes int check (time_limit_minutes between 1 and 240),
  questions          jsonb not null,               -- [{id, type, question, options, answer, rationale, topic}]
  sources            jsonb not null default '[]',
  origin             text not null default 'ai',   -- 'ai' (generated) or 'review' (from saved Review Center questions)
  created_at         timestamptz not null default now()
);
create index quizzes_student on public.quizzes (student_id, created_at desc);

create table public.quiz_attempts (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references public.quizzes(id) on delete cascade,
  student_id   uuid not null references public.profiles(id) on delete cascade,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  answers      jsonb not null default '{}',        -- question id -> answer given
  score        int not null default 0,
  total        int not null default 0,
  by_topic     jsonb not null default '{}',        -- topic -> {right, total}
  timed_out    boolean not null default false
);
create index quiz_attempts_student on public.quiz_attempts (student_id, started_at desc);

alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;

-- Owner only (the admin can't read students' quizzes either).
create policy "quizzes: own" on public.quizzes for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "quizzes: add own" on public.quizzes for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "quizzes: rename own" on public.quizzes for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()))
  with check (student_id = (select auth.uid()));
create policy "quizzes: delete own" on public.quizzes for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
revoke update on public.quizzes from authenticated;
grant update (title) on public.quizzes to authenticated;

create policy "attempts: own" on public.quiz_attempts for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "attempts: add own" on public.quiz_attempts for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.is_active_user())
              and exists (select 1 from public.quizzes q where q.id = quiz_id and q.student_id = (select auth.uid())));
create policy "attempts: delete own" on public.quiz_attempts for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
