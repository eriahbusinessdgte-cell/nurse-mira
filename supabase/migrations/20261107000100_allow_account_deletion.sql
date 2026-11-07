-- Phase 8 finding: deleting a student who uploaded shared reviewers failed ("Database error
-- deleting user"). Deleting the account clears documents.uploader_id (ON DELETE SET NULL) from
-- inside Supabase Auth, where nobody is signed in — and the guard treated that as a forbidden
-- change. The guard now lets exactly that through: uploader removed (set to empty) by the
-- system with no signed-in user. Everything else stays admin-only as before.
create or replace function private.guard_document_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) and coalesce((select auth.role()), '') <> 'service_role' then
    if new.uploader_id is distinct from old.uploader_id
       and not (new.uploader_id is null and (select auth.uid()) is null) then
      raise exception 'Only the administrator can change that.';
    end if;
    if new.allow_download is distinct from old.allow_download
       or new.status is distinct from old.status
       or new.sha256 is distinct from old.sha256
       or new.file_size is distinct from old.file_size then
      raise exception 'Only the administrator can change that.';
    end if;
  end if;
  if new.visibility = 'shared' and old.visibility = 'private' and not new.rights_confirmed then
    raise exception 'Please confirm you are allowed to share this document.';
  end if;
  return new;
end;
$$;
