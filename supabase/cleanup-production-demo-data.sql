-- One-time cleanup for seed/demo content used during development.
-- Review the slug/title lists below before running this in production.
-- Only run this if you want to remove the demo clubs, demo courses, and demo forum posts
-- created by:
--   1. seed-booking-demo.sql
--   2. seed-course-demo.sql
--   3. seed-forum-demo.sql

begin;

with demo_course_slugs as (
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
where slug in (select slug from demo_course_slugs);

with demo_post_titles as (
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
where title in (select title from demo_post_titles);

with demo_club_slugs as (
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
where slug in (select slug from demo_club_slugs);

commit;
