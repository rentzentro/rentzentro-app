const test = require('node:test');
const assert = require('node:assert/strict');

const { submitDeleteRequest } = require('../app/api/account/delete-request/deleteRequestFlow.js');

const makeSupabaseAuth = ({ user = { id: 'user-1' }, error = null } = {}) => ({
  auth: {
    getUser: async () => ({ data: { user }, error }),
  },
});

const makeSupabaseAdmin = ({ landlord, landlordError = null } = {}) => ({
  from(table) {
    assert.equal(table, 'landlords');
    return {
      select() {
        return this;
      },
      eq(column, value) {
        assert.equal(column, 'user_id');
        this.userId = value;
        return this;
      },
      async maybeSingle() {
        if (landlordError) return { data: null, error: landlordError };
        if (landlord && this.userId === landlord.user_id) return { data: landlord, error: null };
        return { data: null, error: null };
      },
    };
  },
});

test('requires bearer token for account deletion request', async () => {
  const result = await submitDeleteRequest({
    supabaseAdmin: makeSupabaseAdmin(),
    supabaseAuth: makeSupabaseAuth(),
    authHeader: '',
    resendApiKey: 're_test',
    supportEmail: 'support@example.com',
    fromEmail: 'support@example.com',
    reason: 'cleanup',
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'Missing bearer token.');
});

test('forbids landlordId mismatch with authenticated landlord', async () => {
  const result = await submitDeleteRequest({
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 11, user_id: 'user-1', email: 'landlord@example.com', name: 'Jordan' },
    }),
    supabaseAuth: makeSupabaseAuth(),
    authHeader: 'Bearer token',
    landlordId: 99,
    resendApiKey: 're_test',
    supportEmail: 'support@example.com',
    fromEmail: 'support@example.com',
    reason: 'cleanup',
    fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'Forbidden: landlordId does not match authenticated account.');
});

test('sends deletion request using authenticated landlord identity', async () => {
  const sent = [];
  const result = await submitDeleteRequest({
    supabaseAdmin: makeSupabaseAdmin({
      landlord: {
        id: 11,
        user_id: 'user-1',
        email: 'actual-landlord@example.com',
        name: 'Jordan Owner',
      },
    }),
    supabaseAuth: makeSupabaseAuth(),
    authHeader: 'Bearer token',
    landlordId: 11,
    resendApiKey: 're_test',
    supportEmail: 'support@example.com',
    fromEmail: 'support@example.com',
    reason: 'Please delete my account.',
    fetchImpl: async (_url, init) => {
      sent.push(JSON.parse(init.body));
      return { ok: true, json: async () => ({ id: 'email_1' }) };
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].reply_to, 'actual-landlord@example.com');
  assert.match(sent[0].text, /Landlord ID: 11/);
  assert.match(sent[0].text, /Auth User ID: user-1/);
});
