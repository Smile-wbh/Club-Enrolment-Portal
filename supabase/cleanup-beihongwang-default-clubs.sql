-- One-time cleanup for default clubs/courses that were accidentally migrated
-- into the beihongwang132@gmail.com account.
--
-- What this removes:
--   - default club rows owned by beihongwang132@gmail.com
--   - default course rows owned by beihongwang132@gmail.com
--   - related bookings/favorites/comments that are deleted automatically
--     through existing foreign-key cascades where applicable
--
-- Safe scope:
--   - only affects the profile that matches beihongwang132@gmail.com
--   - only affects the known built-in default club/course slugs

begin;

with target_profile as (
  select id
  from public.profiles
  where lower(email) = 'beihongwang132@gmail.com'
  limit 1
),
default_course_slugs as (
  select unnest(array[
    'badminton-serve-fundamentals',
    'football-passing-basics',
    'swimming-breathing-and-stroke',
    'cycling-route-planning',
    'programming-html-css-foundations',
    'tennis-serve-and-rally-basics',
    'music-ensemble-rehearsal-skills',
    'running-endurance-rhythm',
    'basketball-shooting-and-spacing',
    'golf-swing-basics',
    'rugby-contact-and-shape',
    'handball-attack-defense-core',
    'gymnastics-core-movement-flexibility'
  ]::text[]) as slug
)
delete from public.courses
where owner_id in (select id from target_profile)
  and slug in (select slug from default_course_slugs);

with target_profile as (
  select id
  from public.profiles
  where lower(email) = 'beihongwang132@gmail.com'
  limit 1
),
default_club_slugs as (
  select unnest(array[
    'football',
    'badminton',
    'swimming',
    'cycling',
    'programming',
    'tennis',
    'music',
    'running',
    'basketball',
    'golf',
    'rugby',
    'handball',
    'gymnastics'
  ]::text[]) as slug
)
delete from public.clubs
where owner_id in (select id from target_profile)
  and slug in (select slug from default_club_slugs);

commit;

-- Optional verification after running:
-- select id, slug, name, owner_id
-- from public.clubs
-- where owner_id in (
--   select id from public.profiles where lower(email) = 'beihongwang132@gmail.com'
-- )
-- order by created_at desc;
