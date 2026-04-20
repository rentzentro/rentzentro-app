# Growth + Reliability Priorities (2026-04-20)

## Goal
Top 5 highest-impact improvements to help RentZentro convert and retain paying landlords while reducing production risk.

## 1) Fix insecure billing API authorization (critical reliability + revenue protection)
**Why this is highest impact**
- Multiple billing endpoints trust a client-supplied `landlordId` and run with Supabase service-role privileges.
- There is no server-side verification that the requester owns that landlord record.

**Evidence**
- `app/api/subscription/checkout/route.ts`
- `app/api/subscription/portal/route.ts`
- `app/api/subscription/cancel/route.ts`

**Business impact**
- Potential IDOR/account-takeover behavior for billing actions.
- A security incident here directly hurts trust, retention, and your ability to close paid landlords.

**Recommended fix**
- Require a verified user identity server-side (cookie/session or bearer token).
- Resolve landlord from authenticated `user_id` on the server, not from raw client `landlordId`.
- Add ownership assertions before Stripe operations.
- Add integration tests for unauthorized access attempts.

---

## 2) Repair authenticated listing mutations and ownership checks (critical growth path)
**Why this is highest impact**
- Listing creation/publish flow is core to your “List → Capture leads → Lease → Get paid” funnel.
- The API route uses an anon Supabase client and calls `auth.getUser()` without request auth context.

**Evidence**
- `app/api/listings/route.ts`

**Business impact**
- Listing actions may fail for real users or behave inconsistently.
- Broken listing operations reduce lead volume and delay conversions to paid landlords.

**Recommended fix**
- Use a server-authenticated Supabase client tied to request cookies/token.
- Enforce per-row ownership (owner/team) in mutation queries.
- Add route-level tests for create/publish/unpublish/inquiry status with auth + ownership scenarios.

---

## 3) Prevent build-time crashes from eager env-dependent clients (high reliability)
**Why this matters**
- Several modules instantiate clients at import time with force-cast env vars.
- This can crash during `next build` if env vars are absent/misconfigured.

**Evidence**
- `app/supabaseAdminClient.ts`
- routes importing env-bound clients

**Business impact**
- Failed deploys and delayed fixes during incidents.
- Reduced operational reliability for a payments product.

**Recommended fix**
- Centralize env validation in one utility.
- Switch to lazy client factories (`getSupabaseAdminClient()`/`getStripe()`), returning actionable errors.
- Add a startup health check route and CI preflight for required env vars.

---

## 4) Upgrade inquiry handling into a conversion workflow (high growth impact)
**Why this matters for paid landlord growth**
- You already ingest inquiries and support statuses (`new`, `contacted`, `converted`, etc.), but follow-up speed and consistency are likely manual.

**Evidence**
- `app/api/listings/inquiry/route.ts` stores inquiry + sends notification emails.
- `app/landlord/inquiries/page.tsx` supports status management and conversion actions.

**Business impact**
- Faster response and structured follow-up materially increases lease conversion rates.
- Stronger lead-to-lease outcomes make it easier to justify subscription pricing.

**Recommended fix**
- Add auto-acknowledgment emails/SMS to prospects.
- Add SLA nudges: reminders for uncontacted inquiries after X hours.
- Add funnel metrics: inquiry→contacted, contacted→showing, showing→converted by landlord.
- Surface ROI proof in landlord dashboard ("X inquiries, Y conversions").

---

## 5) Strengthen paid conversion instrumentation and onboarding milestones (high growth + retention)
**Why this matters**
- Current tracking appears limited (e.g., Meta `CompleteRegistration` event on signup redirect).
- Subscription and product activation milestones are not comprehensively instrumented.

**Evidence**
- `app/components/MetaPixelTracker.tsx`
- onboarding + setup pages (`app/landlord/signup/page.tsx`, `app/landlord/complete-setup/page.tsx`)

**Business impact**
- Hard to diagnose drop-off between signup, Stripe Connect setup, first listing, first inquiry, and first payment.
- Without cohort visibility, paid acquisition spend and trial conversion optimization are constrained.

**Recommended fix**
- Instrument event taxonomy across the full landlord activation path:
  - `landlord_signup_completed`
  - `stripe_connect_onboarded`
  - `first_listing_published`
  - `first_inquiry_received`
  - `subscription_started`
  - `first_rent_payment_success`
- Build weekly activation dashboards + alerting on step-to-step drop-offs.
- Trigger lifecycle messaging based on missing milestones.

---

## Suggested execution order (next 4 weeks)
1. **Week 1:** Secure billing/listing APIs (Items 1–2).
2. **Week 2:** Env hardening + deploy reliability (Item 3).
3. **Week 3:** Inquiry conversion automation (Item 4).
4. **Week 4:** Full-funnel instrumentation + activation experiments (Item 5).

