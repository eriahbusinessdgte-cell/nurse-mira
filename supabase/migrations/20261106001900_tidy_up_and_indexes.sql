-- Tidy-up rules (D-050), run by the daily keep-alive:
--   problems log 60 days · daily answer and page-reading counts 90 days · admin activity 1 year.
-- Students' own work (chats, quizzes, case studies, care plans, planners, notes) is never
-- deleted automatically — only by the student, or when the admin deletes a student.
create or replace function public.ping()
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_events where created_at < now() - interval '60 days';
  delete from public.ai_usage where day < (now() at time zone 'Asia/Manila')::date - 90;
  delete from public.cloudflare_usage where day < (now() at time zone 'UTC')::date - 90;
  delete from public.activity_log where created_at < now() - interval '1 year';
  return 1;
end;
$$;
grant execute on function public.ping() to anon, authenticated;

-- Indexes for links between tables (faster deletes and look-ups as data grows).
create index if not exists care_plans_case_study_idx on public.care_plans (case_study_id);
create index if not exists case_studies_subject_idx on public.case_studies (subject_id);
create index if not exists planner_items_case_study_idx on public.planner_items (case_study_id);
create index if not exists planner_items_subject_idx on public.planner_items (subject_id);
create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id);
create index if not exists quizzes_subject_idx on public.quizzes (subject_id);
create index if not exists review_sheets_created_by_idx on public.review_sheets (created_by);
create index if not exists review_sheets_topic_idx on public.review_sheets (topic_id);
