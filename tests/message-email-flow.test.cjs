const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getDirection,
  buildRecipients,
  buildMessageEmail,
} = require('../app/api/message-email/messageEmailFlow.js');

test('getDirection maps tenant/landlord/team sender types', () => {
  assert.equal(getDirection('tenant'), 'tenant_to_landlord');
  assert.equal(getDirection('landlord'), 'landlord_or_team_to_tenant');
  assert.equal(getDirection('team'), 'landlord_or_team_to_tenant');
  assert.equal(getDirection('unknown'), null);
});

test('buildRecipients for tenant message includes landlord and active team emails uniquely', () => {
  const recipients = buildRecipients({
    direction: 'tenant_to_landlord',
    landlordEmail: 'Owner@Example.com ',
    tenantEmail: 'tenant@example.com',
    teamEmails: [
      'Team1@example.com',
      ' owner@example.com',
      'TEAM1@example.com',
      '',
    ],
  });

  assert.deepEqual(recipients, ['owner@example.com', 'team1@example.com']);
});

test('buildRecipients for landlord/team messages only targets tenant', () => {
  const recipients = buildRecipients({
    direction: 'landlord_or_team_to_tenant',
    landlordEmail: 'owner@example.com',
    tenantEmail: 'tenant@example.com',
    teamEmails: ['team@example.com'],
  });

  assert.deepEqual(recipients, ['tenant@example.com']);
});

test('buildMessageEmail includes tenant subject and preview truncation', () => {
  const body = 'A'.repeat(190);

  const email = buildMessageEmail({
    direction: 'tenant_to_landlord',
    landlordName: 'Casey Owner',
    tenantName: 'Jordan Tenant',
    messageBody: body,
  });

  assert.equal(email.subject, 'New message from Jordan Tenant in RentZentro');
  assert.match(email.text, /Jordan Tenant sent you a new message/);
  assert.equal(email.preview.length, 178);
  assert.match(email.preview, /…$/);
});

test('buildMessageEmail for landlord/team preserves full body in text payload', () => {
  const body = 'Please review the lease addendum.';

  const email = buildMessageEmail({
    direction: 'landlord_or_team_to_tenant',
    landlordName: 'Casey Owner',
    tenantName: 'Jordan Tenant',
    messageBody: body,
  });

  assert.equal(email.subject, 'New message from your landlord in RentZentro');
  assert.match(email.text, /Casey Owner sent you a new message/);
  assert.match(email.text, /Please review the lease addendum\./);
});
