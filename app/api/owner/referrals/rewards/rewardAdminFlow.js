const VALID_ACTIONS = new Set(['approve', 'mark_paid', 'void']);

const json = (status, body) => ({ status, body });

function normalizeAction(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeRewardId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildTransition(currentStatus, action) {
  const status = String(currentStatus || '').toLowerCase();

  if (action === 'approve') {
    if (status !== 'pending') {
      return { ok: false, message: 'Only pending rewards can be approved.' };
    }

    return {
      ok: true,
      next: {
        status: 'approved',
        approved_at: new Date().toISOString(),
      },
    };
  }

  if (action === 'mark_paid') {
    if (status !== 'approved') {
      return { ok: false, message: 'Only approved rewards can be marked paid.' };
    }

    return {
      ok: true,
      next: {
        status: 'paid',
        paid_at: new Date().toISOString(),
      },
    };
  }

  if (action === 'void') {
    if (status !== 'pending' && status !== 'approved') {
      return { ok: false, message: 'Only pending or approved rewards can be voided.' };
    }

    return {
      ok: true,
      next: {
        status: 'void',
      },
    };
  }

  return { ok: false, message: 'Invalid action.' };
}

async function listReferralRewards({ supabaseAdmin, limit = 100 }) {
  if (!supabaseAdmin) {
    return json(500, { error: 'Supabase admin client is not configured.' });
  }

  const normalizedLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 500) : 100;

  const { data, error } = await supabaseAdmin
    .from('referral_rewards')
    .select(
      'id, referral_event_id, referrer_landlord_id, referred_landlord_id, reward_type, reward_amount_cents, status, eligible_at, approved_at, paid_at, notes, processed_by, external_payout_id, created_at'
    )
    .order('eligible_at', { ascending: false })
    .limit(normalizedLimit);

  if (error) {
    return json(500, { error: 'Failed to load referral rewards.' });
  }

  return json(200, {
    rewards: data || [],
  });
}

async function applyReferralRewardAction({ supabaseAdmin, payload }) {
  if (!supabaseAdmin) {
    return json(500, { error: 'Supabase admin client is not configured.' });
  }

  const rewardId = normalizeRewardId(payload?.rewardId);
  const action = normalizeAction(payload?.action);
  const processedBy = typeof payload?.processedBy === 'string' ? payload.processedBy.trim().slice(0, 80) : '';
  const externalPayoutId =
    typeof payload?.externalPayoutId === 'string' ? payload.externalPayoutId.trim().slice(0, 120) : '';
  const note = typeof payload?.note === 'string' ? payload.note.trim().slice(0, 400) : '';

  if (!rewardId) {
    return json(400, { error: 'Missing rewardId.' });
  }

  if (!VALID_ACTIONS.has(action)) {
    return json(400, { error: 'Invalid action. Expected approve, mark_paid, or void.' });
  }

  const { data: reward, error: rewardError } = await supabaseAdmin
    .from('referral_rewards')
    .select('id, status, notes')
    .eq('id', rewardId)
    .maybeSingle();

  if (rewardError) {
    return json(500, { error: 'Failed to load reward record.' });
  }

  if (!reward) {
    return json(404, { error: 'Reward record not found.' });
  }

  const transition = buildTransition(reward.status, action);
  if (!transition.ok) {
    return json(409, { error: transition.message });
  }

  const mergedNotes = [reward.notes, note].filter(Boolean).join('\n').slice(0, 400);

  const updatePayload = {
    ...transition.next,
    notes: mergedNotes || null,
    processed_by: processedBy || null,
    external_payout_id: externalPayoutId || null,
  };

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('referral_rewards')
    .update(updatePayload)
    .eq('id', rewardId)
    .select(
      'id, status, approved_at, paid_at, notes, processed_by, external_payout_id, reward_amount_cents, referrer_landlord_id, referred_landlord_id'
    )
    .single();

  if (updateError) {
    return json(500, { error: 'Failed to update reward record.' });
  }

  const { error: auditError } = await supabaseAdmin
    .from('referral_reward_audit_logs')
    .insert([
      {
        reward_id: reward.id,
        action,
        previous_status: reward.status,
        next_status: updated.status,
        processed_by: processedBy || null,
        note: note || null,
      },
    ]);

  if (auditError) {
    return json(500, { error: 'Reward updated, but audit log write failed.' });
  }

  return json(200, {
    reward: updated,
  });
}

module.exports = {
  applyReferralRewardAction,
  buildTransition,
  listReferralRewards,
};
