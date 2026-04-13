create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  purpose text not null default 'signup',
  code_hash text not null,
  attempts integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_verification_codes_email_purpose_created
on public.email_verification_codes (lower(email), purpose, created_at desc);

create index if not exists idx_email_verification_codes_pending
on public.email_verification_codes (lower(email), purpose, used_at, expires_at desc);

drop trigger if exists set_email_verification_codes_updated_at on public.email_verification_codes;
create trigger set_email_verification_codes_updated_at
before update on public.email_verification_codes
for each row execute function public.set_updated_at();

alter table public.email_verification_codes enable row level security;
