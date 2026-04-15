alter table if exists public.courses
add column if not exists map_link text;
