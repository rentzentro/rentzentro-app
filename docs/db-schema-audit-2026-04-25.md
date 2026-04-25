# DB Schema Audit (2026-04-25)

This audit compares Supabase schema snapshots shared by the team (tables/columns, FKs, and policy exports) against the current app's Supabase query usage.

## Source snapshots reviewed

- Public table columns export (documents, e-sign, expenses, landlord/team, listings, listing photos/leads/inquiries).
- Foreign key export.
- Policy export (RLS policies for documents, landlord tables, listings, listing photos, listing inquiries/leads, maintenance, messages, payments, properties, tenants).

## App usage review highlights

Code paths that depend on listing shape require additional columns beyond the base listing export shown in the snapshot.

### Listings columns used in app code

The listing create/edit page reads and writes all of the following fields:

- `deposit_amount`
- `available_date`
- `beds`
- `baths`
- `sqft`
- `description`
- `contact_email`
- `contact_phone`
- `hide_exact_address`
- `address_line1`
- `address_line2`
- `postal_code`

If any of these are missing in production DB, listing create/edit and public listing rendering can fail or silently lose data.

## Actions taken

1. Added `supabase/migrations/202604250001_schema_reconcile_and_rls.sql` to:
   - Create core tables from snapshot if missing.
   - Add FK constraints from snapshot if missing.
   - Enable RLS and seed key policies for owner/public access patterns.
   - Include app-alignment fields for `public.listings` used by current UI.

2. Kept migration idempotent with `if not exists` patterns to reduce risk when environments already have parts of the schema.

## Follow-up recommendation

Before applying to production, run in staging first and inspect for naming collisions with existing constraints/policies in your current Supabase project.
