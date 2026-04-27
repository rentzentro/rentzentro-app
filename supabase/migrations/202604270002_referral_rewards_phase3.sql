-- Phase 3 referrals: eligibility + rewards queue.

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referral_event_id uuid not null references public.referral_events(id) on delete cascade,
  referrer_landlord_id bigint not null references public.landlords(id) on delete cascade,
  referred_landlord_id bigint not null references public.landlords(id) on delete cascade,
  reward_type text not null default 'subscription_activation',
  reward_amount_cents integer not null default 5000,
  status text not null default 'pending',
  eligible_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_rewards_event_key unique (referral_event_id),
  constraint referral_rewards_non_negative_amount check (reward_amount_cents >= 0),
  constraint referral_rewards_status_check check (status in ('pending', 'approved', 'paid', 'void'))
);

create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer_landlord_id);
create index if not exists referral_rewards_status_idx on public.referral_rewards (status);
create index if not exists referral_rewards_eligible_at_idx on public.referral_rewards (eligible_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists referral_rewards_touch_updated_at on public.referral_rewards;
create trigger referral_rewards_touch_updated_at
before update on public.referral_rewards
for each row
execute function public.touch_updated_at();

alter table public.referral_rewards enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'referral_rewards'
      and policyname = 'referral_rewards_owner_select'
  ) then
    create policy referral_rewards_owner_select
    on public.referral_rewards for select
    to authenticated
    using (
      exists (
        select 1
        from public.landlords l
        where l.id = referral_rewards.referrer_landlord_id
          and l.user_id = auth.uid()
      )
    );
  end if;
end
$$;
