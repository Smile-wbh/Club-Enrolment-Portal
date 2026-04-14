create table if not exists public.club_support_threads (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_email text,
  user_name text,
  status public.support_status not null default 'open',
  last_message_at timestamptz,
  last_message_preview text,
  last_message_sender_role text check (last_message_sender_role in ('user', 'club')),
  user_last_read_at timestamptz,
  club_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, user_id)
);

alter table public.club_support_threads add column if not exists user_email text;
alter table public.club_support_threads add column if not exists user_name text;
alter table public.club_support_threads add column if not exists status public.support_status not null default 'open';
alter table public.club_support_threads add column if not exists last_message_at timestamptz;
alter table public.club_support_threads add column if not exists last_message_preview text;
alter table public.club_support_threads add column if not exists last_message_sender_role text;
alter table public.club_support_threads add column if not exists user_last_read_at timestamptz;
alter table public.club_support_threads add column if not exists club_last_read_at timestamptz;
alter table public.club_support_threads add column if not exists created_at timestamptz not null default now();
alter table public.club_support_threads add column if not exists updated_at timestamptz not null default now();

create table if not exists public.club_support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.club_support_threads(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('user', 'club')),
  sender_name text,
  sender_email text,
  message_text text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.club_support_messages add column if not exists club_id uuid references public.clubs(id) on delete cascade;
alter table public.club_support_messages add column if not exists sender_user_id uuid references public.profiles(id) on delete set null;
alter table public.club_support_messages add column if not exists sender_role text;
alter table public.club_support_messages add column if not exists sender_name text;
alter table public.club_support_messages add column if not exists sender_email text;
alter table public.club_support_messages add column if not exists message_text text not null default '';
alter table public.club_support_messages add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.club_support_messages add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'club_support_messages_has_content'
  ) then
    alter table public.club_support_messages
      add constraint club_support_messages_has_content
      check (nullif(trim(message_text), '') is not null or jsonb_array_length(attachments) > 0);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'club_support_messages_attachments_array'
  ) then
    alter table public.club_support_messages
      add constraint club_support_messages_attachments_array
      check (jsonb_typeof(attachments) = 'array');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'club_support_threads_sender_role_check'
  ) then
    alter table public.club_support_threads
      add constraint club_support_threads_sender_role_check
      check (last_message_sender_role is null or last_message_sender_role in ('user', 'club'));
  end if;
end
$$;

create or replace function public.get_my_club_support_thread(
  p_club_id uuid
)
returns public.club_support_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.club_support_threads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_club_id is null then
    raise exception 'missing_club_id';
  end if;

  select t.*
  into v_thread
  from public.club_support_threads t
  join public.clubs c
    on c.id = t.club_id
  where t.club_id = p_club_id
    and t.user_id = auth.uid()
    and (
      c.status = 'approved'
      or c.owner_id = auth.uid()
      or public.is_admin()
    )
  limit 1;

  return v_thread;
end;
$$;

