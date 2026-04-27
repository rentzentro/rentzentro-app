-- Phase 5 referrals: audit trail for admin reward actions.

create table if not exists public.referral_reward_audit_logs (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.referral_rewards(id) on delete cascade,
  action text not null,
  previous_status text,
  next_status text,
  processed_by text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists referral_reward_audit_logs_reward_idx
  on public.referral_reward_audit_logs (reward_id);

create index if not exists referral_reward_audit_logs_created_idx
  on public.referral_reward_audit_logs (created_at desc);

alter table public.referral_reward_audit_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'referral_reward_audit_logs'
      and policyname = 'referral_reward_audit_logs_owner_select'
  ) then
    create policy referral_reward_audit_logs_owner_select
    on public.referral_reward_audit_logs for select
    to authenticated
    using (
      exists (
        select 1
        from public.referral_rewards rr
        join public.landlords l on l.id = rr.referrer_landlord_id
        where rr.id = referral_reward_audit_logs.reward_id
          and l.user_id = auth.uid()
      )
    );
  end if;
end
$$;
