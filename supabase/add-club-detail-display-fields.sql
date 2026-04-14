alter table if exists public.clubs
  add column if not exists weekly_highlight text,
  add column if not exists faq text;
