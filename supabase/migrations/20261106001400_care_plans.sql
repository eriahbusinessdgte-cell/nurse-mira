-- NCP Builder: nursing care plans, private to each student, optionally linked to a case study.
create table public.care_plans (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  case_study_id  uuid references public.case_studies(id) on delete set null,
  position       int not null default 0,
  plan           jsonb not null,   -- {diagnosis, assessment{subjective[],objective[]}, to_assess[], outcomes{short_term[],long_term[]}, planning, interventions[{action,rationale,kind}], evaluation}
  ai_generated   boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index care_plans_student on public.care_plans (student_id, case_study_id, position);
alter table public.care_plans enable row level security;

create policy "care plans: own" on public.care_plans for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "care plans: add own" on public.care_plans for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.is_active_user())
              and (case_study_id is null or exists (select 1 from public.case_studies c where c.id = case_study_id and c.student_id = (select auth.uid()))));
create policy "care plans: edit own" on public.care_plans for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()))
  with check (student_id = (select auth.uid())
              and (case_study_id is null or exists (select 1 from public.case_studies c where c.id = case_study_id and c.student_id = (select auth.uid()))));
create policy "care plans: delete own" on public.care_plans for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
revoke update on public.care_plans from authenticated;
grant update (case_study_id, position, plan, updated_at) on public.care_plans to authenticated;

create trigger care_plans_touch before update on public.care_plans
  for each row execute function private.touch_updated_at();
