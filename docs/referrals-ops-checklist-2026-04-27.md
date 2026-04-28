# Referral system ops checklist (Phase 5)

Date: 2026-04-27

## Environment config

- Set `OWNER_API_TOKEN` for owner-only API token access.
- Optionally set `OWNER_ADMIN_EMAILS` (comma-separated) to require Supabase-authenticated owner identities.
- For browser-based owner pages, set `NEXT_PUBLIC_OWNER_API_TOKEN` to the same value as `OWNER_API_TOKEN`.
- Optionally set `OWNER_API_ALLOW_OPEN_MODE=true` only for temporary diagnostics in trusted environments.
- Set `REFERRAL_REWARD_CENTS` if reward amount differs from default 5000 cents.

## Deployment checks

1. Run migrations in order:
   - `202604270001_referrals_phase2.sql`
   - `202604270002_referral_rewards_phase3.sql`
   - `202604270003_referral_rewards_admin_fields.sql`
   - `202604270004_referral_reward_audit_log.sql`
2. Verify `/api/owner/referrals/rewards/export` returns CSV for approved rewards.
3. Verify owner dashboard referral KPI card renders with non-error API responses.

## Alerting recommendations

- Alert on `429` spikes for:
  - `/api/referrals/attribution`
  - `/api/owner/referrals/*`
- Alert on `500` responses from:
  - `/api/owner/referrals/rewards` (especially `audit log write failed`)
  - `/api/stripe/subscription-webhook` referral eligibility sync failures
- Alert when pending rewards age > 14 days.

## Weekly reconciliation

- Export approved rewards CSV and reconcile with payout source of truth.
- Validate `referral_reward_audit_logs` entries exist for each reward status transition.
- Spot-check `eligible` referral events have corresponding pending reward rows.
