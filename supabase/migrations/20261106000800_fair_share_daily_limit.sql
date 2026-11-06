-- The daily AI allowance is shared: the app's total is divided evenly among active students.
insert into public.app_settings (key, value)
values ('daily_answer_pool', '70'::jsonb), ('daily_answer_minimum', '5'::jsonb)
on conflict (key) do nothing;

create or replace function public.student_daily_limit()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    coalesce((select (value #>> '{}')::int from public.app_settings where key = 'daily_answer_minimum'), 5),
    coalesce((select (value #>> '{}')::int from public.app_settings where key = 'daily_answer_pool'), 70)
      / greatest(1, (select count(*) from public.profiles where role = 'student' and is_active))::int
  );
$$;
revoke execute on function public.student_daily_limit() from public, anon;
grant execute on function public.student_daily_limit() to authenticated, service_role;
