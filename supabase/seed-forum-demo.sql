-- Demo forum data for spjs.html
-- Development/staging only. Do not run this in production once you have real community posts.
-- Run this after schema.sql and after at least one user account exists.

with owner as (
  select id
  from public.profiles
  order by created_at asc
  limit 1
),
target_titles as (
  select unnest(array[
    'I keep swallowing water during freestyle breathing. How can I fix it?',
    'Beginner doubles positioning: how should front and rear players coordinate?',
    'My Tennis forehand keeps flying long. How do I find the right contact point?',
    'Friday night 7v7 friendly: we need a few extra players',
    'Beginner Cycling pacing: do not sprint too early',
    'This week''s algorithm training: binary search and two pointers'
  ]::text[]) as title
),
deleted as (
  delete from public.forum_posts
  where title in (select title from target_titles)
  returning id
),
post_data(title, club_slug, post_type, author_name, content, channel, visibility, pinned, likes_count, created_offset_hours) as (
  values
    (
      'I keep swallowing water during freestyle breathing. How can I fix it?',
      'swimming',
      'Question',
      'Anonymous User',
      'During Swimming Club sessions I often lift my head too much when I breathe, which makes my hips sink and breaks the stroke. What drills or timing cues helped you build smoother freestyle breathing?',
      'Community',
      'public',
      false,
      8,
      42
    ),
    (
      'Beginner doubles positioning: how should front and rear players coordinate?',
      'badminton',
      'Tips & Experience',
      'bhw',
      'In Badminton doubles, one useful base shape is front pressure with rear attack. The back player sets up with smashes and drops while the front player looks for net interceptions and flat pressure. Simple rotation calls make this much easier.',
      'Community',
      'public',
      false,
      5,
      36
    ),
    (
      'My Tennis forehand keeps flying long. How do I find the right contact point?',
      'tennis',
      'Question',
      'Tennis Beginner',
      'I recently started working on my forehand in Tennis Club, and I often contact the ball too late. Are there any simple feeding drills or footwork cues that help you meet the ball farther in front?',
      'Community',
      'public',
      false,
      4,
      30
    ),
    (
      'Friday night 7v7 friendly: we need a few extra players',
      'football',
      'Event Sign-Up',
      'Football Captain',
      'The Football Club is hosting a Friday evening 7v7 friendly on the campus turf. Please bring shin guards and arrive early enough to warm up. Leave a comment with the position you usually play if you want a spot.',
      'Community',
      'public',
      true,
      9,
      24
    ),
    (
      'Beginner Cycling pacing: do not sprint too early',
      'cycling',
      'Tips & Experience',
      'Cycling Captain',
      'One of the best beginner lessons in Cycling Club is to hold a steady cadence instead of surging at the start. Smooth effort, hydration, and timely fueling matter a lot more than an early burst of speed.',
      'Community',
      'public',
      false,
      6,
      18
    ),
    (
      'This week''s algorithm training: binary search and two pointers',
      'programming',
      'Competition Updates',
      'Programming Club Admin',
      'This week the Programming club will focus on binary search and two-pointer patterns. Bring a representative problem or a clean template if you want to compare boundary handling and time complexity with others.',
      'Community',
      'public',
      false,
      3,
      12
    )
),
inserted_posts as (
  insert into public.forum_posts (
    author_id,
    author_name,
    club_id,
    title,
    post_type,
    content,
    channel,
    visibility,
    pinned,
    likes_count,
    created_at
  )
  select
    owner.id,
    post_data.author_name,
    clubs.id,
    post_data.title,
    post_data.post_type,
    post_data.content,
    post_data.channel,
    post_data.visibility,
    post_data.pinned,
    post_data.likes_count,
    now() - make_interval(hours => post_data.created_offset_hours)
  from post_data
  cross join owner
  left join public.clubs
    on clubs.slug = post_data.club_slug
  returning id, title
),
root_comments as (
  insert into public.forum_comments (
    post_id,
    author_id,
    author_name,
    content,
    likes_count,
    created_at
  )
  select
    inserted_posts.id,
    owner.id,
    comment_data.author_name,
    comment_data.content,
    comment_data.likes_count,
    now() - make_interval(hours => comment_data.created_offset_hours)
  from (
    values
      (
        'I keep swallowing water during freestyle breathing. How can I fix it?',
        'Swim Team Senior',
        'Rotate to the side instead of lifting the head. Single-arm freestyle and side-kick drills help a lot.',
        2,
        40
      ),
      (
        'Beginner doubles positioning: how should front and rear players coordinate?',
        'Anonymous User',
        'Rotations became much cleaner once my partner and I agreed on short verbal cues.',
        1,
        34
      ),
      (
        'My Tennis forehand keeps flying long. How do I find the right contact point?',
        'Coach A',
        'Set the feet first and let the contact happen in front of the body. Do not reach with the arm.',
        1,
        28
      ),
      (
        'Friday night 7v7 friendly: we need a few extra players',
        'Anonymous User',
        'I can play midfield. Should I bring a spare shirt?',
        0,
        22
      ),
      (
        'Beginner Cycling pacing: do not sprint too early',
        'Anonymous User',
        'Once I stopped grinding heavy gears, my legs felt far fresher on longer rides.',
        1,
        16
      ),
      (
        'This week''s algorithm training: binary search and two pointers',
        'bhw',
        'Binary search gets much easier when you commit to one interval convention and use it everywhere.',
        1,
        10
      )
  ) as comment_data(title, author_name, content, likes_count, created_offset_hours)
  join inserted_posts
    on inserted_posts.title = comment_data.title
  cross join owner
  returning id, post_id, content
)
insert into public.forum_comments (
  post_id,
  parent_comment_id,
  author_id,
  author_name,
  content,
  likes_count,
  created_at
)
select
  inserted_posts.id,
  root_comments.id,
  owner.id,
  'Anonymous User',
  'A steady breathing pattern at a slower pace helped me far more than trying to swim hard.',
  0,
  now() - interval '39 hours'
from inserted_posts
join root_comments
  on root_comments.post_id = inserted_posts.id
 and root_comments.content = 'Rotate to the side instead of lifting the head. Single-arm freestyle and side-kick drills help a lot.'
cross join owner
where inserted_posts.title = 'I keep swallowing water during freestyle breathing. How can I fix it?';
