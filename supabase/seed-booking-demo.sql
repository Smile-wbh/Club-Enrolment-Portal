-- Demo booking data for specialty.html
-- Development/staging only. Do not run this in production once you have real clubs.
-- Run this after schema.sql and after at least one user account has been created.

with owner as (
  select id
  from public.profiles
  order by created_at asc
  limit 1
),
seed_clubs(slug, name, category, mode, location, fee_text, seats, cover_url, tags, description) as (
  values
    (
      'football',
      'Football Club',
      'Sports',
      'In-person',
      'Stadium A (In-person)',
      '£0 (Free)',
      12,
      '../zp/zq.webp',
      array['Tactical Training', 'Event Sign-up', 'Teamwork']::text[],
      'Weekly football training and match preparation for new and returning members.'
    ),
    (
      'badminton',
      'Badminton Club',
      'Sports',
      'In-person',
      'Indoor Hall B (In-person)',
      '£3/session (Optional)',
      8,
      '../zp/ymq.webp',
      array['Doubles Training', 'Daily Practice', 'Campus Matches']::text[],
      'Flexible badminton sessions covering doubles practice, casual games, and club match play.'
    ),
    (
      'swimming',
      'Swimming Club',
      'Sports',
      'In-person',
      'Aquatics Center (In-person)',
      '£2/session',
      16,
      '../zp/yy1.webp',
      array['Grouped Training', 'Fitness Growth', 'Safety Coaching']::text[],
      'Structured swimming sessions combining fitness training, safety guidance, and technique support.'
    ),
    (
      'cycling',
      'Cycling Club',
      'Sports',
      'Hybrid',
      'Meeting point: Campus Gate (In-person) / group updates (Online)',
      '£0',
      20,
      '../zp/qx.webp',
      array['City Rides', 'Route Sharing', 'Gear Exchange']::text[],
      'Group city rides and route planning sessions with flexible hybrid updates for members.'
    ),
    (
      'programming',
      'Programming Club',
      'Academic',
      'Online',
      'Online meeting link (Virtual)',
      '£0',
      40,
      '../zp/bc.webp',
      array['Web Development', 'Python', 'Project Practice']::text[],
      'Project-driven coding workshops focused on web development, Python, and collaborative practice.'
    ),
    (
      'tennis',
      'Tennis Club',
      'Sports',
      'In-person',
      'Tennis Court C (In-person)',
      '£2/session',
      10,
      '../zp/wq.webp',
      array['Serve Training', 'Weekend Activities', 'Beginner Welcome']::text[],
      'Serve practice, weekend rallies, and welcoming tennis sessions for beginners and regular players.'
    ),
    (
      'music',
      'Music Society',
      'Arts',
      'Hybrid',
      'Arts Building 2F / online sharing',
      '£0',
      18,
      '../zp/yy.webp',
      array['Ensemble Rehearsal', 'Stage Showcases', 'Recording Sharing']::text[],
      'Hybrid rehearsal and showcase sessions for ensemble practice, recording, and performance prep.'
    ),
    (
      'running',
      'Running Club',
      'Sports',
      'In-person',
      'Track meeting point (In-person)',
      '£0',
      30,
      '../zp/pb.webp',
      array['Morning Check-in', 'Endurance Growth', 'Pacing Training']::text[],
      'Endurance-building runs and pacing sessions for members who want a steady training routine.'
    ),
    (
      'basketball',
      'Basketball Club',
      'Sports',
      'In-person',
      'Basketball Court D (In-person)',
      '£0 (Free)',
      18,
      '../zp/hb1.webp',
      array['Half-court Games', 'Shooting Practice', 'Teamwork']::text[],
      'Basketball practice sessions with shooting drills, teamwork drills, and half-court games.'
    ),
    (
      'golf',
      'Golf Club',
      'Sports',
      'In-person',
      'Practice Ground E (In-person)',
      '£5/session (Optional)',
      12,
      '../zp/hb2.webp',
      array['Swing Practice', 'Weekend Experience', 'Beginner Welcome']::text[],
      'Golf practice sessions focused on swing basics, weekend experience rounds, and beginner support.'
    ),
    (
      'rugby',
      'Rugby Club',
      'Sports',
      'In-person',
      'Stadium F (In-person)',
      '£0',
      22,
      '../zp/hb3.webp',
      array['Inter-school Events', 'Tactical Drills', 'Strength Training']::text[],
      'Rugby club sessions with tactical drills, strength work, and preparation for external fixtures.'
    ),
    (
      'handball',
      'Handball Club',
      'Sports',
      'In-person',
      'Sports Hall G (In-person)',
      '£0',
      16,
      '../zp/hb2.webp',
      array['Attack and Defense', 'Core Coordination', 'Training Camp']::text[],
      'Handball training centered on attack and defense structure, movement coordination, and team drills.'
    ),
    (
      'gymnastics',
      'Gymnastics Club',
      'Sports',
      'In-person',
      'Gym Hall H (In-person)',
      '£0',
      14,
      '../zp/hb1.webp',
      array['Core Movements', 'Flexibility Training', 'Open Class']::text[],
      'Gymnastics classes focused on flexibility, core movement patterns, and guided open practice.'
    )
)
insert into public.clubs (
  slug,
  name,
  category,
  mode,
  location,
  fee_text,
  seats,
  cover_url,
  tags,
  description,
  owner_id,
  status
)
select
  seed_clubs.slug,
  seed_clubs.name,
  seed_clubs.category,
  seed_clubs.mode,
  seed_clubs.location,
  seed_clubs.fee_text,
  seed_clubs.seats,
  seed_clubs.cover_url,
  seed_clubs.tags,
  seed_clubs.description,
  owner.id,
  'approved'::public.club_status
from seed_clubs
cross join owner
on conflict (slug) do update
set
  name = excluded.name,
  category = excluded.category,
  mode = excluded.mode,
  location = excluded.location,
  fee_text = excluded.fee_text,
  seats = excluded.seats,
  cover_url = excluded.cover_url,
  tags = excluded.tags,
  description = excluded.description,
  status = 'approved'::public.club_status;

with target_clubs as (
  select id, slug, seats
  from public.clubs
  where slug in (
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
  )
),
days as (
  select (current_date + offset_day)::date as day_iso
  from generate_series(0, 13) as offset_day
),
slot_templates as (
  select
    target_clubs.slug,
    make_time(hour_slot, 0, 0) as start_time,
    make_time(hour_slot + 1, 0, 0) as end_time,
    target_clubs.seats as capacity
  from target_clubs
  cross join generate_series(9, 20) as hour_slot
)
insert into public.club_slots (
  club_id,
  day_iso,
  day_label,
  start_time,
  end_time,
  capacity,
  status
)
select
  target_clubs.id,
  days.day_iso,
  to_char(days.day_iso, 'YYYY-MM-DD'),
  slot_templates.start_time,
  slot_templates.end_time,
  slot_templates.capacity,
  'open'
from target_clubs
join slot_templates
  on slot_templates.slug = target_clubs.slug
cross join days
on conflict (club_id, day_iso, start_time, end_time) do update
set
  day_label = excluded.day_label,
  capacity = excluded.capacity,
  status = excluded.status;
