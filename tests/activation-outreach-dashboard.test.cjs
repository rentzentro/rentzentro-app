const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const dashboardSource = readFileSync('app/owner/dashboard/page.tsx', 'utf8');
const routeSource = readFileSync(
  'app/api/owner/activation-outreach-email/route.ts',
  'utf8'
);

test('owner dashboard sends activation outreach through server endpoint, not Gmail compose', () => {
  assert.doesNotMatch(dashboardSource, /DEFAULT_OUTREACH_GMAIL_ACCOUNT/);
  assert.doesNotMatch(dashboardSource, /buildGmailHelpEmailHref/);
  assert.match(dashboardSource, /\/api\/owner\/activation-outreach-email/);
  assert.match(dashboardSource, /Send from support/);
  assert.match(dashboardSource, /Send from Bradley/);
});

test('activation outreach email route defines RentZentro sender identities', () => {
  assert.match(routeSource, /RentZentro Support <support@rentzentro\.com>/);
  assert.match(routeSource, /Bradley at RentZentro <bradley@rentzentro\.com>/);
  assert.match(routeSource, /resend\.emails\.send/);
});
