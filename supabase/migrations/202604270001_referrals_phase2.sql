-- Phase 2 referrals foundation: durable code registry + attribution events.

create extension if not exists pgcrypto;

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  landlord_id bigint not null references public.landlords(id) on delete cascade,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_codes_landlord_id_key unique (landlord_id),
  constraint referral_codes_code_format check (code ~ '^[A-Z0-9_-]{3,40}$')
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_landlord_id bigint not null references public.landlords(id) on delete cascade,
  referred_landlord_id bigint not null references public.landlords(id) on delete cascade,
  referral_code text not null,
  source text not null default 'landlord_signup_referral',
  status text not null default 'attributed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_events_referred_landlord_key unique (referred_landlord_id),
  constraint referral_events_referral_code_format check (referral_code ~ '^[A-Z0-9_-]{3,40}$'),
  constraint referral_events_no_self_referral check (referrer_landlord_id <> referred_landlord_id)
);

create index if not exists referral_codes_code_idx on public.referral_codes (code);
create index if not exists referral_events_referrer_idx on public.referral_events (referrer_landlord_id);
create index if not exists referral_events_created_at_idx on public.referral_events (created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists referral_codes_touch_updated_at on public.referral_codes;
create trigger referral_codes_touch_updated_at
before update on public.referral_codes
for each row
execute function public.touch_updated_at();

drop trigger if exists referral_events_touch_updated_at on public.referral_events;
create trigger referral_events_touch_updated_at
before update on public.referral_events
for each row
execute function public.touch_updated_at();

create or replace function public.ensure_landlord_referral_code(target_landlord_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  generated_code := format('RZL-%s', target_landlord_id);

  insert into public.referral_codes (landlord_id, code, active)
  values (target_landlord_id, generated_code, true)
  on conflict (landlord_id)
  do update set
    code = excluded.code,
    active = true;

  return generated_code;
end;
$$;

create or replace function public.create_landlord_referral_code_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_landlord_referral_code(new.id);
  return new;
end;
$$;

drop trigger if exists landlords_create_referral_code on public.landlords;
create trigger landlords_create_referral_code
after insert on public.landlords
for each row
execute function public.create_landlord_referral_code_after_insert();

insert into public.referral_codes (landlord_id, code, active)
select l.id, format('RZL-%s', l.id), true
from public.landlords l
on conflict (landlord_id)
do update set
  code = excluded.code,
  active = true;

alter table public.referral_codes enable row level security;
alter table public.referral_events enable row level security;

create policy if not exists referral_codes_owner_select
on public.referral_codes for select
to authenticated
using (
  exists (
    select 1
    from public.landlords l
    where l.id = referral_codes.landlord_id
      and l.user_id = auth.uid()
  )
);

create policy if not exists referral_codes_owner_update
on public.referral_codes for update
to authenticated
using (
  exists (
    select 1
    from public.landlords l
    where l.id = referral_codes.landlord_id
      and l.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.landlords l
    where l.id = referral_codes.landlord_id
      and l.user_id = auth.uid()
  )
);

create policy if not exists referral_events_owner_select
on public.referral_events for select
to authenticated
using (
  exists (
    select 1
    from public.landlords l
    where (l.id = referral_events.referrer_landlord_id or l.id = referral_events.referred_landlord_id)
      and l.user_id = auth.uid()
  )
);
