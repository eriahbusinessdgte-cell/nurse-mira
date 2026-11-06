-- Case Study Builder: private to each student.
create table public.case_studies (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null default 'Untitled case study' check (char_length(title) between 1 and 160),
  subject_id  uuid references public.subjects(id) on delete set null,
  facts       jsonb not null default '{}',     -- de-identified case information entered by the student
  sections    jsonb not null default '[]',     -- [{id, title, content}]
  deidentified_confirmed boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index case_studies_student on public.case_studies (student_id, updated_at desc);
alter table public.case_studies enable row level security;

create policy "case studies: own" on public.case_studies for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "case studies: add own" on public.case_studies for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "case studies: edit own" on public.case_studies for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()))
  with check (student_id = (select auth.uid()));
create policy "case studies: delete own" on public.case_studies for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
revoke update on public.case_studies from authenticated;
grant update (title, subject_id, facts, sections, deidentified_confirmed, updated_at) on public.case_studies to authenticated;

create trigger case_studies_touch before update on public.case_studies
  for each row execute function private.touch_updated_at();
