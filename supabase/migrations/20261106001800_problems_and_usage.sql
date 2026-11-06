-- Problems log and AI usage for the admin.
-- The log holds only what went wrong (which tool, what kind of problem, the app's own
-- short message, which page) — never a student's question, notes or answers.

create table public.app_events (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  tool       text not null,
  kind       text not null,
  message    text not null default '',
  path       text not null default ''
);
create index app_events_created_idx on public.app_events (created_at desc);
create index app_events_actor_idx on public.app_events (actor_id);

alter table public.app_events enable row level security;
create policy "app_events: admin reads" on public.app_events for select to authenticated
  using ((select public.is_admin()));
create policy "app_events: admin clears" on public.app_events for delete to authenticated
  using ((select public.is_admin()));
revoke insert, update on public.app_events from authenticated;
revoke all on public.app_events from anon;

-- Signed-in people report a problem through this function only: it fills in who they are,
-- trims every field, and ignores floods (more than 30 reports an hour from one person).
create or replace function public.log_app_event(p_tool text, p_kind text, p_message text default '', p_path text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    return;
  end if;
  if (select count(*) from public.app_events
      where actor_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    return;
  end if;
  insert into public.app_events (actor_id, tool, kind, message, path)
  values (auth.uid(), left(coalesce(p_tool, ''), 40), left(coalesce(p_kind, ''), 40),
          left(coalesce(p_message, ''), 300), left(coalesce(p_path, ''), 120));
end;
$$;
revoke execute on function public.log_app_event(text, text, text, text) from public, anon;
grant execute on function public.log_app_event(text, text, text, text) to authenticated;

-- Which AI service answered tutor questions, per Philippine day. Counts only — the admin
-- still can't read conversations (D-005).
create or replace function public.ai_provider_counts(p_days int default 14)
returns table (day date, provider text, model text, answers bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  return query
    select (m.created_at at time zone 'Asia/Manila')::date, coalesce(m.provider, 'unknown'), coalesce(m.model, ''), count(*)
    from public.messages m
    where m.role = 'assistant'
      and m.created_at >= now() - make_interval(days => greatest(1, least(p_days, 90)))
    group by 1, 2, 3;
end;
$$;
revoke execute on function public.ai_provider_counts(int) from public, anon;
grant execute on function public.ai_provider_counts(int) to authenticated;

-- The daily keep-alive also tidies the problems log (kept 60 days).
create or replace function public.ping()
returns int
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.app_events where created_at < now() - interval '60 days';
  return 1;
end;
$$;
grant execute on function public.ping() to anon, authenticated;
