const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTransition,
  applyReferralRewardAction,
} = require('../app/api/owner/referrals/rewards/rewardAdminFlow.js');

function makeSupabaseAdmin({ reward }) {
  return {
    from(table) {
      if (table === 'referral_reward_audit_logs') {
        return {
          insert: async () => ({ error: null }),
        };
      }

      assert.equal(table, 'referral_rewards');
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: reward || null, error: null }),
              };
            },
          };
        },
        update(payload) {
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({
                      data: { ...reward, ...payload },
                      error: null,
                    }),
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

test('buildTransition enforces approve -> mark_paid path', () => {
  assert.equal(buildTransition('pending', 'approve').ok, true);
  assert.equal(buildTransition('approved', 'mark_paid').ok, true);
  assert.equal(buildTransition('pending', 'mark_paid').ok, false);
});

test('applyReferralRewardAction rejects invalid action', async () => {
  const result = await applyReferralRewardAction({
    supabaseAdmin: makeSupabaseAdmin({ reward: { id: 'r1', status: 'pending', notes: null } }),
    payload: { rewardId: 'r1', action: 'ship_it' },
  });

  assert.equal(result.status, 400);
  assert.match(result.body.error, /Invalid action/);
});

test('applyReferralRewardAction approves pending reward', async () => {
  const result = await applyReferralRewardAction({
    supabaseAdmin: makeSupabaseAdmin({ reward: { id: 'r1', status: 'pending', notes: null } }),
    payload: { rewardId: 'r1', action: 'approve', processedBy: 'owner-1' },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.reward.status, 'approved');
  assert.equal(result.body.reward.processed_by, 'owner-1');
});
