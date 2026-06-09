const test = require('node:test');
const assert = require('node:assert/strict');

const { createCheckoutSession } = require('../app/api/checkout/checkoutFlow.js');

function makeSupabaseAdmin({ tenant, property, landlordById, landlordByUserId }) {
  return {
    from(table) {
      return {
        select() {
          return {
            eq(column, value) {
              const resolveSingle = () => {
                if (table === 'tenants' && column === 'id') {
                  return String(value) === String(tenant?.id) ? tenant : null;
                }

                if (table === 'tenants' && column === 'user_id') {
                  return value === tenant?.user_id ? tenant : null;
                }

                if (table === 'tenants' && column === 'email') {
                  return value === tenant?.email ? tenant : null;
                }

                if (table === 'properties' && column === 'id') {
                  return value === property?.id ? property : null;
                }

                if (table === 'landlords' && column === 'id') {
                  return landlordById || null;
                }

                if (table === 'landlords' && column === 'user_id') {
                  return landlordByUserId || null;
                }

                return null;
              };

              return {
                maybeSingle: async () => ({ data: resolveSingle(), error: null }),
                order() {
                  return {
                    limit: async () => {
                      const row = resolveSingle();
                      return { data: row ? [row] : [], error: null };
                    },
                  };
                },
              };
            },
            ilike(column, value) {
              const resolveSingle = () => {
                if (table === 'tenants' && column === 'email') {
                  return String(value).toLowerCase() === String(tenant?.email).toLowerCase()
                    ? tenant
                    : null;
                }
                return null;
              };

              return {
                order() {
                  return {
                    limit: async () => {
                      const row = resolveSingle();
                      return { data: row ? [row] : [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test('createCheckoutSession returns 400 for missing tenant id', async () => {
  const result = await createCheckoutSession({
    stripe: { checkout: { sessions: { create: async () => ({}) } } },
    supabaseAdmin: makeSupabaseAdmin({}),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: { amount: 1000 },
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Missing tenant identifier.');
});

test('createCheckoutSession builds card rent payment with fee and transfer', async () => {
  const stripeCalls = [];

  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [{ id: 'pm_1' }] }),
      },
      checkout: {
        sessions: {
          create: async (params) => {
            stripeCalls.push(params);
            return { url: 'https://stripe.test/checkout/card' };
          },
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: { id: 10, property_id: 22, owner_id: 5, stripe_customer_id: 'cus_123' },
      property: { id: 22, name: 'Sunset Villas', unit_label: 'Unit 4', owner_id: 5 },
      landlordById: {
        id: 5,
        stripe_connect_account_id: 'acct_123',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: { amount: 1500, tenantId: 10, paymentMethodType: 'card' },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://stripe.test/checkout/card');
  assert.equal(stripeCalls.length, 1);

  const params = stripeCalls[0];
  assert.equal(params.payment_method_types[0], 'card');
  assert.equal(params.line_items.length, 2);
  assert.equal(params.line_items[0].price_data.unit_amount, 150000);
  assert.equal(params.line_items[1].price_data.unit_amount, 5300);
  assert.equal(params.metadata.rent_cents, '150000');
  assert.equal(params.metadata.fee_cents, '5300');
  assert.equal(params.metadata.total_cents, '155300');
  assert.equal(params.payment_intent_data.transfer_data.destination, 'acct_123');
  assert.equal(params.payment_intent_data.transfer_data.amount, 150000);
  assert.deepEqual(params.payment_method_options, {
    card: { request_three_d_secure: 'any' },
  });
});

test('createCheckoutSession builds ACH rent payment with fixed fee and verification options', async () => {
  const stripeCalls = [];

  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [{ id: 'pm_1' }] }),
      },
      checkout: {
        sessions: {
          create: async (params) => {
            stripeCalls.push(params);
            return { url: 'https://stripe.test/checkout/ach' };
          },
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: { id: 11, property_id: 24, owner_id: null },
      property: { id: 24, name: 'Maple Court', unit_label: null, owner_id: 'user_abc' },
      landlordById: null,
      landlordByUserId: {
        id: 99,
        stripe_connect_account_id: 'acct_ach',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: { amount: 1200, tenantId: 11, paymentMethodType: 'us_bank_account' },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://stripe.test/checkout/ach');

  const params = stripeCalls[0];
  assert.equal(params.payment_method_types[0], 'us_bank_account');
  assert.equal(params.line_items[0].price_data.unit_amount, 120000);
  assert.equal(params.line_items[1].price_data.unit_amount, 500);
  assert.deepEqual(params.payment_method_options, {
    us_bank_account: { verification_method: 'automatic' },
  });
  assert.equal(params.metadata.fee_cents, '500');
  assert.equal(params.metadata.total_cents, '120500');
});

test('createCheckoutSession rejects very small rent payments used in card testing', async () => {
  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [{ id: 'pm_1' }] }),
      },
      checkout: { sessions: { create: async () => ({}) } },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: { id: 10, property_id: 22, owner_id: 5, stripe_customer_id: 'cus_123' },
      property: { id: 22, name: 'Sunset Villas', unit_label: 'Unit 4', owner_id: 5 },
      landlordById: {
        id: 5,
        stripe_connect_account_id: 'acct_123',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: { amount: 25, tenantId: 10, paymentMethodType: 'card' },
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.error, 'Minimum payment amount is $50.00.');
});

test('createCheckoutSession requires pre-verified card before card checkout', async () => {
  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [] }),
      },
      checkout: { sessions: { create: async () => ({ url: 'https://stripe.test/checkout/card' }) } },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: { id: 10, property_id: 22, owner_id: 5, stripe_customer_id: 'cus_123' },
      property: { id: 22, name: 'Sunset Villas', unit_label: 'Unit 4', owner_id: 5 },
      landlordById: {
        id: 5,
        stripe_connect_account_id: 'acct_123',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: { amount: 1500, tenantId: 10, paymentMethodType: 'card' },
  });

  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'CARD_VERIFICATION_REQUIRED');
});


test('createCheckoutSession falls back to tenant user_id lookup when tenantId string is numeric-like', async () => {
  const stripeCalls = [];

  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [{ id: 'pm_1' }] }),
      },
      checkout: {
        sessions: {
          create: async (params) => {
            stripeCalls.push(params);
            return { url: 'https://stripe.test/checkout/card-fallback' };
          },
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: {
        id: 21,
        user_id: '12345',
        property_id: 22,
        owner_id: 5,
        stripe_customer_id: 'cus_123',
      },
      property: { id: 22, name: 'Sunset Villas', unit_label: 'Unit 4', owner_id: 5 },
      landlordById: {
        id: 5,
        stripe_connect_account_id: 'acct_123',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: { amount: 1500, tenantId: '12345', paymentMethodType: 'card' },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://stripe.test/checkout/card-fallback');
  assert.equal(stripeCalls.length, 1);
});


test('createCheckoutSession resolves tenant by large numeric string id without precision loss', async () => {
  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: { list: async () => ({ data: [{ id: 'pm_1' }] }) },
      checkout: { sessions: { create: async () => ({ url: 'https://stripe.test/checkout/large-id' }) } },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: { id: '9007199254740993123', property_id: 24, owner_id: null },
      property: { id: 24, name: 'Maple Court', unit_label: null, owner_id: 'user_abc' },
      landlordByUserId: {
        id: 99,
        stripe_connect_account_id: 'acct_ach',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: { amount: 1200, tenantId: '9007199254740993123', paymentMethodType: 'us_bank_account' },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://stripe.test/checkout/large-id');
});

test('createCheckoutSession resolves tenant by email case-insensitively', async () => {
  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [{ id: 'pm_1' }] }),
      },
      checkout: {
        sessions: {
          create: async () => ({ url: 'https://stripe.test/checkout/email-match' }),
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: {
        id: 18,
        user_id: 'user-email',
        email: 'tenant@example.com',
        property_id: 22,
        owner_id: 5,
        stripe_customer_id: 'cus_123',
      },
      property: { id: 22, name: 'Sunset Villas', unit_label: 'Unit 4', owner_id: 5 },
      landlordById: {
        id: 5,
        stripe_connect_account_id: 'acct_123',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: {
      amount: 1500,
      tenantId: 'not-a-match',
      tenantEmail: 'TENANT@EXAMPLE.COM',
      paymentMethodType: 'card',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://stripe.test/checkout/email-match');
});

test('createCheckoutSession resolves authenticated tenant before stale client tenant id for ACH', async () => {
  const stripeCalls = [];

  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [{ id: 'pm_1' }] }),
      },
      checkout: {
        sessions: {
          create: async (params) => {
            stripeCalls.push(params);
            return { url: 'https://stripe.test/checkout/auth-email-ach' };
          },
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: {
        id: 42,
        user_id: 'auth-tenant-user',
        email: 'signedup@example.com',
        property_id: 24,
        owner_id: null,
      },
      property: { id: 24, name: 'Maple Court', unit_label: null, owner_id: 'user_abc' },
      landlordByUserId: {
        id: 99,
        stripe_connect_account_id: 'acct_ach',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: {
      amount: 1200,
      tenantId: 999999,
      authUserId: 'auth-tenant-user',
      authEmail: 'signedup@example.com',
      paymentMethodType: 'us_bank_account',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://stripe.test/checkout/auth-email-ach');
  assert.equal(stripeCalls[0].metadata.tenant_id, '42');
});

test('createCheckoutSession resolves authenticated tenant before stale client tenant id for card', async () => {
  const stripeCalls = [];

  const result = await createCheckoutSession({
    stripe: {
      paymentMethods: {
        list: async () => ({ data: [{ id: 'pm_verified' }] }),
      },
      checkout: {
        sessions: {
          create: async (params) => {
            stripeCalls.push(params);
            return { url: 'https://stripe.test/checkout/auth-email-card' };
          },
        },
      },
    },
    supabaseAdmin: makeSupabaseAdmin({
      tenant: {
        id: 43,
        user_id: 'auth-card-user',
        email: 'cardholder@example.com',
        property_id: 25,
        owner_id: 5,
        stripe_customer_id: 'cus_verified',
      },
      property: { id: 25, name: 'Oak Flats', unit_label: '2R', owner_id: 5 },
      landlordById: {
        id: 5,
        stripe_connect_account_id: 'acct_card',
        stripe_connect_onboarded: true,
      },
    }),
    appUrl: 'https://www.rentzentro.com',
    esignPriceId: 'price_123',
    body: {
      amount: 1500,
      tenantId: 123456,
      authUserId: 'auth-card-user',
      authEmail: 'cardholder@example.com',
      paymentMethodType: 'card',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.url, 'https://stripe.test/checkout/auth-email-card');
  assert.equal(stripeCalls[0].metadata.tenant_id, '43');
  assert.equal(stripeCalls[0].payment_method_types[0], 'card');
});
