-- My Planner: private academic tasks and deadlines.
create type public.planner_kind as enum ('assignment', 'project', 'case_study', 'exam', 'clinical', 'study', 'reminder', 'other');
create type public.planner_status as enum ('todo', 'in_progress', 'done');
create type public.planner_priority as enum ('low', 'medium', 'high');

create table public.planner_items (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  kind          public.planner_kind not null default 'assignment',
  subject_id    uuid references public.subjects(id) on delete set null,
  case_study_id uuid references public.case_studies(id) on delete set null,
  due_date      date,
  due_time      time,
  status        public.planner_status not null default 'todo',
  priority      public.planner_priority not null default 'medium',
  notes         text check (char_length(notes) <= 4000),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index planner_student_due on public.planner_items (student_id, due_date);
alter table public.planner_items enable row level security;

create policy "planner: own" on public.planner_items for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "planner: add own" on public.planner_items for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.is_active_user())
              and (case_study_id is null or exists (select 1 from public.case_studies c where c.id = case_study_id and c.student_id = (select auth.uid()))));
create policy "planner: edit own" on public.planner_items for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()))
  with check (student_id = (select auth.uid())
              and (case_study_id is null or exists (select 1 from public.case_studies c where c.id = case_study_id and c.student_id = (select auth.uid()))));
create policy "planner: delete own" on public.planner_items for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
revoke update on public.planner_items from authenticated;
grant update (title, kind, subject_id, case_study_id, due_date, due_time, status, priority, notes, completed_at, updated_at) on public.planner_items to authenticated;

create trigger planner_touch before update on public.planner_items
  for each row execute function private.touch_updated_at();
