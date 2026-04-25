const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createSubscriptionCheckout,
} = require('../app/api/subscription/checkout/checkoutFlow.js');

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
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    };
  },
});

test('rejects missing bearer token', async () => {
  const result = await createSubscriptionCheckout({
    stripe: {},
    supabaseAdmin: {},
    supabaseAuth: {},
    subscriptionPriceId: 'price_123',
    appUrl: 'http://localhost:3000',
    authHeader: '',
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'Missing bearer token.');
});

test('rejects landlordId type mismatch', async () => {
  const result = await createSubscriptionCheckout({
    stripe: {},
    supabaseAdmin: {},
    supabaseAuth: makeSupabaseAuth(),
    subscriptionPriceId: 'price_123',
    appUrl: 'http://localhost:3000',
    authHeader: 'Bearer token',
    landlordId: '123',
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Invalid landlordId in request body.');
});

test('rejects landlordId that does not match authenticated landlord', async () => {
  const result = await createSubscriptionCheckout({
    stripe: {},
    supabaseAdmin: makeSupabaseAdmin({
      landlord: {
        id: 12,
        user_id: 'user-1',
        email: 'owner@example.com',
        stripe_customer_id: 'cus_existing',
      },
    }),
    supabaseAuth: makeSupabaseAuth(),
    subscriptionPriceId: 'price_123',
    appUrl: 'http://localhost:3000',
    authHeader: 'Bearer token',
    landlordId: 99,
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'Forbidden: landlordId does not match authenticated account.');
});

test('creates checkout session for authenticated landlord', async () => {
  const capturedSessions = [];
  const result = await createSubscriptionCheckout({
    stripe: {
      customers: {
        create: async () => ({ id: 'cus_created' }),
      },
      subscriptions: {
        list: async () => ({ data: [] }),
      },
      checkout: {
        sessions: {
          create: async (payload) => {
            capturedSessions.push(payload);
            return { url: 'https://checkout.stripe.test/session-1' };
          },
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      landlord: {
        id: 44,
        user_id: 'user-1',
        email: 'owner@example.com',
        stripe_customer_id: null,
      },
    }),
    supabaseAuth: makeSupabaseAuth(),
    subscriptionPriceId: 'price_123',
    appUrl: 'https://rentzentro.com',
    authHeader: 'Bearer token',
    landlordId: 44,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://checkout.stripe.test/session-1');
  assert.equal(capturedSessions.length, 1);

  const session = capturedSessions[0];
  assert.equal(session.mode, 'subscription');
  assert.equal(session.customer, 'cus_created');
  assert.equal(session.client_reference_id, '44');
  assert.equal(session.success_url, 'https://rentzentro.com/landlord/settings?billing=success');
  assert.equal(session.cancel_url, 'https://rentzentro.com/landlord/settings?billing=cancelled');
  assert.equal(session.metadata.landlordId, '44');
  assert.equal(session.subscription_data.metadata.landlordId, '44');
});

test('blocks checkout when landlord already has an active subscription', async () => {
  const result = await createSubscriptionCheckout({
    stripe: {
      subscriptions: {
        list: async () => ({ data: [{ id: 'sub_existing', status: 'active' }] }),
      },
      billingPortal: {
        sessions: {
          create: async () => ({ url: 'https://billing.stripe.test/session-1' }),
        },
      },
      checkout: {
        sessions: {
          create: async () => ({ url: 'https://checkout.stripe.test/session-2' }),
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      landlord: {
        id: 55,
        user_id: 'user-1',
        email: 'owner@example.com',
        stripe_customer_id: 'cus_existing',
      },
    }),
    supabaseAuth: makeSupabaseAuth(),
    subscriptionPriceId: 'price_123',
    appUrl: 'https://rentzentro.com',
    authHeader: 'Bearer token',
    landlordId: 55,
  });

  assert.equal(result.status, 409);
  assert.equal(
    result.body.error,
    'You already have an active subscription. Manage it in billing.'
  );
  assert.equal(result.body.portalUrl, 'https://billing.stripe.test/session-1');
});
