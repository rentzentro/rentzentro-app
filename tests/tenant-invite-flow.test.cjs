const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantInviteEmail,
  sendTenantInvite,
} = require('../app/api/tenant-invite/tenantInviteFlow.js');

test('buildTenantInviteEmail applies defaults and encodes email signup URL', () => {
  const email = buildTenantInviteEmail({ tenantEmail: 'alex+tenant@example.com' });

  assert.equal(
    email.subject,
    "You're invited to pay rent online for your rental"
  );
  assert.match(email.text, /Hi there,/);
  assert.match(email.text, /your landlord has invited you/);
  assert.match(
    email.text,
    /https:\/\/www\.rentzentro\.com\/tenant\/signup\?email=alex%2Btenant%40example\.com/
  );
});

test('buildTenantInviteEmail includes unit label and trimmed display values', () => {
  const email = buildTenantInviteEmail({
    tenantEmail: 'tenant@example.com',
    tenantName: '  Jordan  ',
    propertyName: '  Oak Apartments  ',
    unitLabel: ' Unit 3B ',
    landlordName: '  Casey  ',
  });

  assert.equal(
    email.subject,
    "You're invited to pay rent online for Oak Apartments · Unit 3B"
  );
  assert.match(email.text, /Hi Jordan,/);
  assert.match(email.text, /Casey has invited you/);
  assert.match(email.html, /Oak Apartments · Unit 3B/);
});

test('sendTenantInvite validates missing tenant email', async () => {
  const result = await sendTenantInvite({
    resend: { emails: { send: async () => ({}) } },
    fromEmail: 'from@example.com',
    replyTo: 'reply@example.com',
    tenantEmail: '',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Missing tenantEmail in request body.');
});

test('sendTenantInvite sends payload to resend', async () => {
  const sentPayloads = [];

  const result = await sendTenantInvite({
    resend: {
      emails: {
        send: async (payload) => {
          sentPayloads.push(payload);
          return { id: 'email_123' };
        },
      },
    },
    fromEmail: 'RentZentro <notifications@rentzentro.com>',
    replyTo: 'rentzentro@gmail.com',
    tenantEmail: 'tenant@example.com',
    tenantName: 'Taylor',
    propertyName: 'Main Street Homes',
    unitLabel: 'Unit 1',
    landlordName: 'Morgan',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(sentPayloads.length, 1);
  assert.equal(sentPayloads[0].to, 'tenant@example.com');
  assert.equal(
    sentPayloads[0].subject,
    "You're invited to pay rent online for Main Street Homes · Unit 1"
  );
  assert.equal(sentPayloads[0].reply_to, 'rentzentro@gmail.com');
});
