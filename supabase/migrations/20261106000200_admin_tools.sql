-- Phase 3: admin may edit students' study details (name, year, semester).
-- Column grants from the foundation migration still apply, so role, email and
-- active status remain changeable only by the admin-users Edge Function.
create policy "profiles: admin updates" on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Simple record of admin actions (shown later on the admin Overview).
create table public.activity_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  target_id  uuid,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

alter table public.activity_log enable row level security;
create policy "activity_log: admin reads" on public.activity_log
  for select to authenticated using ((select public.is_admin()));
create policy "activity_log: admin writes" on public.activity_log
  for insert to authenticated with check ((select public.is_admin()) and actor_id = (select auth.uid()));
revoke all on public.activity_log from anon;

-- (applied separately as activity_log_target_fk)
alter table public.activity_log
  add constraint activity_log_target_id_fkey foreign key (target_id) references public.profiles (id) on delete set null;
create index activity_log_target_idx on public.activity_log (target_id);
create index activity_log_actor_idx on public.activity_log (actor_id);
