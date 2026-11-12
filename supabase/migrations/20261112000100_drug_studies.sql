-- D-065: Drug Study Maker — private drug studies, one row per drug, optionally linked to a case study.
create table public.drug_studies (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  case_study_id  uuid references public.case_studies(id) on delete set null,
  position       int not null default 0,
  study          jsonb not null,
  ai_generated   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index drug_studies_student on public.drug_studies (student_id, case_study_id, position);
create index drug_studies_case on public.drug_studies (case_study_id);
alter table public.drug_studies enable row level security;

create policy "drug studies: own" on public.drug_studies for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "drug studies: add own" on public.drug_studies for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.is_active_user())
              and (case_study_id is null or exists (select 1 from public.case_studies c where c.id = case_study_id and c.student_id = (select auth.uid()))));
create policy "drug studies: edit own" on public.drug_studies for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()))
  with check (student_id = (select auth.uid())
              and (case_study_id is null or exists (select 1 from public.case_studies c where c.id = case_study_id and c.student_id = (select auth.uid()))));
create policy "drug studies: delete own" on public.drug_studies for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
revoke update on public.drug_studies from authenticated;
grant select, insert, delete on public.drug_studies to authenticated;
grant update (case_study_id, position, study, updated_at) on public.drug_studies to authenticated;
