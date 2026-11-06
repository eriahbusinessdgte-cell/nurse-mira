-- Fix: Supabase creates the auth user before applying app_metadata, so the
-- sign-up guard now checks a server-only invitation list instead.
create table public.pending_invites (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table public.pending_invites enable row level security;
revoke all on public.pending_invites from anon, authenticated;

create or replace function private.guard_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare admin_email text;
begin
  select value into admin_email from private.settings where key = 'bootstrap_admin_email';
  if lower(new.email) = lower(admin_email) then
    return new;
  end if;
  delete from public.pending_invites
   where email = lower(new.email) and created_at > now() - interval '1 hour';
  if found then
    return new;
  end if;
  raise exception 'Nurse Mira is invite-only. Ask your administrator for an invitation.';
end;
$$;
