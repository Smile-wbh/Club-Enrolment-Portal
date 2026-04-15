drop policy if exists "club_members_insert_self" on public.club_members;

create policy "club_members_insert_self"
on public.club_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.clubs c
    where c.id = club_members.club_id
      and (
        c.status = 'approved'
        or c.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);