create or replace function public.create_club_support_message_as_user(
  p_club_id uuid,
  p_message_text text default null,
  p_attachments jsonb default '[]'::jsonb
)
returns public.club_support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_club public.clubs%rowtype;
  v_thread public.club_support_threads%rowtype;
  v_message public.club_support_messages%rowtype;
  v_message_text text;
  v_attachments jsonb;
  v_preview text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_club_id is null then
    raise exception 'missing_club_id';
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
  into v_club
  from public.clubs
  where id = p_club_id
    and (
      status = 'approved'
      or owner_id = auth.uid()
      or public.is_admin()
    )
  limit 1;

  if not found then
    raise exception 'club_not_found';
  end if;

  v_message_text := nullif(trim(coalesce(p_message_text, '')), '');
  v_attachments := coalesce(p_attachments, '[]'::jsonb);

  if jsonb_typeof(v_attachments) <> 'array' then
    raise exception 'invalid_attachments_payload';
  end if;

  if v_message_text is null and jsonb_array_length(v_attachments) = 0 then
    raise exception 'missing_message_content';
  end if;

  select *
  into v_thread
  from public.club_support_threads
  where club_id = p_club_id
    and user_id = auth.uid()
  limit 1;

  if not found then
    insert into public.club_support_threads (
      club_id,
      user_id,
      user_email,
      user_name,
      status,
      user_last_read_at
    )
    values (
      p_club_id,
      auth.uid(),
      lower(coalesce(v_profile.email, '')),
      coalesce(nullif(trim(v_profile.nickname), ''), split_part(coalesce(v_profile.email, ''), '@', 1), 'User'),
      'open',
      now()
    )
    returning *
    into v_thread;
  end if;

  insert into public.club_support_messages (
    thread_id,
    club_id,
    sender_user_id,
    sender_role,
    sender_name,
    sender_email,
    message_text,
    attachments
  )
  values (
    v_thread.id,
    p_club_id,
    auth.uid(),
    'user',
    coalesce(nullif(trim(v_profile.nickname), ''), split_part(coalesce(v_profile.email, ''), '@', 1), 'User'),
    lower(coalesce(v_profile.email, '')),
    coalesce(v_message_text, ''),
    v_attachments
  )
  returning *
  into v_message;

  v_preview := coalesce(v_message_text, '');
  if v_preview = '' and jsonb_array_length(v_attachments) > 0 then
    v_preview := 'Attachment';
  end if;

  update public.club_support_threads
  set
    user_email = lower(coalesce(v_profile.email, '')),
    user_name = coalesce(nullif(trim(v_profile.nickname), ''), split_part(coalesce(v_profile.email, ''), '@', 1), 'User'),
    status = 'open',
    last_message_at = v_message.created_at,
    last_message_preview = left(coalesce(v_preview, ''), 200),
    last_message_sender_role = 'user',
    user_last_read_at = v_message.created_at
  where id = v_thread.id;

  return v_message;
end;
$$;

create or replace function public.create_club_support_message_as_owner(
  p_thread_id uuid,
  p_message_text text default null,
  p_attachments jsonb default '[]'::jsonb
)
returns public.club_support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_thread public.club_support_threads%rowtype;
  v_message public.club_support_messages%rowtype;
  v_message_text text;
  v_attachments jsonb;
  v_preview text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_thread_id is null then
    raise exception 'missing_thread_id';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid()
  limit 1;

  if not found then
    raise exception 'profile_not_found';
  end if;

  select t.*
  into v_thread
  from public.club_support_threads t
  where t.id = p_thread_id
    and (
      public.owns_club(t.club_id)
      or public.is_admin()
    )
  limit 1;

  if not found then
    raise exception 'thread_not_found';
  end if;

  v_message_text := nullif(trim(coalesce(p_message_text, '')), '');
  v_attachments := coalesce(p_attachments, '[]'::jsonb);

  if jsonb_typeof(v_attachments) <> 'array' then
    raise exception 'invalid_attachments_payload';
  end if;

  if v_message_text is null and jsonb_array_length(v_attachments) = 0 then
    raise exception 'missing_message_content';
  end if;

  insert into public.club_support_messages (
    thread_id,
    club_id,
    sender_user_id,
    sender_role,
    sender_name,
    sender_email,
    message_text,
    attachments
  )
  values (
    v_thread.id,
    v_thread.club_id,
    auth.uid(),
    'club',
    coalesce(nullif(trim(v_profile.nickname), ''), split_part(coalesce(v_profile.email, ''), '@', 1), 'Club Team'),
    lower(coalesce(v_profile.email, '')),
    coalesce(v_message_text, ''),
    v_attachments
  )
  returning *
  into v_message;

  v_preview := coalesce(v_message_text, '');
  if v_preview = '' and jsonb_array_length(v_attachments) > 0 then
    v_preview := 'Attachment';
  end if;

  update public.club_support_threads
  set
    status = 'open',
    last_message_at = v_message.created_at,
    last_message_preview = left(coalesce(v_preview, ''), 200),
    last_message_sender_role = 'club',
    club_last_read_at = v_message.created_at
  where id = v_thread.id;

  return v_message;
