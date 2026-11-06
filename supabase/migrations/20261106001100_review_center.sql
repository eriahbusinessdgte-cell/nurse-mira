-- Review Center: AI study sheets for a subject + topic, built from the shared library.
-- Sheets are shared by all students (one student's request saves everyone else an AI answer).
create table public.review_sheets (
  id            uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references public.subjects(id) on delete cascade,
  topic_id      uuid references public.topics(id) on delete set null,
  focus         text not null check (char_length(focus) between 2 and 120),  -- the topic as typed/chosen
  focus_key     text not null,                                              -- normalised, for finding an existing sheet
  content       jsonb not null,      -- summary, key concepts, terms, implications, questions, flashcards, quick review
  sources       jsonb not null default '[]',
  from_library  boolean not null default false,
  provider      text,
  model         text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  views         int not null default 0
);
create unique index review_sheets_subject_focus on public.review_sheets (subject_id, focus_key);
alter table public.review_sheets enable row level security;
create policy "review sheets: active users read" on public.review_sheets for select to authenticated
  using ((select public.is_active_user()));
create policy "review sheets: admin deletes" on public.review_sheets for delete to authenticated
  using ((select public.is_admin()));
-- Inserts and updates happen only in the server function (service role).
