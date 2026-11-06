-- Keep-alive: a tiny function the daily Vercel job calls so the free Supabase project
-- never pauses for inactivity. It reveals nothing.
create or replace function public.ping()
returns int
language sql
stable
set search_path = ''
as $$ select 1 $$;
grant execute on function public.ping() to anon, authenticated;

-- When the last full backup was downloaded (shown on the admin Overview as a reminder).
insert into public.app_settings (key, value) values ('last_backup_at', 'null'::jsonb) on conflict (key) do nothing;
