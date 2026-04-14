create table if not exists public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text,
  membership_type text not null default 'sports' check (membership_type in ('sports')),
  plan_name text not null default 'Sports Membership',
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly')),
  order_id text unique,
  payment_method text,
  price numeric(10, 2) not null default 20,
  coupon_code text,
  coupon_generated_at timestamptz not null default now(),
  coupon_discount numeric(10, 2) not null default 0,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 month'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_memberships
  add column if not exists email text;

alter table public.user_memberships
  add column if not exists coupon_generated_at timestamptz not null default now();

alter table public.user_memberships
  alter column price set default 20;

alter table public.user_memberships
  alter column coupon_discount set default 0;

alter table public.user_memberships
  alter column coupon_generated_at set default now();

create index if not exists idx_user_memberships_user_created on public.user_memberships(user_id, created_at desc);
create unique index if not exists idx_user_memberships_user_type_active on public.user_memberships(user_id, membership_type) where status = 'active';
create unique index if not exists idx_user_memberships_active_coupon_code on public.user_memberships(coupon_code) where membership_type = 'sports' and status = 'active' and coupon_code is not null;

update public.user_memberships
set price = 20
where membership_type = 'sports'
  and coalesce(price, 0) <> 20;

update public.user_memberships memberships
set email = lower(coalesce(profiles.email, memberships.email))
from public.profiles
where profiles.id = memberships.user_id
  and memberships.membership_type = 'sports'
  and lower(coalesce(memberships.email, '')) <> lower(coalesce(profiles.email, ''));

update public.user_memberships
set coupon_discount = 0
where membership_type = 'sports'
  and coalesce(coupon_discount, 0) <> 0;

update public.user_memberships
set
  coupon_code = null,
  coupon_generated_at = now() - interval '8 days'
where membership_type = 'sports'
  and status = 'active';

create or replace function public.generate_membership_coupon_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_attempts integer := 0;
  v_index integer;
  i integer;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_index := 1 + floor(random() * length(v_chars))::integer;
      v_code := v_code || substr(v_chars, v_index, 1);
    end loop;

    exit when not exists (
      select 1
      from public.user_memberships
      where membership_type = 'sports'
        and status = 'active'
        and coupon_code = v_code
    );

    v_attempts := v_attempts + 1;
    if v_attempts > 30 then
      raise exception 'coupon_generation_failed';
    end if;
  end loop;

  return v_code;
end;
$$;

create or replace function public.get_my_active_sports_membership()
returns public.user_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.user_memberships%rowtype;
  v_auth_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_auth_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));

  update public.user_memberships
  set status = 'expired'
  where user_id = auth.uid()
    and membership_type = 'sports'
    and status = 'active'
    and expires_at <= now();

  select *
  into v_membership
  from public.user_memberships
  where user_id = auth.uid()
    and membership_type = 'sports'
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1;

  if not found then
    return null;
  end if;

  if v_auth_email is not null
    and lower(coalesce(v_membership.email, '')) <> v_auth_email
  then
    update public.user_memberships
    set email = v_auth_email
    where id = v_membership.id
    returning *
    into v_membership;
  end if;

  if v_membership.coupon_generated_at is null
    or v_membership.coupon_generated_at <= now() - interval '7 days'
    or nullif(trim(coalesce(v_membership.coupon_code, '')), '') is null
    or upper(trim(coalesce(v_membership.coupon_code, ''))) !~ '^[A-Z0-9]{6}$'
  then
    update public.user_memberships
    set
      coupon_code = public.generate_membership_coupon_code(),
      coupon_generated_at = now()
    where id = v_membership.id
    returning *
    into v_membership;
  end if;

  return v_membership;
end;
$$;

create or replace function public.activate_sports_membership(
  p_order_id text,
  p_plan_name text default 'Sports Membership',
  p_price numeric default 20,
  p_billing_cycle text default 'monthly',
  p_payment_method text default null
)
returns public.user_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.user_memberships%rowtype;
  v_membership public.user_memberships%rowtype;
  v_order_id text;
  v_coupon_code text;
  v_auth_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_auth_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));

  v_order_id := nullif(trim(coalesce(p_order_id, '')), '');
  if v_order_id is null then
    raise exception 'missing_order_id';
  end if;

  select *
  into v_existing
  from public.get_my_active_sports_membership();

  if found then
    return v_existing;
  end if;

  select *
  into v_existing
  from public.user_memberships
  where order_id = v_order_id
  limit 1;

  if found then
    return v_existing;
  end if;

  v_coupon_code := public.generate_membership_coupon_code();

  insert into public.user_memberships (
    user_id,
    email,
    membership_type,
    plan_name,
    status,
    billing_cycle,
    order_id,
    payment_method,
    price,
    coupon_code,
    coupon_generated_at,
    coupon_discount,
    started_at,
    expires_at
  )
  values (
    auth.uid(),
    v_auth_email,
    'sports',
    coalesce(nullif(trim(coalesce(p_plan_name, '')), ''), 'Sports Membership'),
    'active',
    coalesce(nullif(trim(coalesce(p_billing_cycle, '')), ''), 'monthly'),
    v_order_id,
    nullif(trim(coalesce(p_payment_method, '')), ''),
    greatest(coalesce(p_price, 0), 0),
    v_coupon_code,
    now(),
    0,
    now(),
    now() + interval '1 month'
  )
  returning *
  into v_membership;

  return v_membership;
end;
$$;

create or replace function public.validate_my_sports_membership_coupon(p_coupon_code text)
returns public.user_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.user_memberships%rowtype;
  v_code text;
  v_auth_email text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_auth_email := lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''));
  v_code := upper(nullif(trim(coalesce(p_coupon_code, '')), ''));
  if v_code is null then
    raise exception 'missing_coupon_code';
  end if;

  select *
  into v_membership
  from public.get_my_active_sports_membership();

  if not found then
    return null;
  end if;

  if v_auth_email is null or lower(trim(coalesce(v_membership.email, ''))) <> v_auth_email then
    return null;
  end if;

  if upper(trim(coalesce(v_membership.coupon_code, ''))) <> v_code then
    return null;
  end if;

  return v_membership;
end;
$$;

drop trigger if exists set_user_memberships_updated_at on public.user_memberships;
create trigger set_user_memberships_updated_at
before update on public.user_memberships
for each row execute function public.set_updated_at();

alter table public.user_memberships enable row level security;

drop policy if exists "user_memberships_select_own_or_admin" on public.user_memberships;
create policy "user_memberships_select_own_or_admin"
on public.user_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "user_memberships_insert_self_or_admin" on public.user_memberships;
create policy "user_memberships_insert_self_or_admin"
on public.user_memberships
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "user_memberships_update_own_or_admin" on public.user_memberships;
create policy "user_memberships_update_own_or_admin"
on public.user_memberships
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
)
with check (
  user_id = auth.uid()
  or public.is_admin()
);

grant execute on function public.activate_sports_membership(text, text, numeric, text, text) to authenticated, service_role;
grant execute on function public.generate_membership_coupon_code() to service_role;
grant execute on function public.get_my_active_sports_membership() to authenticated, service_role;
grant execute on function public.validate_my_sports_membership_coupon(text) to authenticated, service_role;
