-- D-071: a student can attach a file's text to a tutor message ("summarize this PDF").
-- Kept with the message so follow-ups in the same chat ("make it shorter") still have it.
alter table public.messages
  add column attachment_name text check (char_length(attachment_name) <= 200),
  add column attachment_text text check (char_length(attachment_text) <= 20000);
