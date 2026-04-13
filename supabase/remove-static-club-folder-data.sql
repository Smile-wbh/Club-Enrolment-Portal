-- Remove legacy static club-folder demo content from Supabase.
-- Review the slug/title lists below before running in production.
--
-- What this removes:
--   - clubs that matched the old html/club/*.html static pages
--   - related demo courses tied to those legacy club examples
--   - related demo forum posts that referenced those same examples
--
-- Notes:
--   - deleting clubs will cascade to club slots, club memberships, and club bookings
--   - courses and forum posts are deleted explicitly because their club_id uses SET NULL

begin;

with static_course_slugs as (
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
where slug in (select slug from static_course_slugs);

with static_post_titles as (
  select unnest(array[
    'I keep swallowing water during freestyle breathing. How can I fix it?',
    'Beginner doubles positioning: how should front and rear players coordinate?',
    'My Tennis forehand keeps flying long. How do I find the right contact point?',
    'Friday night 7v7 friendly: we need a few extra players',
    'Beginner Cycling pacing: do not sprint too early',
    'This week''s algorithm training: binary search and two pointers'
  ]::text[]) as title
)
delete from public.forum_posts
where title in (select title from static_post_titles);

with static_club_slugs as (
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
    'gymnastics',
    'pingpong',
    'volleyball',
    'pickleball',
    'baseball'
  ]::text[]) as slug
)
delete from public.clubs
where slug in (select slug from static_club_slugs);

commit;
