const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const dashboardSource = readFileSync('app/owner/dashboard/page.tsx', 'utf8');
const metricsRouteSource = readFileSync('app/api/owner/metrics/route.ts', 'utf8');

test('owner dashboard replaces trial follow-up outreach with setup opportunities', () => {
  assert.doesNotMatch(dashboardSource, /activationOutreach/);
  assert.doesNotMatch(dashboardSource, /\/api\/owner\/activation-outreach-email/);
  assert.doesNotMatch(dashboardSource, /Send from support/);
  assert.doesNotMatch(dashboardSource, /Send from Bradley/);
  assert.doesNotMatch(dashboardSource, /Recently contacted \/ snoozed/);
  assert.doesNotMatch(dashboardSource, /followUpCooldownDays/);
  assert.doesNotMatch(dashboardSource, /maxFollowUps/);
  assert.doesNotMatch(dashboardSource, /followUpCount/);
  assert.doesNotMatch(dashboardSource, /expired from the follow-up queue/);
  assert.match(dashboardSource, /setupOpportunities/);
  assert.match(dashboardSource, /Setup opportunities/);
  assert.match(dashboardSource, /Manual follow-ups are gone/);
  assert.match(dashboardSource, /overLimitFreeLandlords/);
  assert.match(dashboardSource, /Over free limit/);
});

test('owner metrics returns setup opportunities without outreach snoozing', () => {
  assert.doesNotMatch(metricsRouteSource, /loadActivationOutreachEvents/);
  assert.doesNotMatch(metricsRouteSource, /recentlyContacted/);
  assert.doesNotMatch(metricsRouteSource, /daysSinceLastOutreach/);
  assert.doesNotMatch(metricsRouteSource, /followUpExpired/);
  assert.match(metricsRouteSource, /setupOpportunities/);
  assert.match(metricsRouteSource, /setupOpportunityLandlords/);
  assert.match(metricsRouteSource, /freeLandlords/);
  assert.match(metricsRouteSource, /overLimitFreeLandlords/);
  assert.match(metricsRouteSource, /unitCount <= 1/);
});


const landlordAccessGateSource = readFileSync('app/landlord/LandlordAccessGate.tsx', 'utf8');
const landlordDashboardSource = readFileSync('app/landlord/page.tsx', 'utf8');
const landlordSettingsSource = readFileSync('app/landlord/settings/page.tsx', 'utf8');
const tenantLandlordAccessSource = readFileSync('app/api/tenant-landlord-access/route.ts', 'utf8');

test('access gates do not treat trialing status as paid access', () => {
  for (const source of [
    landlordAccessGateSource,
    landlordDashboardSource,
    landlordSettingsSource,
    tenantLandlordAccessSource,
  ]) {
    assert.doesNotMatch(source, /status === 'trialing'/);
  }
  assert.match(landlordAccessGateSource, /unitCount <= 1/);
  assert.match(landlordDashboardSource, /unitCount <= 1/);
  assert.match(landlordSettingsSource, /unitCount <= 1/);
  assert.match(tenantLandlordAccessSource, /unitCount \|\| 0\) <= 1/);
});
