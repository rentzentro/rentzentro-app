const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSubscriptionPortal,
} = require('../app/api/subscription/portal/portalFlow.js');

const makeSupabaseAuth = ({ user = { id: 'user-1' }, error = null } = {}) => ({
  auth: {
    getUser: async () => ({ data: { user }, error }),
  },
});

const makeSupabaseAdmin = ({ landlord, landlordError = null }) => ({
  from: (table) => {
    assert.equal(table, 'landlords');
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: landlord, error: landlordError }),
        }),
      }),
    };
  },
});

test('rejects missing bearer token', async () => {
  const result = await createSubscriptionPortal({
    stripe: {},
    supabaseAdmin: {},
    supabaseAuth: {},
    appUrl: 'http://localhost:3000',
    authHeader: '',
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'Missing bearer token.');
});

test('rejects invalid landlordId type', async () => {
  const result = await createSubscriptionPortal({
    stripe: {},
    supabaseAdmin: {},
    supabaseAuth: makeSupabaseAuth(),
    appUrl: 'http://localhost:3000',
    authHeader: 'Bearer token',
    landlordId: '44',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Invalid landlordId.');
});

test('rejects landlordId mismatch', async () => {
  const result = await createSubscriptionPortal({
    stripe: {},
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 10, user_id: 'user-1', stripe_customer_id: 'cus_1' },
    }),
    supabaseAuth: makeSupabaseAuth(),
    appUrl: 'http://localhost:3000',
    authHeader: 'Bearer token',
    landlordId: 9,
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'Forbidden: landlordId does not match authenticated account.');
});

test('creates billing portal session for authenticated landlord', async () => {
  const capturedPayloads = [];

  const result = await createSubscriptionPortal({
    stripe: {
      billingPortal: {
        sessions: {
          create: async (payload) => {
            capturedPayloads.push(payload);
            return { url: 'https://billing.stripe.test/session-abc' };
          },
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 10, user_id: 'user-1', stripe_customer_id: 'cus_1' },
    }),
    supabaseAuth: makeSupabaseAuth(),
    appUrl: 'https://rentzentro.com',
    authHeader: 'Bearer token',
    landlordId: 10,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://billing.stripe.test/session-abc');
  assert.equal(capturedPayloads.length, 1);
  assert.deepEqual(capturedPayloads[0], {
    customer: 'cus_1',
    return_url: 'https://rentzentro.com/landlord/settings',
  });
});
