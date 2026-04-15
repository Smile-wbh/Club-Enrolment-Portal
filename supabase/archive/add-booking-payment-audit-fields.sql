alter table public.club_bookings add column if not exists payment_method text;
alter table public.club_bookings add column if not exists payer_email text;

alter table public.course_bookings add column if not exists order_id text;
alter table public.course_bookings add column if not exists payment_status public.payment_status not null default 'pending';
alter table public.course_bookings add column if not exists payment_method text;
alter table public.course_bookings add column if not exists fee_text text not null default 'Free';
alter table public.course_bookings add column if not exists base_fee numeric(10, 2) not null default 0;
alter table public.course_bookings add column if not exists service_fee numeric(10, 2) not null default 0;
alter table public.course_bookings add column if not exists discount numeric(10, 2) not null default 0;
alter table public.course_bookings add column if not exists payable_amount numeric(10, 2) not null default 0;
alter table public.course_bookings add column if not exists payer_email text;

update public.club_bookings b
set payer_email = lower(p.email)
from public.profiles p
where b.user_id = p.id
  and coalesce(trim(b.payer_email), '') = '';

update public.course_bookings cb
set payer_email = coalesce(lower(p.email), cb.payer_email),
    fee_text = case
      when coalesce(trim(cb.fee_text), '') = '' then coalesce(c.fee_text, 'Free')
      else cb.fee_text
    end,
    payment_status = case
      when cb.payment_status = 'pending' then 'paid'::public.payment_status
      else cb.payment_status
    end
from public.courses c,
     public.profiles p
where cb.course_id = c.id
  and p.id = cb.user_id;

drop function if exists public.create_club_booking(text, uuid, uuid, text, text, numeric, numeric, numeric, numeric);

create or replace function public.create_club_booking(
  p_order_id text,
  p_club_id uuid,
  p_slot_id uuid,
  p_location text default null,
  p_fee_text text default '£0',
  p_base_fee numeric default 0,
  p_service_fee numeric default 0,
  p_discount numeric default 0,
  p_payable_amount numeric default 0,
  p_payment_method text default null,
  p_payer_email text default null
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
    payment_method,
    day_iso,
    day_label,
    slot_time,
    location,
    fee_text,
    base_fee,
    service_fee,
    discount,
    payable_amount,
    payer_email
  )
  values (
    trim(p_order_id),
    auth.uid(),
    p_club_id,
    p_slot_id,
    'booked'::public.booking_status,
    'paid'::public.payment_status,
    nullif(trim(coalesce(p_payment_method, '')), ''),
    v_slot.day_iso,
    trim(to_char(v_slot.day_iso, 'YYYY-MM-DD')),
    v_slot_time,
    coalesce(nullif(trim(p_location), ''), v_club.location),
    coalesce(nullif(trim(p_fee_text), ''), v_club.fee_text),
    coalesce(p_base_fee, 0),
    coalesce(p_service_fee, 0),
    greatest(coalesce(p_discount, 0), 0),
    greatest(coalesce(p_payable_amount, 0), 0),
    coalesce(
      lower(nullif(trim(coalesce(p_payer_email, '')), '')),
      lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''))
    )
  )
  returning *
  into v_booking;

  return v_booking;
end;
$$;

drop function if exists public.create_course_booking(uuid, text);

create or replace function public.create_course_booking(
  p_course_id uuid,
  p_selected_schedule text default null,
  p_order_id text default null,
  p_fee_text text default 'Free',
  p_base_fee numeric default 0,
  p_service_fee numeric default 0,
  p_discount numeric default 0,
  p_payable_amount numeric default 0,
  p_payment_method text default null,
  p_payer_email text default null
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
    order_id,
    user_id,
    course_id,
    status,
    payment_status,
    payment_method,
    fee_text,
    base_fee,
    service_fee,
    discount,
    payable_amount,
    payer_email,
    selected_schedule
  )
  values (
    nullif(trim(coalesce(p_order_id, '')), ''),
    auth.uid(),
    p_course_id,
    'booked',
    'paid'::public.payment_status,
    nullif(trim(coalesce(p_payment_method, '')), ''),
    coalesce(nullif(trim(p_fee_text), ''), v_course.fee_text),
    coalesce(p_base_fee, 0),
    coalesce(p_service_fee, 0),
    greatest(coalesce(p_discount, 0), 0),
    greatest(coalesce(p_payable_amount, 0), 0),
    coalesce(
      lower(nullif(trim(coalesce(p_payer_email, '')), '')),
      lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''))
    ),
    v_selected_schedule
  )
  returning *
  into v_booking;

  return v_booking;
end;
$$;

create unique index if not exists idx_course_bookings_order_id
on public.course_bookings(order_id)
where order_id is not null;
