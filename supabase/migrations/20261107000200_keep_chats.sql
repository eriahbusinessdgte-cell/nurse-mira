-- D-056: AI Tutor chats expire unless kept. A chat with no new message for 30 days is deleted
-- by the daily keep-alive, unless the student pressed "Keep". Saves most of the database growth.
alter table public.conversations add column if not exists kept boolean not null default false;
grant update (kept) on public.conversations to authenticated;  -- owner-only by the existing policy

create index if not exists conversations_expiry_idx on public.conversations (last_message_at) where not kept;

create or replace function public.ping()
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.conversations where not kept and last_message_at < now() - interval '30 days';
  delete from public.app_events where created_at < now() - interval '60 days';
  delete from public.ai_usage where day < (now() at time zone 'Asia/Manila')::date - 90;
  delete from public.cloudflare_usage where day < (now() at time zone 'UTC')::date - 90;
  delete from public.activity_log where created_at < now() - interval '1 year';
  return 1;
end;
$$;
grant execute on function public.ping() to anon, authenticated;
