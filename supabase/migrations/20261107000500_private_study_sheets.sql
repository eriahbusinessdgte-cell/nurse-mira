-- D-061: study sheets are private to the student who made them (Erika's request), like chats.
-- The two test sheets from Phase 6/8 are deleted.
delete from public.review_sheets;

alter table public.review_sheets drop constraint if exists review_sheets_created_by_fkey;
alter table public.review_sheets
  alter column created_by set not null,
  add constraint review_sheets_created_by_fkey foreign key (created_by) references public.profiles(id) on delete cascade;

drop index if exists public.review_sheets_subject_focus;
create unique index review_sheets_owner_subject_focus on public.review_sheets (created_by, subject_id, focus_key);

drop policy if exists "review sheets: active users read" on public.review_sheets;
drop policy if exists "review sheets: admin deletes" on public.review_sheets;
create policy "review sheets: own" on public.review_sheets for select to authenticated
  using (created_by = (select auth.uid()) and (select public.is_active_user()));
create policy "review sheets: delete own" on public.review_sheets for delete to authenticated
  using (created_by = (select auth.uid()) and (select public.is_active_user()));
-- Inserts and updates still happen only in the server function.
