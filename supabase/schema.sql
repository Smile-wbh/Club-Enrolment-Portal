-- Initial Supabase schema for Club Enrolment Portal.
-- Run this in the Supabase SQL editor, then migrate page logic gradually.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('member', 'club_manager', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'club_status') then
    create type public.club_status as enum ('pending', 'approved', 'inactive', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type public.booking_status as enum (
      'pending_payment',
      'booked',
      'checked_in',
      'completed',
      'cancelled',
      'no_show'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
  end if;

  if not exists (select 1 from pg_type where typname = 'support_status') then
    create type public.support_status as enum ('open', 'waiting_reply', 'resolved', 'closed');
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  nickname text not null,
  role public.app_role not null default 'member',
  avatar_url text,
  forum_cover_url text,
  bio text,
  gender text,
  phone text,
  birthday date,
  location text,
  hobbies text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists forum_cover_url text;

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_system text not null default 'user',
  login_at timestamptz not null default now(),
  ip_address inet,
  user_agent text
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text,
  mode text,
  location text,
  map_link text,
  place_id text,
  formatted_address text,
  lat double precision,
  lng double precision,
  map_source text,
  online_link text,
  time_text text,
  fee_text text not null default '£0',
  seats integer check (seats is null or seats >= 0),
  cover_url text,
  tags text[] not null default array[]::text[],
  description text,
  hero_sub text,
  venue_info text,
  what_we_do text,
  audience text,
  training_plan text,
  notes text,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  status public.club_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_slots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  day_iso date not null,
  day_label text,
  start_time time not null,
  end_time time not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, day_iso, start_time, end_time)
);

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  member_name text not null,
  user_email text,
  member_role text not null default 'member',
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table if not exists public.club_bookings (
  id uuid primary key default gen_random_uuid(),
  order_id text unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  slot_id uuid not null references public.club_slots(id) on delete cascade,
  status public.booking_status not null default 'pending_payment',
  payment_status public.payment_status not null default 'pending',
  day_iso date not null,
  day_label text,
  slot_time text,
  location text,
  fee_text text not null default '£0',
  base_fee numeric(10, 2) not null default 0,
  service_fee numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  payable_amount numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  club_id uuid references public.clubs(id) on delete set null,
  title text not null,
  english_club text,
  level text,
  mode text,
  time_text text,
  schedule text[] not null default array[]::text[],
  location text,
  map_link text,
  place_id text,
  formatted_address text,
  lat double precision,
  lng double precision,
  map_source text,
  seats integer check (seats is null or seats >= 0),
  fee_text text not null default 'Free',
  cover_url text,
  description text,
  lead text,
  detail text,
  coach_name text,
  coach_title text,
  coach_bio text,
  learning_points text[] not null default array[]::text[],
  audience_tips text[] not null default array[]::text[],
  notes_list text[] not null default array[]::text[],
  owner_id uuid not null references public.profiles(id) on delete restrict,
  popularity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'booked',
  selected_schedule text,
  booked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

alter table public.course_bookings add column if not exists selected_schedule text;
alter table public.course_bookings add column if not exists cancelled_at timestamptz;

create table if not exists public.course_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_avatar_url text,
  club_id uuid references public.clubs(id) on delete set null,
  title text,
  post_type text not null default 'Tips & Experience',
  content text,
  channel text not null default 'Community',
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'friends', 'private')),
  pinned boolean not null default false,
  image_urls text[] not null default array[]::text[],
  video_url text,
  video_name text,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.forum_posts(id) on delete cascade,
  parent_comment_id uuid references public.forum_comments(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_avatar_url text,
  content text not null,
  image_url text,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forum_comments add column if not exists image_url text;
alter table public.forum_posts drop constraint if exists forum_posts_visibility_check;
alter table public.forum_posts
  add constraint forum_posts_visibility_check
  check (visibility in ('public', 'followers', 'friends', 'private'));

create table if not exists public.support_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null default 'Support Request',
  category text,
  status public.support_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  sender_role text not null default 'user',
  sender_name text,
  message_text text not null,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.support_auto_reply_rules (
  id uuid primary key default gen_random_uuid(),
  rule_name text not null unique,
  keywords text[] not null default '{}'::text[],
  response_text text not null,
  priority integer not null default 100,
  requires_human boolean not null default false,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_board_entries (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  target_email text,
  target_name text,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  from_email text,
  from_name text,
  source text not null default 'forum-profile',
  message_text text not null,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('portal-media', 'portal-media', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'member'::public.app_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin'::public.app_role;
$$;

create or replace function public.owns_club(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clubs
    where id = target_club_id
      and owner_id = auth.uid()
  );
$$;

create or replace function public.owns_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.courses
    where id = target_course_id
      and (
        owner_id = auth.uid()
        or public.owns_club(club_id)
      )
  );
$$;

create or replace function public.create_message_board_entry(
  p_target_email text default null,
  p_target_name text default null,
  p_message_text text default null,
  p_source text default 'forum-profile'
)
returns public.message_board_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_entry public.message_board_entries%rowtype;
  v_message text;
  v_source text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_sender
  from public.profiles
  where id = auth.uid()
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if nullif(trim(coalesce(p_target_email, '')), '') is not null then
    select *
    into v_target
    from public.profiles
    where lower(coalesce(email, '')) = lower(trim(p_target_email))
    limit 1;
  end if;

  if not found and nullif(trim(coalesce(p_target_name, '')), '') is not null then
    select *
    into v_target
    from public.profiles
    where lower(trim(nickname)) = lower(trim(p_target_name))
    order by created_at asc
    limit 1;
  end if;

  if not found then
    raise exception 'message_target_not_found';
  end if;

  if v_target.id = auth.uid() then
    raise exception 'self_message_not_allowed';
  end if;

  v_message := nullif(trim(coalesce(p_message_text, '')), '');
  if v_message is null then
    raise exception 'missing_message_text';
  end if;

  v_source := nullif(trim(coalesce(p_source, '')), '');
  if v_source is null then
    v_source := 'forum-profile';
  end if;

  insert into public.message_board_entries (
    target_user_id,
    target_email,
    target_name,
    from_user_id,
    from_email,
    from_name,
    source,
    message_text
  )
  values (
    v_target.id,
    lower(coalesce(v_target.email, nullif(trim(coalesce(p_target_email, '')), ''))),
    coalesce(nullif(trim(v_target.nickname), ''), nullif(trim(coalesce(p_target_name, '')), ''), split_part(coalesce(v_target.email, ''), '@', 1), 'User'),
    auth.uid(),
    lower(coalesce(v_sender.email, '')),
    coalesce(nullif(trim(v_sender.nickname), ''), split_part(coalesce(v_sender.email, ''), '@', 1), 'User'),
    v_source,
    v_message
  )
  returning *
  into v_entry;

  return v_entry;
end;
$$;

create or replace function public.create_message_board_entry_by_user(
  p_target_user_id uuid,
  p_target_name text default null,
  p_message_text text default null,
  p_source text default 'forum-profile'
)
returns public.message_board_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender public.profiles%rowtype;
  v_target public.profiles%rowtype;
  v_entry public.message_board_entries%rowtype;
  v_message text;
  v_source text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_sender
  from public.profiles
  where id = auth.uid()
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select *
  into v_target
  from public.profiles
  where id = p_target_user_id
  limit 1;

  if not found then
    raise exception 'message_target_not_found';
  end if;

  if v_target.id = auth.uid() then
    raise exception 'self_message_not_allowed';
  end if;

  v_message := nullif(trim(coalesce(p_message_text, '')), '');
  if v_message is null then
    raise exception 'missing_message_text';
  end if;

  v_source := nullif(trim(coalesce(p_source, '')), '');
  if v_source is null then
    v_source := 'forum-profile';
  end if;

  insert into public.message_board_entries (
    target_user_id,
    target_email,
    target_name,
    from_user_id,
    from_email,
    from_name,
    source,
    message_text
  )
  values (
    v_target.id,
    lower(coalesce(v_target.email, null)),
    coalesce(nullif(trim(v_target.nickname), ''), nullif(trim(coalesce(p_target_name, '')), ''), split_part(coalesce(v_target.email, ''), '@', 1), 'User'),
    auth.uid(),
    lower(coalesce(v_sender.email, '')),
    coalesce(nullif(trim(v_sender.nickname), ''), split_part(coalesce(v_sender.email, ''), '@', 1), 'User'),
    v_source,
    v_message
  )
  returning *
  into v_entry;

  return v_entry;
end;
$$;

create or replace function public.get_forum_profile_summary(
  p_author_id uuid default null,
  p_nickname text default null
)
returns table (
  id uuid,
  nickname text,
  avatar_url text,
  forum_cover_url text
)
language sql
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.nickname,
    profiles.avatar_url,
    profiles.forum_cover_url
  from public.profiles
  where
    (p_author_id is not null and profiles.id = p_author_id)
    or (
      p_author_id is null
      and nullif(trim(coalesce(p_nickname, '')), '') is not null
      and lower(profiles.nickname) = lower(trim(p_nickname))
    )
  order by
    case
      when p_author_id is not null and profiles.id = p_author_id then 0
      else 1
    end,
    profiles.created_at asc
  limit 1;
$$;

create or replace function public.get_club_booking_availability(
  p_start_date date default current_date,
  p_end_date date default (current_date + 6)
)
returns table (
  slot_id uuid,
  day_iso date,
  booked_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id as slot_id,
    s.day_iso,
    count(b.id)::bigint as booked_count
  from public.club_slots s
  join public.clubs c
    on c.id = s.club_id
  left join public.club_bookings b
    on b.slot_id = s.id
   and b.status <> 'cancelled'
  where s.day_iso between coalesce(p_start_date, current_date) and coalesce(p_end_date, coalesce(p_start_date, current_date) + 6)
    and (
      c.status = 'approved'
      or c.owner_id = auth.uid()
      or public.is_admin()
    )
  group by s.id, s.day_iso;
$$;

create or replace function public.create_club_booking(
  p_order_id text,
  p_club_id uuid,
  p_slot_id uuid,
  p_location text default null,
  p_fee_text text default '£0',
  p_base_fee numeric default 0,
  p_service_fee numeric default 0,
  p_discount numeric default 0,
  p_payable_amount numeric default 0
)
returns public.club_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.club_slots%rowtype;
  v_club public.clubs%rowtype;
  v_booking public.club_bookings%rowtype;
  v_slot_time text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if trim(coalesce(p_order_id, '')) = '' then
    raise exception 'missing_order_id';
  end if;

  select *
  into v_booking
  from public.club_bookings
  where order_id = trim(p_order_id)
  limit 1;

  if found then
    return v_booking;
  end if;

  select *
  into v_slot
  from public.club_slots
  where id = p_slot_id
  for update;

  if not found then
    raise exception 'slot_not_found';
  end if;

  select *
  into v_club
  from public.clubs
  where id = p_club_id
  limit 1;

  if not found then
    raise exception 'club_not_found';
  end if;

  if v_slot.club_id <> p_club_id then
    raise exception 'slot_club_mismatch';
  end if;

  if v_club.status <> 'approved' and v_club.owner_id <> auth.uid() and not public.is_admin() then
    raise exception 'club_not_bookable';
  end if;

  if v_slot.day_iso < current_date then
    raise exception 'slot_expired';
  end if;

  v_slot_time := to_char(v_slot.start_time, 'HH24:MI') || '-' || to_char(v_slot.end_time, 'HH24:MI');

  select *
  into v_booking
  from public.club_bookings
  where user_id = auth.uid()
    and slot_id = p_slot_id
    and status <> 'cancelled'
  order by created_at desc
  limit 1;

  if found then
    return v_booking;
  end if;

  if exists (
    select 1
    from public.club_bookings
    where user_id = auth.uid()
      and day_iso = v_slot.day_iso
      and slot_time = v_slot_time
      and status <> 'cancelled'
  ) then
    raise exception 'slot_conflict';
  end if;

  if (
    select count(*)
    from public.club_bookings
    where slot_id = p_slot_id
      and status <> 'cancelled'
  ) >= v_slot.capacity then
    raise exception 'slot_full';
  end if;

  insert into public.club_bookings (
    order_id,
    user_id,
    club_id,
    slot_id,
    status,
    payment_status,
    day_iso,
    day_label,
    slot_time,
    location,
    fee_text,
    base_fee,
    service_fee,
    discount,
    payable_amount
  )
  values (
    trim(p_order_id),
    auth.uid(),
    p_club_id,
    p_slot_id,
    'booked'::public.booking_status,
    'paid'::public.payment_status,
    v_slot.day_iso,
    trim(to_char(v_slot.day_iso, 'YYYY-MM-DD')),
    v_slot_time,
    coalesce(nullif(trim(p_location), ''), v_club.location),
    coalesce(nullif(trim(p_fee_text), ''), v_club.fee_text),
    coalesce(p_base_fee, 0),
    coalesce(p_service_fee, 0),
    greatest(coalesce(p_discount, 0), 0),
    greatest(coalesce(p_payable_amount, 0), 0)
  )
  returning *
  into v_booking;

  return v_booking;
end;
$$;

create or replace function public.get_course_booking_counts(
  p_course_ids uuid[] default null
)
returns table (
  course_id uuid,
  booked_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id as course_id,
    count(b.id)::bigint as booked_count
  from public.courses c
  left join public.course_bookings b
    on b.course_id = c.id
   and b.status <> 'cancelled'
  where (
    p_course_ids is null
    or c.id = any(p_course_ids)
  )
    and (
      c.club_id is null
      or exists (
        select 1
        from public.clubs club
        where club.id = c.club_id
          and (
            club.status = 'approved'
            or club.owner_id = auth.uid()
            or public.is_admin()
          )
      )
      or c.owner_id = auth.uid()
      or public.is_admin()
    )
  group by c.id;
$$;

create or replace function public.create_course_booking(
  p_course_id uuid,
  p_selected_schedule text default null
)
returns public.course_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_course public.courses%rowtype;
  v_booking public.course_bookings%rowtype;
  v_selected_schedule text;
  v_active_count bigint;
  v_schedule_count integer;
  v_total_capacity integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_course
  from public.courses
  where id = p_course_id
  for update;

  if not found then
    raise exception 'course_not_found';
  end if;

  if not (
    v_course.club_id is null
    or v_course.owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1
      from public.clubs club
      where club.id = v_course.club_id
        and (
          club.status = 'approved'
          or club.owner_id = auth.uid()
          or public.is_admin()
        )
    )
  ) then
    raise exception 'course_not_bookable';
  end if;

  v_selected_schedule := trim(coalesce(p_selected_schedule, ''));
  if v_selected_schedule = '' then
    v_selected_schedule := coalesce(
      nullif(trim(v_course.time_text), ''),
      nullif(trim(coalesce(v_course.schedule[1], '')), ''),
      'Time TBD'
    );
  end if;

  select *
  into v_booking
  from public.course_bookings
  where user_id = auth.uid()
    and course_id = p_course_id
    and coalesce(selected_schedule, '') = coalesce(v_selected_schedule, '')
    and status <> 'cancelled'
  order by booked_at desc
  limit 1;

  if found then
    return v_booking;
  end if;

  if coalesce(v_course.seats, 0) > 0 then
    v_schedule_count := greatest(
      coalesce(array_length(v_course.schedule, 1), 0),
      case when trim(coalesce(v_course.time_text, '')) <> '' then 1 else 0 end,
      1
    );
    v_total_capacity := greatest(coalesce(v_course.seats, 0), 0) * v_schedule_count;

    select count(*)
    into v_active_count
    from public.course_bookings
    where course_id = p_course_id
      and status <> 'cancelled';

    if v_active_count >= v_total_capacity then
      raise exception 'course_full';
    end if;
  end if;

  insert into public.course_bookings (
    user_id,
    course_id,
    status,
    selected_schedule
  )
  values (
    auth.uid(),
    p_course_id,
    'booked',
    v_selected_schedule
  )
  returning *
  into v_booking;

  return v_booking;
end;
$$;

create or replace function public.create_forum_post(
  p_title text default null,
  p_post_type text default 'Question',
  p_content text default null,
  p_channel text default 'Community',
  p_visibility text default 'public',
  p_pinned boolean default false,
  p_image_urls text[] default array[]::text[],
  p_video_url text default null,
  p_video_name text default null,
  p_club_id uuid default null
)
returns public.forum_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_post public.forum_posts%rowtype;
  v_title text;
  v_content text;
  v_visibility text;
  v_channel text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  v_content := nullif(trim(coalesce(p_content, '')), '');
  v_title := nullif(trim(coalesce(p_title, '')), '');
  if v_title is null and v_content is not null then
    v_title := left(v_content, 80);
  end if;

  if v_content is null and coalesce(array_length(p_image_urls, 1), 0) = 0 and nullif(trim(coalesce(p_video_url, '')), '') is null then
    raise exception 'missing_post_content';
  end if;

  v_visibility := lower(trim(coalesce(p_visibility, 'public')));
  if v_visibility not in ('public', 'followers', 'friends', 'private') then
    v_visibility := 'public';
  end if;

  v_channel := case
    when nullif(trim(coalesce(p_video_url, '')), '') is not null then 'Video'
    when lower(trim(coalesce(p_channel, 'community'))) in ('video', 'videos') then 'Video'
    else 'Community'
  end;

  insert into public.forum_posts (
    author_id,
    author_name,
    author_avatar_url,
    club_id,
    title,
    post_type,
    content,
    channel,
    visibility,
    pinned,
    image_urls,
    video_url,
    video_name
  )
  values (
    auth.uid(),
    coalesce(nullif(trim(v_profile.nickname), ''), split_part(coalesce(v_profile.email, ''), '@', 1), 'User'),
    nullif(trim(v_profile.avatar_url), ''),
    p_club_id,
    v_title,
    coalesce(nullif(trim(p_post_type), ''), 'Question'),
    coalesce(v_content, ''),
    v_channel,
    v_visibility,
    coalesce(p_pinned, false),
    coalesce(p_image_urls, array[]::text[]),
    nullif(trim(coalesce(p_video_url, '')), ''),
    nullif(trim(coalesce(p_video_name, '')), '')
  )
  returning *
  into v_post;

  return v_post;
end;
$$;

create or replace function public.create_forum_comment(
  p_post_id uuid,
  p_parent_comment_id uuid default null,
  p_content text default null,
  p_image_url text default null
)
returns public.forum_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_post public.forum_posts%rowtype;
  v_parent public.forum_comments%rowtype;
  v_comment public.forum_comments%rowtype;
  v_content text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select *
  into v_post
  from public.forum_posts
  where id = p_post_id
  limit 1;

  if not found then
    raise exception 'post_not_found';
  end if;

  if p_parent_comment_id is not null then
    select *
    into v_parent
    from public.forum_comments
    where id = p_parent_comment_id
    limit 1;

    if not found then
      raise exception 'comment_not_found';
    end if;

    if v_parent.post_id <> p_post_id then
      raise exception 'comment_post_mismatch';
    end if;
  end if;

  v_content := nullif(trim(coalesce(p_content, '')), '');
  if v_content is null and nullif(trim(coalesce(p_image_url, '')), '') is null then
    raise exception 'missing_comment_content';
  end if;

  insert into public.forum_comments (
    post_id,
    parent_comment_id,
    author_id,
    author_name,
    author_avatar_url,
    content,
    image_url
  )
  values (
    p_post_id,
    p_parent_comment_id,
    auth.uid(),
    coalesce(nullif(trim(v_profile.nickname), ''), split_part(coalesce(v_profile.email, ''), '@', 1), 'User'),
    nullif(trim(v_profile.avatar_url), ''),
    coalesce(v_content, ''),
    nullif(trim(coalesce(p_image_url, '')), '')
  )
  returning *
  into v_comment;

  return v_comment;
end;
$$;

create or replace function public.like_forum_post(
  p_post_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_likes integer;
begin
  update public.forum_posts
  set likes_count = coalesce(likes_count, 0) + 1
  where id = p_post_id
  returning likes_count
  into v_likes;

  if v_likes is null then
    raise exception 'post_not_found';
  end if;

  return v_likes;
end;
$$;

create or replace function public.like_forum_comment(
  p_comment_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_likes integer;
begin
  update public.forum_comments
  set likes_count = coalesce(likes_count, 0) + 1
  where id = p_comment_id
  returning likes_count
  into v_likes;

  if v_likes is null then
    raise exception 'comment_not_found';
  end if;

  return v_likes;
end;
$$;

grant execute on function public.create_forum_post(text, text, text, text, text, boolean, text[], text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.create_forum_comment(uuid, uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.like_forum_post(uuid) to anon, authenticated, service_role;
grant execute on function public.like_forum_comment(uuid) to anon, authenticated, service_role;
grant execute on function public.create_message_board_entry(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.create_message_board_entry_by_user(uuid, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_forum_profile_summary(uuid, text) to anon, authenticated, service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data ->> 'role', 'member'));

  insert into public.profiles (
    id,
    email,
    nickname,
    role
  )
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'member'
    ),
    case
      when requested_role = 'club_manager' then 'club_manager'::public.app_role
      else 'member'::public.app_role
    end
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create index if not exists idx_login_events_user_id on public.login_events(user_id, login_at desc);
create index if not exists idx_clubs_owner_status on public.clubs(owner_id, status);
create index if not exists idx_club_slots_club_day on public.club_slots(club_id, day_iso);
create index if not exists idx_club_members_club on public.club_members(club_id);
create index if not exists idx_club_bookings_user_created on public.club_bookings(user_id, created_at desc);
create index if not exists idx_club_bookings_club_slot on public.club_bookings(club_id, slot_id, status);
create unique index if not exists idx_club_bookings_user_slot_active on public.club_bookings(user_id, slot_id) where status <> 'cancelled';
create index if not exists idx_courses_club_created on public.courses(club_id, created_at desc);
create index if not exists idx_course_bookings_user_created on public.course_bookings(user_id, booked_at desc);
create index if not exists idx_course_bookings_course_status on public.course_bookings(course_id, status);
create index if not exists idx_forum_posts_created on public.forum_posts(created_at desc);
create index if not exists idx_forum_comments_post_created on public.forum_comments(post_id, created_at desc);
create index if not exists idx_support_threads_user_created on public.support_threads(user_id, created_at desc);
create index if not exists idx_support_messages_thread_created on public.support_messages(thread_id, created_at);
create index if not exists idx_support_auto_reply_rules_active_priority on public.support_auto_reply_rules(is_active, priority, created_at);
create index if not exists idx_message_board_entries_target_created on public.message_board_entries(target_user_id, created_at desc);
create index if not exists idx_message_board_entries_sender_created on public.message_board_entries(from_user_id, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_clubs_updated_at on public.clubs;
create trigger set_clubs_updated_at
before update on public.clubs
for each row execute function public.set_updated_at();

drop trigger if exists set_club_slots_updated_at on public.club_slots;
create trigger set_club_slots_updated_at
before update on public.club_slots
for each row execute function public.set_updated_at();

drop trigger if exists set_club_bookings_updated_at on public.club_bookings;
create trigger set_club_bookings_updated_at
before update on public.club_bookings
for each row execute function public.set_updated_at();

alter table public.club_bookings drop constraint if exists club_bookings_user_id_slot_id_key;

create unique index if not exists idx_course_bookings_user_course_schedule_active
on public.course_bookings(user_id, course_id, (coalesce(selected_schedule, ''::text)))
where status <> 'cancelled';

drop trigger if exists set_courses_updated_at on public.courses;
create trigger set_courses_updated_at
before update on public.courses
for each row execute function public.set_updated_at();

drop trigger if exists set_forum_posts_updated_at on public.forum_posts;
create trigger set_forum_posts_updated_at
before update on public.forum_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_forum_comments_updated_at on public.forum_comments;
create trigger set_forum_comments_updated_at
before update on public.forum_comments
for each row execute function public.set_updated_at();

drop trigger if exists set_support_threads_updated_at on public.support_threads;
create trigger set_support_threads_updated_at
before update on public.support_threads
for each row execute function public.set_updated_at();

drop trigger if exists set_support_auto_reply_rules_updated_at on public.support_auto_reply_rules;
create trigger set_support_auto_reply_rules_updated_at
before update on public.support_auto_reply_rules
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.login_events enable row level security;
alter table public.clubs enable row level security;
alter table public.club_slots enable row level security;
alter table public.club_members enable row level security;
alter table public.club_bookings enable row level security;
alter table public.courses enable row level security;
alter table public.course_bookings enable row level security;
alter table public.course_favorites enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_comments enable row level security;
alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_auto_reply_rules enable row level security;
alter table public.message_board_entries enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own_or_admin" on public.profiles;
create policy "profiles_insert_own_or_admin"
on public.profiles
for insert
to authenticated
with check (id = auth.uid() or public.is_admin());

drop policy if exists "login_events_select_own_or_admin" on public.login_events;
create policy "login_events_select_own_or_admin"
on public.login_events
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "login_events_insert_own_or_admin" on public.login_events;
create policy "login_events_insert_own_or_admin"
on public.login_events
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "clubs_select_public_or_owner" on public.clubs;
create policy "clubs_select_public_or_owner"
on public.clubs
for select
to anon, authenticated
using (
  status = 'approved'
  or owner_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "clubs_insert_owner_or_admin" on public.clubs;
create policy "clubs_insert_owner_or_admin"
on public.clubs
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "clubs_update_owner_or_admin" on public.clubs;
create policy "clubs_update_owner_or_admin"
on public.clubs
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "clubs_delete_owner_or_admin" on public.clubs;
create policy "clubs_delete_owner_or_admin"
on public.clubs
for delete
to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "club_slots_select_public_or_owner" on public.club_slots;
create policy "club_slots_select_public_or_owner"
on public.club_slots
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.clubs c
    where c.id = club_slots.club_id
      and (
        c.status = 'approved'
        or c.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "club_slots_manage_owner_or_admin" on public.club_slots;
create policy "club_slots_manage_owner_or_admin"
on public.club_slots
for all
to authenticated
using (public.owns_club(club_id) or public.is_admin())
with check (public.owns_club(club_id) or public.is_admin());

drop policy if exists "club_members_select_related_or_admin" on public.club_members;
create policy "club_members_select_related_or_admin"
on public.club_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
);

drop policy if exists "club_members_manage_owner_or_admin" on public.club_members;
create policy "club_members_manage_owner_or_admin"
on public.club_members
for all
to authenticated
using (public.owns_club(club_id) or public.is_admin())
with check (public.owns_club(club_id) or public.is_admin());

drop policy if exists "club_bookings_select_related_or_admin" on public.club_bookings;
create policy "club_bookings_select_related_or_admin"
on public.club_bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
);

drop policy if exists "club_bookings_insert_self" on public.club_bookings;
create policy "club_bookings_insert_self"
on public.club_bookings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "club_bookings_update_related_or_admin" on public.club_bookings;
create policy "club_bookings_update_related_or_admin"
on public.club_bookings
for update
to authenticated
using (
  user_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
);

drop policy if exists "courses_select_public_or_owner" on public.courses;
create policy "courses_select_public_or_owner"
on public.courses
for select
to anon, authenticated
using (
  club_id is null
  or exists (
    select 1
    from public.clubs c
    where c.id = courses.club_id
      and (
        c.status = 'approved'
        or c.owner_id = auth.uid()
        or public.is_admin()
      )
  )
  or owner_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "courses_insert_owner_or_admin" on public.courses;
create policy "courses_insert_owner_or_admin"
on public.courses
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "courses_update_owner_or_admin" on public.courses;
create policy "courses_update_owner_or_admin"
on public.courses
for update
to authenticated
using (
  owner_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
)
with check (
  owner_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
);

drop policy if exists "courses_delete_owner_or_admin" on public.courses;
create policy "courses_delete_owner_or_admin"
on public.courses
for delete
to authenticated
using (
  owner_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
);

drop policy if exists "course_bookings_select_related_or_admin" on public.course_bookings;
create policy "course_bookings_select_related_or_admin"
on public.course_bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or public.owns_course(course_id)
  or public.is_admin()
);

drop policy if exists "course_bookings_insert_self" on public.course_bookings;
create policy "course_bookings_insert_self"
on public.course_bookings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "course_bookings_update_related_or_admin" on public.course_bookings;
create policy "course_bookings_update_related_or_admin"
on public.course_bookings
for update
to authenticated
using (
  user_id = auth.uid()
  or public.owns_course(course_id)
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.owns_course(course_id)
  or public.is_admin()
);

drop policy if exists "course_favorites_own_rows" on public.course_favorites;
create policy "course_favorites_own_rows"
on public.course_favorites
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "forum_posts_select_public_or_author" on public.forum_posts;
create policy "forum_posts_select_public_or_author"
on public.forum_posts
for select
to anon, authenticated
using (
  visibility = 'public'
  or author_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "forum_posts_insert_self" on public.forum_posts;
create policy "forum_posts_insert_self"
on public.forum_posts
for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "forum_posts_update_self_or_admin" on public.forum_posts;
create policy "forum_posts_update_self_or_admin"
on public.forum_posts
for update
to authenticated
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

drop policy if exists "forum_posts_delete_self_or_admin" on public.forum_posts;
create policy "forum_posts_delete_self_or_admin"
on public.forum_posts
for delete
to authenticated
using (author_id = auth.uid() or public.is_admin());

drop policy if exists "forum_comments_select_post_viewers" on public.forum_comments;
create policy "forum_comments_select_post_viewers"
on public.forum_comments
for select
to anon, authenticated
using (
  author_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1
    from public.forum_posts p
    where p.id = forum_comments.post_id
      and (
        p.visibility = 'public'
        or p.author_id = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "forum_comments_insert_self" on public.forum_comments;
create policy "forum_comments_insert_self"
on public.forum_comments
for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists "forum_comments_update_self_or_admin" on public.forum_comments;
create policy "forum_comments_update_self_or_admin"
on public.forum_comments
for update
to authenticated
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());

drop policy if exists "forum_comments_delete_self_or_admin" on public.forum_comments;
create policy "forum_comments_delete_self_or_admin"
on public.forum_comments
for delete
to authenticated
using (author_id = auth.uid() or public.is_admin());

drop policy if exists "support_threads_select_own_or_admin" on public.support_threads;
create policy "support_threads_select_own_or_admin"
on public.support_threads
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "support_threads_insert_self" on public.support_threads;
create policy "support_threads_insert_self"
on public.support_threads
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "support_threads_update_own_or_admin" on public.support_threads;
create policy "support_threads_update_own_or_admin"
on public.support_threads
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "support_threads_delete_own_or_admin" on public.support_threads;
create policy "support_threads_delete_own_or_admin"
on public.support_threads
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "support_messages_select_thread_participants" on public.support_messages;
create policy "support_messages_select_thread_participants"
on public.support_messages
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.support_threads t
    where t.id = support_messages.thread_id
      and t.user_id = auth.uid()
  )
);

drop policy if exists "support_messages_insert_thread_participants" on public.support_messages;
create policy "support_messages_insert_thread_participants"
on public.support_messages
for insert
to authenticated
with check (
  public.is_admin()
  or (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.support_threads t
      where t.id = support_messages.thread_id
        and t.user_id = auth.uid()
    )
  )
);

drop policy if exists "support_auto_reply_rules_select_authenticated" on public.support_auto_reply_rules;
create policy "support_auto_reply_rules_select_authenticated"
on public.support_auto_reply_rules
for select
to authenticated
using (is_active or public.is_admin());

drop policy if exists "support_auto_reply_rules_manage_admin" on public.support_auto_reply_rules;
create policy "support_auto_reply_rules_manage_admin"
on public.support_auto_reply_rules
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.support_auto_reply_rules (
  rule_name,
  keywords,
  response_text,
  priority,
  requires_human,
  is_default,
  is_active
)
values
  (
    'human-handoff',
    array['转人工','人工','人工客服','客服','真人','人工服务','human','agent','representative','customer service']::text[],
    'We have received your message. Our customer support team will assist you shortly. If possible, please provide the club or course name, the relevant date and time, and any helpful screenshots or attachments. Thank you for your patience.',
    5,
    true,
    false,
    true
  ),
  (
    'booking-schedule',
    array['booking','book','slot','schedule','reservation','预约','时段','时间段','预定','可预约','名额']::text[],
    'We have received your booking question. Please provide the club or course name, the relevant date and time slot, and we will help you confirm availability, remaining seats, and booking status.',
    20,
    false,
    false,
    true
  ),
  (
    'payment-refund',
    array['pay','payment','fee','refund','order','付款','支付','费用','退款','订单']::text[],
    'We have received your payment question. Please provide the order ID, the club or course name, and the relevant date and time. If a refund is involved, the final outcome will follow the club or course policy.',
    30,
    false,
    false,
    true
  ),
  (
    'maps-location',
    array['map','location','address','venue','地图','位置','地点','地址']::text[],
    'We have received your location question. Please provide the club or course name, along with the map link or location details you entered, and we will help you verify whether the map is displaying correctly.',
    40,
    false,
    false,
    true
  ),
  (
    'registration-publish',
    array['register','registration','publish','approved','review','注册','发布','审核','审批']::text[],
    'We have received your registration or publishing question. Please let us know whether this is about club registration or course publishing, and tell us which step you are stuck on so we can help you continue.',
    50,
    false,
    false,
    true
  ),
  (
    'club-course-info',
    array['club','course','info','information','detail','details','俱乐部','课程','信息','详情','介绍']::text[],
    'We have received your information request. Please tell us which club or course you want to know about, and we can help you check the introduction, schedule, location, fee, and available booking slots.',
    60,
    false,
    false,
    true
  ),
  (
    'cancel-reschedule',
    array['cancel','cancellation','reschedule','change booking','change slot','取消','改期','更改时间','换时间']::text[],
    'If you need to cancel or change a booking, please send the club or course name, the date and time, and the reason for the change. We can then help you check the next available step.',
    70,
    false,
    false,
    true
  ),
  (
    'dashboard-records',
    array['dashboard','record','records','history','my booking','bookings','我的预约','记录','历史']::text[],
    'You can review your club bookings, course bookings, and support records in the user dashboard. If anything is missing, please send the related club or course name and the booking date.',
    80,
    false,
    false,
    true
  ),
  (
    'attachments-proof',
    array['attachment','attachments','upload','image','images','screenshot','screenshots','file','附件','上传','截图','图片']::text[],
    'You can include screenshots or other attachments to help us review the issue more quickly. If you are reporting a booking or payment problem, please also include the club or course name and the relevant date and time.',
    90,
    false,
    false,
    true
  ),
  (
    'login-account',
    array['login','log in','sign in','signup','sign up','account','password','登录','注册账号','账户','密码']::text[],
    'If you are having trouble logging in or creating an account, please tell us which step failed and what message you saw on screen. A screenshot is especially helpful for account issues.',
    100,
    false,
    false,
    true
  ),
  (
    'default',
    '{}'::text[],
    'We have received your message. To help us handle it more quickly, please provide the club or course name, the relevant date and time, and any helpful screenshots or attachments. We will assist you as soon as possible.',
    999,
    false,
    true,
    true
  )
on conflict (rule_name) do update set
  keywords = excluded.keywords,
  response_text = excluded.response_text,
  priority = excluded.priority,
  requires_human = excluded.requires_human,
  is_default = excluded.is_default,
  is_active = excluded.is_active,
  updated_at = now();

drop policy if exists "message_board_entries_select_related_or_admin" on public.message_board_entries;
create policy "message_board_entries_select_related_or_admin"
on public.message_board_entries
for select
to authenticated
using (
  target_user_id = auth.uid()
  or from_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "message_board_entries_insert_sender_or_admin" on public.message_board_entries;
create policy "message_board_entries_insert_sender_or_admin"
on public.message_board_entries
for insert
to authenticated
with check (
  from_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "portal_media_public_read" on storage.objects;
create policy "portal_media_public_read"
on storage.objects
for select
to public
using (bucket_id = 'portal-media');

drop policy if exists "portal_media_insert_own" on storage.objects;
create policy "portal_media_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'portal-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "portal_media_update_own" on storage.objects;
create policy "portal_media_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'portal-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'portal-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "portal_media_delete_own" on storage.objects;
create policy "portal_media_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'portal-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
