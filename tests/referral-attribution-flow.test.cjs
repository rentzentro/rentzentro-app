const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeReferralCode,
  attributeReferral,
} = require('../app/api/referrals/attribution/attributionFlow.js');

function makeSupabaseAdmin({ referredLandlord, codeRow, upsertError = null, codeError = null }) {
  return {
    from(table) {
      if (table === 'landlords') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: referredLandlord || null, error: null }),
                };
              },
            };
          },
        };
      }

      if (table === 'referral_codes') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      maybeSingle: async () => ({ data: codeRow || null, error: codeError }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'referral_events') {
        return {
          upsert() {
            return {
              select: async () => ({ data: upsertError ? null : [{ id: 'event-1' }], error: upsertError }),
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

test('normalizeReferralCode enforces uppercase + pattern', () => {
  assert.equal(normalizeReferralCode('rzl-9'), 'RZL-9');
  assert.equal(normalizeReferralCode(''), null);
  assert.equal(normalizeReferralCode('bad code!'), null);
});

test('attributeReferral blocks self referral', async () => {
  const result = await attributeReferral({
    supabaseAdmin: makeSupabaseAdmin({
      referredLandlord: { id: 12, user_id: 'user-12' },
      codeRow: { landlord_id: 12, code: 'RZL-12', active: true },
    }),
    payload: {
      landlordId: 12,
      userId: 'user-12',
      referralCode: 'RZL-12',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.attributed, false);
  assert.equal(result.body.reason, 'self_referral_blocked');
});

test('attributeReferral creates event for valid referral code', async () => {
  const result = await attributeReferral({
    supabaseAdmin: makeSupabaseAdmin({
      referredLandlord: { id: 21, user_id: 'user-21' },
      codeRow: { landlord_id: 7, code: 'RZL-7', active: true },
    }),
    payload: {
      landlordId: 21,
      userId: 'user-21',
      referralCode: 'rzl-7',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.attributed, true);
  assert.equal(result.body.referrerLandlordId, 7);
  assert.equal(result.body.referralCode, 'RZL-7');
});
