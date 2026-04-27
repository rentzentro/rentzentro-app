const test = require('node:test');
const assert = require('node:assert/strict');

const {
  syncReferralEligibilityForLandlord,
  flagReferralRewardRiskForLandlord,
} = require('../app/lib/referralRewards.js');

function makeSupabaseAdmin({
  landlord,
  referralEvent,
  rewardRows = [{ id: 'reward-1' }],
  existingRewardsForRisk = [],
}) {
  const state = {
    upsertPayload: null,
    riskUpdates: [],
  };

  return {
    __state: state,
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
          select() {
            return {
              eq() {
                return {
                  in: async () => ({ data: existingRewardsForRisk, error: null }),
                };
              },
            };
          },
          upsert(payload) {
            state.upsertPayload = payload;
            return {
              select: async () => ({ data: rewardRows, error: null }),
            };
          },
          update(payload) {
            return {
              eq: async (_column, rewardId) => {
                state.riskUpdates.push({ rewardId, payload });
                return { error: null };
              },
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

test('syncReferralEligibilityForLandlord stores holdback metadata on new rewards', async () => {
  const supabaseAdmin = makeSupabaseAdmin({
    landlord: { id: 22, subscription_status: 'active' },
    referralEvent: {
      id: 'event-22',
      status: 'eligible',
      referrer_landlord_id: 7,
      referred_landlord_id: 22,
    },
  });

  await syncReferralEligibilityForLandlord({
    supabaseAdmin,
    landlordId: 22,
    reason: 'stripe_customer.subscription.updated',
  });

  const insertedReward = supabaseAdmin.__state.upsertPayload[0];
  assert.equal(insertedReward.cancellation_risk_flag, false);
  assert.match(insertedReward.qualified_at, /T/);
  assert.match(insertedReward.hold_until, /T/);
});

test('flagReferralRewardRiskForLandlord marks matching rewards as high risk', async () => {
  const supabaseAdmin = makeSupabaseAdmin({
    existingRewardsForRisk: [
      { id: 'reward-1', status: 'pending', notes: 'Initial note' },
      { id: 'reward-2', status: 'approved', notes: null },
    ],
  });

  const result = await flagReferralRewardRiskForLandlord({
    supabaseAdmin,
    landlordId: 31,
    reason: 'subscription_canceled',
  });

  assert.equal(result.ok, true);
  assert.equal(result.updatedCount, 2);
  assert.equal(supabaseAdmin.__state.riskUpdates.length, 2);
  assert.equal(supabaseAdmin.__state.riskUpdates[0].payload.cancellation_risk_flag, true);
  assert.match(
    supabaseAdmin.__state.riskUpdates[0].payload.notes,
    /Risk flagged: subscription_canceled/
  );
});
