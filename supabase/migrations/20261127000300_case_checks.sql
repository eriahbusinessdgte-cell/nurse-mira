-- D-072: Case Study Checker. One row per check: the student's original sections, Nurse Mira's light revisions,
-- the change list and the overall summary. Private to the student. Written by the case-check function.
create table public.case_checks (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null references public.profiles(id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 200),
  source               text not null check (source in ('upload', 'pasted', 'case_study')),
  case_study_id        uuid references public.case_studies(id) on delete set null,
  sections             jsonb not null default '[]',   -- [{title, original, revised|null, note?}]
  parts                jsonb not null default '[]',   -- [{sections:[index], done}]
  overview             jsonb,                         -- {assessment, approach, key_facts[], missing_sections[], double_check[]}
  changes              jsonb not null default '[]',   -- [{kind, section, what, why}] and double_check items
  status               text not null default 'checking' check (status in ('checking', 'ready')),
  saved_case_study_id  uuid references public.case_studies(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index case_checks_student on public.case_checks (student_id, created_at desc);
alter table public.case_checks enable row level security;
create policy "case checks: own" on public.case_checks for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "case checks: delete own" on public.case_checks for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "case checks: mark saved" on public.case_checks for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user())) with check (student_id = (select auth.uid()));
revoke all on public.case_checks from anon, authenticated;
grant select, delete on public.case_checks to authenticated;
grant update (saved_case_study_id) on public.case_checks to authenticated;

-- Applied as a second step ("case_checks_lock").
alter table public.case_checks
  add column format text not null default 'hospital' check (format in ('hospital', 'chn')),  -- which outline it's checked against
  add column working_until timestamptz;                                                      -- short lock: one step at a time
