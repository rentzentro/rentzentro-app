# RentZentro

RentZentro is a landlord-focused rental operations app built with Next.js, Supabase, and Stripe.

Today, the product centers on helping independent landlords run the full rental cycle:

**List → capture inquiries → onboard tenants → collect rent → manage day-to-day operations**

## What RentZentro currently offers

### For landlords
- Landlord account signup/login with trial + subscription billing support
- Stripe subscription checkout + billing portal access
- Stripe Connect onboarding for rent payout routing
- Property and tenant records management
- Tenant invite flow by email
- Rent payment tracking and recent payment activity
- Expense tracking with monthly income/expense/net visibility
- Maintenance request management
- In-app messaging with email notifications
- Document storage/sharing
- Public listings management (draft, publish/unpublish, share link)
- Prospect inquiry capture from public listing pages
- Team member access/invite support for landlord accounts
- E-sign workflow support with purchasable signature credits

### For tenants
- Tenant signup/login and portal access
- Online rent payment checkout (card + ACH)
- Auto-pay toggle support
- Rent status visibility and payment history
- Document access
- Maintenance request submission + status tracking
- Messaging with landlord/team

## Current architecture (high level)

- **Web app:** Next.js App Router + React + TypeScript
- **Data/auth:** Supabase
- **Payments & billing:** Stripe (tenant checkout, landlord subscriptions, Connect)
- **Transactional email:** Resend
- **Styling:** Tailwind CSS

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm test
```
