-- D-067: Family Nursing Care Plan Maker — private 7-column FNCPs, one row per saved plan.
create table public.family_care_plans (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles(id) on delete cascade,
  title         text not null default 'Untitled family care plan' check (char_length(title) between 1 and 200),
  input         text not null default '' check (char_length(input) <= 6000),  -- the student's own description
  plan          jsonb not null,                                                 -- the 7 columns as text
  ai_generated  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index family_care_plans_student on public.family_care_plans (student_id, updated_at desc);
alter table public.family_care_plans enable row level security;

create policy "family care plans: own" on public.family_care_plans for select to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "family care plans: add own" on public.family_care_plans for insert to authenticated
  with check (student_id = (select auth.uid()) and (select public.is_active_user()));
create policy "family care plans: edit own" on public.family_care_plans for update to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()))
  with check (student_id = (select auth.uid()));
create policy "family care plans: delete own" on public.family_care_plans for delete to authenticated
  using (student_id = (select auth.uid()) and (select public.is_active_user()));
revoke update on public.family_care_plans from authenticated;
grant select, insert, delete on public.family_care_plans to authenticated;
grant update (title, input, plan, updated_at) on public.family_care_plans to authenticated;
