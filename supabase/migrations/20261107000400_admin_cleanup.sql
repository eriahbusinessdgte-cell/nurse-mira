-- D-058: admin "Clean up" page. The preview returns only counts and sizes (plus names/emails of
-- turned-off students, which the admin already sees on Students) — never chat content.
create or replace function public.admin_cleanup_preview()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result json;
begin
  if not (select public.is_admin()) then
    raise exception 'Only the administrator can see this.';
  end if;
  select json_build_object(
    'old_chats', (select count(*) from public.conversations where not kept and last_message_at < now() - interval '7 days'),
    'old_chat_bytes', (select coalesce(sum(pg_column_size(m.*)), 0) from public.messages m
                        join public.conversations c on c.id = m.conversation_id
                        where not c.kept and c.last_message_at < now() - interval '7 days'),
    'archived_files', (select count(*) from public.documents where status = 'archived' and visibility = 'shared' and file_path is not null),
    'archived_file_bytes', (select coalesce(sum(file_size), 0) from public.documents where status = 'archived' and visibility = 'shared' and file_path is not null),
    'archived_ids', (select coalesce(json_agg(id), '[]'::json) from public.documents where status = 'archived' and visibility = 'shared' and file_path is not null),
    'inactive_students', (select coalesce(json_agg(json_build_object('id', id, 'name', full_name, 'email', email) order by full_name), '[]'::json)
                          from public.profiles where role = 'student' and not is_active),
    'problems', (select count(*) from public.app_events),
    'database_bytes', pg_database_size(current_database())
  ) into result;
  return result;
end;
$$;
revoke execute on function public.admin_cleanup_preview() from public, anon;
grant execute on function public.admin_cleanup_preview() to authenticated;

-- Deletes AI Tutor chats that weren't kept and have had no new message for 7 days.
create or replace function public.admin_cleanup_chats()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare n int;
begin
  if not (select public.is_admin()) then
    raise exception 'Only the administrator can do this.';
  end if;
  delete from public.conversations where not kept and last_message_at < now() - interval '7 days';
  get diagnostics n = row_count;
  insert into public.activity_log (actor_id, action, details) values (auth.uid(), 'cleanup.chats', json_build_object('count', n));
  return n;
end;
$$;
revoke execute on function public.admin_cleanup_chats() from public, anon;
grant execute on function public.admin_cleanup_chats() to authenticated;
