-- Nurse Mira's own server functions (service role) may update file details, e.g. when a stored
-- file is replaced with a smaller copy. Students still can't change these fields themselves.
create or replace function private.guard_document_update()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not (select public.is_admin()) and coalesce((select auth.role()), '') <> 'service_role' then
    if new.allow_download is distinct from old.allow_download
       or new.status is distinct from old.status
       or new.uploader_id is distinct from old.uploader_id
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
$function$;
