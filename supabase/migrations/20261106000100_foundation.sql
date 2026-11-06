-- Nurse Mira — foundation: accounts, roles, closed sign-ups, curriculum.

-- ---------- Private settings (not reachable through the public API) ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.settings (
  key   text primary key,
  value text not null
);

-- The first administrator. Only this address (or users created by the admin
-- through Nurse Mira) may ever get an account.
insert into private.settings (key, value)
values ('bootstrap_admin_email', 'eriah.businessdgte@gmail.com');

-- ---------- Roles and profiles ----------
create type public.app_role as enum ('student', 'admin');

create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  email                text not null,
  full_name            text not null default '',
  preferred_name       text,
  role                 public.app_role not null default 'student',
  year_level           smallint check (year_level between 1 and 4),
  current_semester     smallint check (current_semester between 1 and 2),
  is_active            boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.profiles is 'One row per person. Role and active status change only through admin tools.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.is_active
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active
  );
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_active_user() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- Close public sign-up: an account may be created only for the bootstrap admin
-- or when Nurse Mira's admin tools mark it as invited (app_metadata, which the
-- public sign-up API cannot set).
create or replace function private.guard_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_email text;
begin
  select value into admin_email from private.settings where key = 'bootstrap_admin_email';
  if lower(new.email) = lower(admin_email)
     or coalesce(new.raw_app_meta_data ->> 'nm_invited', 'false') = 'true' then
    return new;
  end if;
  raise exception 'Nurse Mira is invite-only. Ask your administrator for an invitation.';
end;
$$;

create trigger nm_guard_new_user
  before insert on auth.users
  for each row execute function private.guard_new_user();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_email text;
begin
  select value into admin_email from private.settings where key = 'bootstrap_admin_email';
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when lower(new.email) = lower(admin_email) then 'admin'::public.app_role
         else 'student'::public.app_role end
  );
  return new;
end;
$$;

create trigger nm_on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: read own or admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active_user()))
  with check (id = (select auth.uid()));

-- Students may change only their own study details; role, email and active
-- status are changed by admin tools running with the service key.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, preferred_name, year_level, current_semester, onboarding_completed)
  on public.profiles to authenticated;

-- ---------- Curriculum ----------
create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  title       text not null,
  year_level  smallint not null check (year_level between 1 and 4),
  semester    smallint not null check (semester between 1 and 2),
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,   -- retired subjects stay for old records
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.topics (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  name       text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (subject_id, name)
);
create index topics_subject_idx on public.topics (subject_id);

create table public.student_subjects (
  student_id uuid not null references public.profiles (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  added_at   timestamptz not null default now(),
  primary key (student_id, subject_id)
);
create index student_subjects_subject_idx on public.student_subjects (subject_id);

create trigger subjects_touch before update on public.subjects
  for each row execute function private.touch_updated_at();

alter table public.subjects enable row level security;
alter table public.topics enable row level security;
alter table public.student_subjects enable row level security;

create policy "subjects: signed-in users read" on public.subjects
  for select to authenticated using ((select public.is_active_user()));
create policy "subjects: admin writes" on public.subjects
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "topics: signed-in users read" on public.topics
  for select to authenticated using ((select public.is_active_user()));
create policy "topics: admin writes" on public.topics
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "student_subjects: read own or admin" on public.student_subjects
  for select to authenticated
  using (student_id = (select auth.uid()) or (select public.is_admin()));
create policy "student_subjects: add own or admin" on public.student_subjects
  for insert to authenticated
  with check ((student_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()));
create policy "student_subjects: remove own or admin" on public.student_subjects
  for delete to authenticated
  using ((student_id = (select auth.uid()) and (select public.is_active_user())) or (select public.is_admin()));

revoke all on public.subjects, public.topics, public.student_subjects from anon;

-- ---------- The 26 subjects, exactly as supplied ----------
insert into public.subjects (code, title, year_level, semester, sort_order) values
  ('NCM 100', 'Theoretical Foundation of Nursing', 1, 1, 1),
  ('MC 1',    'Anatomy and Physiology', 1, 1, 2),
  ('MC 2',    'Biochemistry', 1, 1, 3),
  ('MC 3',    'Microbiology and Parasitology', 1, 2, 4),
  ('NCM 101', 'Health Assessment', 1, 2, 5),
  ('NCM 102', 'Health Education', 1, 2, 6),
  ('NCM 103', 'Fundamentals of Nursing Practice', 1, 2, 7),
  ('NCM 104', 'Community Health Nursing 1 (Individual and Family as Client)', 2, 1, 8),
  ('NCM 105', 'Nutrition and Diet Therapy', 2, 1, 9),
  ('NCM 106', 'Pharmacology', 2, 1, 10),
  ('NCM 107', 'Care of Mother, Child, Adolescent (Well Clients)', 2, 1, 11),
  ('NCM 108', 'Health Care Ethics (Bioethics)', 2, 1, 12),
  ('NCM 109', 'Care of Mother, Child at Risk or with Problems (Acute and Chronic)', 2, 2, 13),
  ('NCM 110', 'Nursing Informatics', 2, 2, 14),
  ('NCM 111', 'Nursing Research 1', 3, 1, 15),
  ('NCM 112', 'Care of Clients with Problems in Oxygenation, Fluid and Electrolytes, Infectious, Inflammatory and Immunologic Response, Cellular Aberrations (Acute and Chronic)', 3, 1, 16),
  ('NCM 113', 'Community Health Nursing 2 (Population Groups and Community as Clients)', 3, 1, 17),
  ('NCM 114', 'Care of Older Person', 3, 1, 18),
  ('NCM 115', 'Nursing Research 2', 3, 2, 19),
  ('NCM 116', 'Care of Clients with Problems in Nutrition and Gastro-Intestinal, Metabolism and Endocrine, Perception and Coordination (Acute and Chronic)', 3, 2, 20),
  ('NCM 117', 'Care of Clients with Maladaptive Patterns of Behavior (Acute and Chronic)', 3, 2, 21),
  ('NCM 118', 'Nursing Care of Clients with Life Threatening Conditions/Acutely Ill/Multi-organ Problems/High Acuity and Emergency Situations (Acute and Chronic)', 4, 1, 22),
  ('NCM 119', 'Nursing Leadership and Management', 4, 1, 23),
  ('NCM 120', 'Decent Work Employment and Transcultural Nursing', 4, 1, 24),
  ('NCM 121', 'Disaster Nursing', 4, 2, 25),
  ('NCM 122', 'Intensive Nursing Practicum (Hospital and Community Settings)', 4, 2, 26);
