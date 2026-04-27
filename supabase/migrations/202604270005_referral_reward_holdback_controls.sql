-- Phase 6 referrals: payout holdback and cancellation-risk controls.

alter table if exists public.referral_rewards
  add column if not exists qualified_at timestamptz,
  add column if not exists hold_until timestamptz,
  add column if not exists cancellation_risk_flag boolean not null default false;

update public.referral_rewards
set
  qualified_at = coalesce(qualified_at, eligible_at, now()),
  hold_until = coalesce(hold_until, coalesce(eligible_at, now()) + interval '45 days')
where qualified_at is null or hold_until is null;

create index if not exists referral_rewards_hold_until_idx
  on public.referral_rewards (hold_until);

create index if not exists referral_rewards_risk_flag_idx
  on public.referral_rewards (cancellation_risk_flag);