end;
$$;

create or replace function public.mark_club_support_thread_read(
  p_thread_id uuid
)
returns public.club_support_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_thread public.club_support_threads%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if p_thread_id is null then
    raise exception 'missing_thread_id';
  end if;

  select *
  into v_thread
  from public.club_support_threads
  where id = p_thread_id
  limit 1;

  if not found then
    raise exception 'thread_not_found';
  end if;

  if v_thread.user_id = auth.uid() then
    update public.club_support_threads
    set user_last_read_at = now()
    where id = v_thread.id
    returning *
    into v_thread;
    return v_thread;
  end if;

  if public.owns_club(v_thread.club_id) or public.is_admin() then
    update public.club_support_threads
    set club_last_read_at = now()
    where id = v_thread.id
    returning *
    into v_thread;
    return v_thread;
  end if;

  raise exception 'not_authorized';
end;
$$;

create or replace function public.get_my_club_support_unread_counts(
  p_club_ids uuid[] default null
)
returns table (
  club_id uuid,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.club_id,
    count(m.id)::bigint as unread_count
  from public.club_support_threads t
  left join public.club_support_messages m
    on m.thread_id = t.id
   and m.sender_role = 'user'
   and m.created_at > coalesce(t.club_last_read_at, to_timestamp(0))
  where (
      p_club_ids is null
      or t.club_id = any(p_club_ids)
    )
    and (
      public.owns_club(t.club_id)
      or public.is_admin()
    )
  group by t.club_id;
$$;

grant execute on function public.get_my_club_support_thread(uuid) to authenticated, service_role;
grant execute on function public.create_club_support_message_as_user(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.create_club_support_message_as_owner(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.mark_club_support_thread_read(uuid) to authenticated, service_role;
grant execute on function public.get_my_club_support_unread_counts(uuid[]) to authenticated, service_role;

create index if not exists idx_club_support_threads_club_last_message
on public.club_support_threads(club_id, last_message_at desc, created_at desc);

create index if not exists idx_club_support_threads_user_last_message
on public.club_support_threads(user_id, last_message_at desc, created_at desc);

create index if not exists idx_club_support_messages_thread_created
on public.club_support_messages(thread_id, created_at);

create index if not exists idx_club_support_messages_club_created
on public.club_support_messages(club_id, created_at desc);

drop trigger if exists set_club_support_threads_updated_at on public.club_support_threads;
create trigger set_club_support_threads_updated_at
before update on public.club_support_threads
for each row execute function public.set_updated_at();

alter table public.club_support_threads enable row level security;
alter table public.club_support_messages enable row level security;

drop policy if exists "club_support_threads_select_related_or_admin" on public.club_support_threads;
create policy "club_support_threads_select_related_or_admin"
on public.club_support_threads
for select
to authenticated
using (
  user_id = auth.uid()
  or public.owns_club(club_id)
  or public.is_admin()
);

drop policy if exists "club_support_threads_insert_self_or_admin" on public.club_support_threads;
create policy "club_support_threads_insert_self_or_admin"
on public.club_support_threads
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "club_support_threads_update_related_or_admin" on public.club_support_threads;
create policy "club_support_threads_update_related_or_admin"
on public.club_support_threads
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

drop policy if exists "club_support_messages_select_related_or_admin" on public.club_support_messages;
create policy "club_support_messages_select_related_or_admin"
on public.club_support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.club_support_threads t
    where t.id = club_support_messages.thread_id
      and (
        t.user_id = auth.uid()
        or public.owns_club(t.club_id)
        or public.is_admin()
      )
  )
);

drop policy if exists "club_support_messages_insert_related_or_admin" on public.club_support_messages;
create policy "club_support_messages_insert_related_or_admin"
on public.club_support_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and exists (
    select 1
    from public.club_support_threads t
    where t.id = club_support_messages.thread_id
      and (
        t.user_id = auth.uid()
        or public.owns_club(t.club_id)
        or public.is_admin()
      )
  )
);
