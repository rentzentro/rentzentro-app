# RentZentro

RentZentro is all-in-one rental operations software built for independent landlords and growing teams.

It is built to run the full leasing lifecycle in one place:

**Attract renters → manage applications and onboarding → collect rent → handle maintenance, messaging, and records**

---

## Positioning

RentZentro is designed to give landlords complete operational coverage without enterprise-level complexity.

- Works for single-property landlords and expanding teams.
- Supports large portfolios through the Growth plan and custom plan path for portfolios above the standard tier limits.
- Centralizes payments, leasing workflows, maintenance, communication, and financial visibility in one platform.

---

## Current landlord pricing

As of April 25, 2026, the landlord subscription plans are:

- **Starter:** **$19/month** (up to 3 units)
- **Core:** **$29.95/month** (up to 20 units)
- **Growth:** **$59/month** (up to 75 units)
- **Custom plan support:** for landlords managing more than 75 units

These are the same plan prices reflected in the app pricing surfaces.

---

## What RentZentro offers today

### Landlord experience

- **Landlord account system** with signup/login, setup flow, and role-based owner/team access.
- **Public listings engine** with listing creation, publish/unpublish states, and shareable listing pages.
- **Tenant onboarding flows** including invite-by-email and account linking.
- **Rent collection tools** with Stripe-powered online payments (card + ACH support in checkout flows).
- **Autopay support** for recurring tenant payment convenience.
- **Subscription billing** for landlord plans with checkout, status checks, cancellations, and self-serve billing portal.
- **Stripe Connect onboarding** for payout routing.
- **Property + tenant operations** covering residents, payment visibility, and daily management.
- **Maintenance management** with ticket submission/tracking and notification endpoints.
- **Maintenance worker directory** to quickly find nearby repair pros and save preferred vendors.
- **In-app messaging** backed by email delivery for real-world communication.
- **Document workflows** and landlord-facing document management screens.
- **Manual or AI-generated lease assistance** to help draft stronger lease language while keeping final landlord control.
- **Expense and accounting surfaces** with accounting workflow endpoints and integrations entry points.
- **E-sign flow support** with purchasable e-sign credits and webhook handling.
- **Owner metrics/dashboard endpoints** for performance visibility.

### Tenant experience

- **Tenant authentication + portal access** for resident self-service.
- **Online rent checkout** with success/cancel handling.
- **Autopay controls**.
- **Maintenance request submission + status tracking**.
- **Messaging with landlord/team**.
- **Document access and day-to-day portal workflows**.
- **Explore Nearby** links for local places and **weekend events near home** inside the tenant portal.

---

## Platform architecture

- **Frontend + app framework:** Next.js (App Router), React, TypeScript
- **Database + auth:** Supabase
- **Payments:** Stripe (tenant checkout, landlord subscriptions, Connect)
- **Email delivery:** Resend
- **Styling:** Tailwind CSS

---

## Core product areas in this repo

- `app/landlord/*` → landlord dashboard, listings, tenants, payments, docs, accounting, team, settings.
- `app/tenant/*` → tenant portal, maintenance, messages, payments.
- `app/listings/*` → public listing search/detail pages.
- `app/api/*` → backend workflows (payments, billing, webhooks, invites, reminders, messaging, integrations).
- `tests/*.test.cjs` → workflow-level automated tests for critical business flows.

---

## Local development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

At minimum, local development usually needs:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side/admin routes)
- `STRIPE_SECRET_KEY` (payment and billing routes)
- `RESEND_API_KEY` (email routes)

Depending on what features you run locally, additional env vars may be needed (Stripe price IDs, webhook secrets, integrations provider credentials, app URL values, etc.).

### 3) Start the app

```bash
npm run dev
```

Then open `http://localhost:3000`.

---

## Scripts

```bash
npm run dev            # Start local dev server
npm run build          # Production build (includes merge-marker guard)
npm run start          # Run production server
npm run lint           # Next.js lint checks
npm run test:flows     # Node test runner for workflow tests in /tests
npm run check:merge-markers
```

---

## Notes

- This repo contains both customer-facing pages and server routes for billing, webhooks, notifications, and lifecycle automations.
- If you are onboarding to the codebase, start with `app/landlord`, `app/tenant`, and `app/api` to understand the end-to-end product behavior.
