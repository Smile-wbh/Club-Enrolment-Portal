alter table if exists public.clubs
  add column if not exists place_id text,
  add column if not exists formatted_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists map_source text;

alter table if exists public.courses
  add column if not exists place_id text,
  add column if not exists formatted_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists map_source text;
