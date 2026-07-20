#!/usr/bin/env node
const { readFileSync } = require('node:fs');

const dashboardPath = 'app/owner/dashboard/page.tsx';
const dashboardSource = readFileSync(dashboardPath, 'utf8');

const forbiddenPatterns = [
  /activationOutreach/,
  /activation-outreach-email/,
  /Send from support/,
  /Send from Bradley/,
  /Recently contacted \/ snoozed/,
  /followUpCooldownDays/,
  /maxFollowUps/,
  /followUpCount/,
  /follow-up queue/,
  /Paid vs trialing/,
  /trial → paid/,
];

const failure = forbiddenPatterns.find((pattern) => pattern.test(dashboardSource));

if (failure) {
  console.error(`Owner dashboard setup opportunities check failed: forbidden pattern ${failure} found.`);
  process.exit(1);
}

const requiredPatterns = [
  /setupOpportunities/,
  /Setup opportunities/,
  /Manual follow-ups are gone/,
  /Paid, free, and over-limit/,
  /Over free limit/,
  /free → paid/,
];

const missing = requiredPatterns.find((pattern) => !pattern.test(dashboardSource));

if (missing) {
  console.error(`Owner dashboard setup opportunities check failed: required pattern ${missing} missing.`);
  process.exit(1);
}

console.log('Owner dashboard setup opportunities check passed.');
