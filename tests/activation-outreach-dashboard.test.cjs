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
});

test('owner metrics returns setup opportunities without outreach snoozing', () => {
  assert.doesNotMatch(metricsRouteSource, /loadActivationOutreachEvents/);
  assert.doesNotMatch(metricsRouteSource, /recentlyContacted/);
  assert.doesNotMatch(metricsRouteSource, /daysSinceLastOutreach/);
  assert.doesNotMatch(metricsRouteSource, /followUpExpired/);
  assert.match(metricsRouteSource, /setupOpportunities/);
  assert.match(metricsRouteSource, /setupOpportunityLandlords/);
  assert.match(metricsRouteSource, /freeLandlords/);
});
