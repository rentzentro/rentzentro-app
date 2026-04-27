const test = require('node:test');
const assert = require('node:assert/strict');

const { syncReferralEligibilityForLandlord } = require('../app/lib/referralRewards.js');

function makeSupabaseAdmin({ landlord, referralEvent, rewardRows = [{ id: 'reward-1' }] }) {
  return {
    from(table) {
      if (table === 'landlords') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: landlord || null, error: null }),
                };
              },
            };
          },
        };
      }

      if (table === 'referral_events') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: referralEvent || null, error: null }),
                };
              },
            };
          },
          update() {
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }

      if (table === 'referral_rewards') {
        return {
          upsert() {
            return {
              select: async () => ({ data: rewardRows, error: null }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

test('syncReferralEligibilityForLandlord skips when subscription is inactive', async () => {
  const result = await syncReferralEligibilityForLandlord({
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 2, subscription_status: 'past_due' },
      referralEvent: null,
    }),
    landlordId: 2,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'subscription_not_active');
  assert.equal(result.rewardCreated, false);
});

test('syncReferralEligibilityForLandlord returns no_referral_event when none exists', async () => {
  const result = await syncReferralEligibilityForLandlord({
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 2, subscription_status: 'active' },
      referralEvent: null,
    }),
    landlordId: 2,
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, 'no_referral_event');
});

test('syncReferralEligibilityForLandlord marks eligible and creates reward', async () => {
  const result = await syncReferralEligibilityForLandlord({
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 22, subscription_status: 'active' },
      referralEvent: {
        id: 'event-22',
        status: 'attributed',
        referrer_landlord_id: 7,
        referred_landlord_id: 22,
      },
    }),
    landlordId: 22,
    reason: 'stripe_customer.subscription.updated',
  });

  assert.equal(result.ok, true);
  assert.equal(result.eligibleUpdated, true);
  assert.equal(result.rewardCreated, true);
  assert.equal(result.referralEventId, 'event-22');
});
