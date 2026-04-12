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
