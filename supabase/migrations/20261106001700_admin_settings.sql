-- Admin Settings page: the daily page-reading allowance becomes a setting,
-- the unused fixed daily limit (replaced by the fair share, D-033) is removed,
-- and settings record when they were last changed.
insert into public.app_settings (key, value) values ('page_reading_budget', '6500'::jsonb)
  on conflict (key) do nothing;
delete from public.app_settings where key = 'daily_answer_limit';

create or replace trigger app_settings_touch before update on public.app_settings
  for each row execute function private.touch_updated_at();
