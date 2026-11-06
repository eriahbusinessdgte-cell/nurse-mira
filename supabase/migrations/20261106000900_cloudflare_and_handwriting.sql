-- Cloudflare (free 10,000 "neurons" a day, resets 00:00 UTC): backup AI for the tutor + reading handwriting.
-- Usage is counted here so Nurse Mira never goes over the free allowance.
create table public.cloudflare_usage (
  day      date primary key,
  neurons  numeric not null default 0,
  pages    int not null default 0,
  answers  int not null default 0
);
alter table public.cloudflare_usage enable row level security;
create policy "cloudflare usage: admin reads" on public.cloudflare_usage for select to authenticated using ((select public.is_admin()));

create or replace function public.add_cloudflare_usage(p_neurons numeric, p_kind text)
returns numeric
language sql
security definer
set search_path = ''
as $$
  insert into public.cloudflare_usage as u (day, neurons, pages, answers)
  values ((now() at time zone 'utc')::date, greatest(p_neurons, 0),
          case when p_kind = 'page' then 1 else 0 end, case when p_kind = 'answer' then 1 else 0 end)
  on conflict (day) do update set
    neurons = u.neurons + excluded.neurons,
    pages = u.pages + excluded.pages,
    answers = u.answers + excluded.answers
  returning neurons;
$$;
revoke execute on function public.add_cloudflare_usage(numeric, text) from public, anon, authenticated;

-- Pages that still couldn't be read after an upload (shown with a "Read again" button).
alter table public.documents add column if not exists unreadable_pages int[] not null default '{}';

-- The admin may re-read any library document, which replaces its text pieces.
create policy "chunks: admin adds" on public.document_chunks for insert to authenticated
  with check ((select public.is_admin()) and (select public.is_active_user()));

-- More daily tutor answers now that there is a Cloudflare backup.
update public.app_settings set value = '90'::jsonb where key = 'daily_answer_pool';
