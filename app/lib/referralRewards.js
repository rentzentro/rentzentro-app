const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'active_cancel_at_period_end',
]);

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

async function syncReferralEligibilityForLandlord({
  supabaseAdmin,
  landlordId,
  reason = 'subscription_activation',
}) {
  if (!supabaseAdmin) {
    return { ok: false, error: 'Supabase admin client is not configured.' };
  }

  const normalizedLandlordId = Number(landlordId);
  if (!isPositiveInteger(normalizedLandlordId)) {
    return { ok: false, error: 'Invalid landlordId.' };
  }

  const { data: landlord, error: landlordError } = await supabaseAdmin
    .from('landlords')
    .select('id, subscription_status')
    .eq('id', normalizedLandlordId)
    .maybeSingle();

  if (landlordError) {
    return { ok: false, error: 'Unable to load landlord subscription status.' };
  }

  if (!landlord) {
    return { ok: false, error: 'Landlord account not found.' };
  }

  const subscriptionStatus = String(landlord.subscription_status || '').toLowerCase();
  if (!ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return {
      ok: true,
      eligibleUpdated: false,
      rewardCreated: false,
      reason: 'subscription_not_active',
    };
  }

  const { data: referralEvent, error: referralEventError } = await supabaseAdmin
    .from('referral_events')
    .select('id, status, referrer_landlord_id, referred_landlord_id')
    .eq('referred_landlord_id', normalizedLandlordId)
    .maybeSingle();

  if (referralEventError) {
    return { ok: false, error: 'Unable to load referral event.' };
  }

  if (!referralEvent) {
    return {
      ok: true,
      eligibleUpdated: false,
      rewardCreated: false,
      reason: 'no_referral_event',
    };
  }

  if (referralEvent.status !== 'eligible') {
    const { error: statusUpdateError } = await supabaseAdmin
      .from('referral_events')
      .update({
        status: 'eligible',
        metadata: {
          eligibilityReason: reason,
          eligibleAt: new Date().toISOString(),
        },
      })
      .eq('id', referralEvent.id);

    if (statusUpdateError) {
      return { ok: false, error: 'Unable to mark referral event as eligible.' };
    }
  }

  const configuredRewardCents = Number(process.env.REFERRAL_REWARD_CENTS || 5000);
  const rewardAmountCents = Number.isFinite(configuredRewardCents)
    ? Math.max(0, Math.round(configuredRewardCents))
    : 5000;

  const { data: rewards, error: rewardUpsertError } = await supabaseAdmin
    .from('referral_rewards')
    .upsert(
      [
        {
          referral_event_id: referralEvent.id,
          referrer_landlord_id: referralEvent.referrer_landlord_id,
          referred_landlord_id: referralEvent.referred_landlord_id,
          reward_type: 'subscription_activation',
          reward_amount_cents: rewardAmountCents,
          status: 'pending',
          notes: `Auto-created by ${reason}`,
        },
      ],
      { onConflict: 'referral_event_id', ignoreDuplicates: true }
    )
    .select('id');

  if (rewardUpsertError) {
    return { ok: false, error: 'Unable to create referral reward record.' };
  }

  return {
    ok: true,
    eligibleUpdated: true,
    rewardCreated: Array.isArray(rewards) && rewards.length > 0,
    referralEventId: referralEvent.id,
  };
}

module.exports = {
  syncReferralEligibilityForLandlord,
};
