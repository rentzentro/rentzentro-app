const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const dashboardSource = readFileSync('app/owner/dashboard/page.tsx', 'utf8');
const routeSource = readFileSync(
  'app/api/owner/activation-outreach-email/route.ts',
  'utf8'
);
const metricsRouteSource = readFileSync('app/api/owner/metrics/route.ts', 'utf8');
const outreachMigrationSource = readFileSync(
  'supabase/migrations/202604280002_owner_activation_outreach_events.sql',
  'utf8'
);

test('owner dashboard sends activation outreach through server endpoint, not Gmail compose', () => {
  assert.doesNotMatch(dashboardSource, /DEFAULT_OUTREACH_GMAIL_ACCOUNT/);
  assert.doesNotMatch(dashboardSource, /buildGmailHelpEmailHref/);
  assert.match(dashboardSource, /\/api\/owner\/activation-outreach-email/);
  assert.match(dashboardSource, /Send from support/);
  assert.match(dashboardSource, /Send from Bradley/);
  assert.match(dashboardSource, /Recently contacted \/ snoozed/);
  assert.match(dashboardSource, /followUpCooldownDays/);
});

test('activation outreach email route defines RentZentro sender identities', () => {
  assert.match(routeSource, /RentZentro Support <support@rentzentro\.com>/);
  assert.match(routeSource, /Bradley at RentZentro <bradley@rentzentro\.com>/);
  assert.match(routeSource, /resend\.emails\.send/);
  assert.match(routeSource, /owner_activation_outreach_events/);
  assert.match(routeSource, /ACTIVATION_OUTREACH_FOLLOW_UP_DAYS = 5/);
});

test('activation outreach metrics snooze recent follow-ups for five days', () => {
  assert.match(metricsRouteSource, /ACTIVATION_OUTREACH_FOLLOW_UP_DAYS = 5/);
  assert.match(metricsRouteSource, /recentlyContacted/);
  assert.match(metricsRouteSource, /daysSinceLastOutreach/);
  assert.match(outreachMigrationSource, /create table if not exists public\.owner_activation_outreach_events/);
  assert.match(outreachMigrationSource, /landlord_id bigint not null references public\.landlords/);
});
