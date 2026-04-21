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
              return {
                maybeSingle: async () => {
                  if (table === 'tenants' && column === 'id') {
                    return { data: value === tenant?.id ? tenant : null, error: null };
                  }

                  if (table === 'properties' && column === 'id') {
                    return { data: value === property?.id ? property : null, error: null };
                  }

                  if (table === 'landlords' && column === 'id') {
                    return { data: landlordById || null, error: null };
                  }

                  if (table === 'landlords' && column === 'user_id') {
                    return { data: landlordByUserId || null, error: null };
                  }

                  return { data: null, error: null };
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
  assert.equal(result.body.error, 'Missing tenantId.');
});

test('createCheckoutSession builds card rent payment with fee and transfer', async () => {
  const stripeCalls = [];

  const result = await createCheckoutSession({
    stripe: {
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
      tenant: { id: 10, property_id: 22, owner_id: 5 },
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
});

test('createCheckoutSession builds ACH rent payment with fixed fee and verification options', async () => {
  const stripeCalls = [];

  const result = await createCheckoutSession({
    stripe: {
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
