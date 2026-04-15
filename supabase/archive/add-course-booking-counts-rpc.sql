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
