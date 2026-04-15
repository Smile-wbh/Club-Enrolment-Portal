-- Preflight / postflight checks for the pending 2026-04-14 release migrations.
-- Run this before and after the incremental migration set on an existing database.

select
  'clubs_structured_map_columns' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clubs'
      and column_name = 'place_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clubs'
      and column_name = 'formatted_address'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clubs'
      and column_name = 'lat'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clubs'
      and column_name = 'lng'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clubs'
      and column_name = 'map_source'
  ) as ok;

select
  'courses_map_link_column' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'map_link'
  ) as ok;

select
  'courses_structured_map_columns' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'place_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'formatted_address'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'lat'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'lng'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'courses'
      and column_name = 'map_source'
  ) as ok;

select
  'course_booking_rpcs' as check_name,
  count(*) = 2 as ok
from (
  select distinct proname
  from pg_proc p
  join pg_namespace n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and proname in ('get_course_booking_counts', 'create_course_booking')
) q;

select
  'support_auto_reply_rules_table' as check_name,
  to_regclass('public.support_auto_reply_rules') is not null as ok;

select
  'clubs_with_map_link_needing_manual_review' as check_name,
  count(*)::bigint as row_count
from public.clubs
where trim(coalesce(map_link, '')) <> ''
  and coalesce(nullif(to_jsonb(clubs)->>'place_id', ''), '') = ''
  and coalesce(nullif(to_jsonb(clubs)->>'formatted_address', ''), '') = ''
  and nullif(to_jsonb(clubs)->>'lat', '') is null
  and nullif(to_jsonb(clubs)->>'lng', '') is null;

select
  'courses_with_map_link_needing_manual_review' as check_name,
  count(*)::bigint as row_count
from public.courses
where trim(coalesce(map_link, '')) <> ''
  and coalesce(nullif(to_jsonb(courses)->>'place_id', ''), '') = ''
  and coalesce(nullif(to_jsonb(courses)->>'formatted_address', ''), '') = ''
  and nullif(to_jsonb(courses)->>'lat', '') is null
  and nullif(to_jsonb(courses)->>'lng', '') is null;
