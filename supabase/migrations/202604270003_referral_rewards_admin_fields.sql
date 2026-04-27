-- Phase 4 referrals: admin workflow metadata for reward approvals and payouts.

alter table if exists public.referral_rewards
  add column if not exists processed_by text,
  add column if not exists external_payout_id text;

create index if not exists referral_rewards_processed_by_idx
  on public.referral_rewards (processed_by);

create index if not exists referral_rewards_external_payout_idx
  on public.referral_rewards (external_payout_id);
