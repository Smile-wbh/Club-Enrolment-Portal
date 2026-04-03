-- Import the former hardcoded club list into the cloud account owned by
-- beihongwang132@gmail.com, then rely on Supabase instead of local page arrays.
-- Run this in Supabase SQL Editor after schema.sql.

do $$
begin
  if not exists (
    select 1
    from public.profiles
    where lower(trim(email)) = 'beihongwang132@gmail.com'
  ) then
    raise exception 'Profile for beihongwang132@gmail.com was not found. Please register this account first.';
  end if;
end
$$;

with owner as (
  select id
  from public.profiles
  where lower(trim(email)) = 'beihongwang132@gmail.com'
  limit 1
),
seed_clubs(
  slug,
  name,
  category,
  mode,
  location,
  time_text,
  fee_text,
  seats,
  cover_url,
  tags,
  description
) as (
  values
    (
      'football',
      'Football Club',
      'Sports',
      'In-person',
      'Stadium A (In-person)',
      'Tue/Thu 18:00-20:00',
      '£0 (Free)',
      12,
      '',
      array['Event Sign-up', 'Training Camp', 'Teamwork']::text[],
      'Weekly training and friendly matches for a range of skill levels, with pitch booking and event sign-up support.'
    ),
    (
      'badminton',
      'Badminton Club',
      'Sports',
      'In-person',
      'Indoor Hall B (In-person)',
      'Mon/Wed 19:00-21:00',
      '£3/session (Optional)',
      8,
      '',
      array['Campus Matches', 'Live Seats', 'Hot Club']::text[],
      'Multiple bookable slots with live seat updates, suitable for regular training and campus competitions.'
    ),
    (
      'swimming',
      'Swimming Club',
      'Sports',
      'In-person',
      'Aquatics Center (In-person)',
      'Sat 10:00-12:00',
      '£2/session',
      16,
      '../zp/yy1.webp',
      array['Level-based Training', 'Lane Booking', 'Beginner Friendly']::text[],
      'Stroke and endurance training for beginners through advanced swimmers, with lane-based session booking.'
    ),
    (
      'cycling',
      'Cycling Club',
      'Sports',
      'Hybrid',
      'Meeting point: Campus Gate (In-person) / group updates (Online)',
      'Sun 08:30-11:30',
      '£0',
      20,
      '../zp/qx.webp',
      array['Weekend Rides', 'Route Sharing', 'Outdoor Community']::text[],
      'City rides and weekend long-distance sessions with meet-up details and route plans shared ahead of time.'
    ),
    (
      'programming',
      'Programming Club',
      'Academic',
      'Online',
      'Online meeting link (Virtual)',
      'Fri 20:00-21:30',
      '£0',
      40,
      '../zp/bc.webp',
      array['Web Development', 'Python', 'Project Practice']::text[],
      'Learn Web, Python, and AI fundamentals while sharing projects in a beginner-to-advanced online space.'
    ),
    (
      'tennis',
      'Tennis Club',
      'Sports',
      'In-person',
      'Tennis Court C (In-person)',
      'Sat 14:00-16:00',
      '£2/session',
      10,
      '../zp/wq.webp',
      array['Doubles Training', 'Weekend Activities', 'Session Booking']::text[],
      'Doubles training and weekend activities with bookable sessions for members at different levels.'
    ),
    (
      'music',
      'Music Society',
      'Arts',
      'Hybrid',
      'Arts Building 2F / online sharing',
      'Wed 17:00-18:30',
      '£0',
      18,
      '../zp/yy.webp',
      array['Instrument Exchange', 'Ensemble Rehearsal', 'Performance Sign-up']::text[],
      'Instrument exchange, ensemble rehearsals, and performance sign-up with shared sheet music and rehearsal plans online.'
    ),
    (
      'running',
      'Running Club',
      'Sports',
      'In-person',
      'Track meeting point (In-person)',
      'Tue/Fri 07:00-08:00',
      '£0',
      30,
      '../zp/pb.webp',
      array['Morning Run Check-in', 'Road Running', 'Training Plan']::text[],
      'Weekly group runs and campus running events with activity sign-up and training plans.'
    ),
    (
      'basketball',
      'Basketball Club',
      'Sports',
      'In-person',
      'Basketball Court D (In-person)',
      'Wed/Sat 18:00-20:00',
      '£0 (Free)',
      18,
      '../zp/hb1.webp',
      array['League Sign-up', 'Tactical Training', 'Scrimmages']::text[],
      'Weekly practices and campus league sign-up with basic tactical coaching and scrimmages.'
    ),
    (
      'golf',
      'Golf Club',
      'Sports',
      'In-person',
      'Practice Ground E (In-person)',
      'Sat 09:00-11:00',
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
      'Tue/Thu 16:30-18:00',
      '£0',
      22,
      '../zp/hb3.webp',
      array['Inter-school Events', 'Tactical Drills', 'Strength Training']::text[],
      'Core passing and contact training with support for inter-school competition sign-up and tactical drills.'
    ),
    (
      'handball',
      'Handball Club',
      'Sports',
      'In-person',
      'Sports Hall G (In-person)',
      'Mon 18:30-20:00',
      '£0',
      16,
      '../zp/hb2.webp',
      array['Team Coordination', 'Grouped Practice', 'Event Sign-up']::text[],
      'Team coordination sessions and small-court games with grouped practice and event sign-up.'
    ),
    (
      'gymnastics',
      'Gymnastics Club',
      'Sports',
      'In-person',
      'Gym Hall H (In-person)',
      'Fri 17:00-18:30',
      '£0',
      14,
      '../zp/hb1.webp',
      array['Flexibility Training', 'Strength Growth', 'Movement Demonstration']::text[],
      'Foundational flexibility and strength training with movement demos and grouped practice for beginner to advanced members.'
    )
)
insert into public.clubs (
  slug,
  name,
  category,
  mode,
  location,
  time_text,
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
  seed_clubs.time_text,
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
  time_text = excluded.time_text,
  fee_text = excluded.fee_text,
  seats = excluded.seats,
  cover_url = excluded.cover_url,
  tags = excluded.tags,
  description = excluded.description,
  owner_id = excluded.owner_id,
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
