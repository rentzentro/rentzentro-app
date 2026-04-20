# Repository Review (2026-04-20)

## Scope
- Static pass across application routes and shared clients.
- Executed lint and production build checks.

## Key findings

### 1) Build fails when required env vars are missing during `next build` (high)
**Evidence**
- `supabaseAdminClient.ts` initializes Supabase at module import time and force-casts env vars (`as string`) without validation.
- During `next build`, route modules importing this file execute and crash with `Error: supabaseUrl is required`.

**Where**
- `app/supabaseAdminClient.ts`
- `app/api/checkout/route.ts`
- `app/api/esign/checkout/route.ts`

**Impact**
- CI/CD build can fail before runtime if env vars are missing or misconfigured.
- Error surface is less actionable because crash occurs indirectly during module load.

**Recommendation**
- Replace eager top-level client creation with a lazy factory (`getSupabaseAdminClient()`), and validate env vars with explicit messages in one place.
- Gate route execution with clean 500 responses when configuration is missing.

---

### 2) `app/api/listings/route.ts` auth check is likely ineffective/broken (high)
**Evidence**
- Route creates a generic Supabase client with anon key and calls `supabase.auth.getUser()`.
- No request cookies/session token are attached to the client in this server route.

**Where**
- `app/api/listings/route.ts`

**Impact**
- `getUser()` is likely to return no authenticated user in production for server calls.
- This can make create/publish/unpublish/inquiry-status actions always fail with 401, or depend on accidental client state.

**Recommendation**
- Use server-aware auth integration (e.g., pass `Authorization` bearer token from request, or use `@supabase/auth-helpers-nextjs`/SSR client pattern with cookies).
- Add explicit integration tests for authenticated and unauthenticated listing mutations.

---

### 3) Duplicate checkout flows for e-sign purchase increase drift risk (medium)
**Evidence**
- E-sign purchase logic appears in both:
  - `app/api/checkout/route.ts` (`paymentKind === 'esign'` branch)
  - `app/api/esign/checkout/route.ts`

**Impact**
- Two endpoints can diverge in validation, metadata, or business rules.
- Future pricing/routing updates may be applied to only one path.

**Recommendation**
- Consolidate e-sign checkout into one endpoint or extract shared service function used by both routes.

---

## Quality checks executed
- `npm run lint` (passes with warnings)
- `npm run build` (fails due to Supabase env initialization crash during page data collection)

## Lint warnings observed
- React hook dependency warnings in:
  - `app/landlord/inquiries/page.tsx`
  - `app/landlord/listings/page.tsx`
  - `app/listings/[slug]/PhotoGallery.tsx`
- `@next/next/no-img-element` warning in:
  - `app/layout.tsx`

## Suggested next actions (priority order)
1. Fix lazy/env-safe Supabase admin initialization.
2. Repair auth handling in `app/api/listings/route.ts`.
3. Consolidate e-sign checkout logic paths.
4. Clean lint warnings (hook deps + image optimization).
