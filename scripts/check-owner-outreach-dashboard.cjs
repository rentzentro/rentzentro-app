#!/usr/bin/env node
const { readFileSync } = require('node:fs');

const dashboardPath = 'app/owner/dashboard/page.tsx';
const dashboardSource = readFileSync(dashboardPath, 'utf8');

const forbiddenPatterns = [
  {
    pattern: /DEFAULT_OUTREACH_GMAIL_ACCOUNT/,
    message:
      'DEFAULT_OUTREACH_GMAIL_ACCOUNT should not be used; activation outreach sends through the server endpoint.',
  },
  {
    pattern: /SECONDARY_OUTREACH_GMAIL_ACCOUNT/,
    message:
      'SECONDARY_OUTREACH_GMAIL_ACCOUNT should not be used; activation outreach sends through the server endpoint.',
  },
  {
    pattern: /buildGmailHelpEmailHref/,
    message:
      'buildGmailHelpEmailHref should not be used; browser Gmail compose links can send from personal inboxes.',
  },
  {
    pattern: /mail\.google\.com/,
    message:
      'Owner activation outreach should not link to Gmail; use /api/owner/activation-outreach-email.',
  },
];

const failures = forbiddenPatterns.filter(({ pattern }) =>
  pattern.test(dashboardSource)
);

if (failures.length) {
  console.error('Owner dashboard activation outreach check failed:');
  for (const failure of failures) {
    console.error(`- ${failure.message}`);
  }
  process.exit(1);
}

if (!dashboardSource.includes('/api/owner/activation-outreach-email')) {
  console.error(
    'Owner dashboard activation outreach check failed: expected /api/owner/activation-outreach-email usage.'
  );
  process.exit(1);
}

console.log('Owner dashboard activation outreach check passed.');
