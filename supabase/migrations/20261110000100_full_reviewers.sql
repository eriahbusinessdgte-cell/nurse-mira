-- D-063: Full reviewers — a reviewer for a whole library document, made part by part (~10 pages each).
-- Admin-made reviewers are shared with every student; students can make private ones with their own answers.
create table public.full_reviewers (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  shared       boolean not null default false,
  title        text not null check (char_length(title) between 1 and 300),
  from_page    int,
  to_page      int,
  plan         jsonb not null default '[]',   -- [{from, to, pages: [a, b]}] chunk-index ranges per part
  parts        jsonb not null default '[]',   -- finished parts, in order
  status       text not null default 'building' check (status in ('building', 'ready')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index full_reviewers_one_shared on public.full_reviewers (document_id) where shared;
create unique index full_reviewers_one_private on public.full_reviewers (created_by, document_id) where not shared;
create index full_reviewers_created_by_idx on public.full_reviewers (created_by);
alter table public.full_reviewers enable row level security;

create policy "full reviewers: shared or own" on public.full_reviewers for select to authenticated
  using ((select public.is_active_user()) and (shared or created_by = (select auth.uid())));
create policy "full reviewers: delete own or admin" on public.full_reviewers for delete to authenticated
  using ((select public.is_active_user()) and (created_by = (select auth.uid()) or (select public.is_admin())));
-- Creating and building happen only in the server function (service role).
grant select, delete on public.full_reviewers to authenticated;

-- (applied as full_reviewers_counts) counts for the list without loading every part
alter table public.full_reviewers
  add column parts_total int generated always as (jsonb_array_length(plan)) stored,
  add column parts_done int generated always as (jsonb_array_length(parts)) stored;
