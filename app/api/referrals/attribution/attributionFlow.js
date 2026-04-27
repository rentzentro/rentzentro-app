const REFERRAL_CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

function normalizeReferralCode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (!REFERRAL_CODE_PATTERN.test(normalized)) return null;
  return normalized;
}

function isValidLandlordId(value) {
  return Number.isInteger(value) && value > 0;
}

async function attributeReferral({ supabaseAdmin, payload }) {
  if (!supabaseAdmin) {
    return { status: 500, body: { error: 'Supabase admin client is not configured.' } };
  }

  const landlordId = Number(payload?.landlordId);
  const userId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
  const source = typeof payload?.source === 'string' && payload.source.trim()
    ? payload.source.trim().slice(0, 80)
    : 'landlord_signup_referral';
  const referralCode = normalizeReferralCode(payload?.referralCode);

  if (!isValidLandlordId(landlordId)) {
    return { status: 400, body: { error: 'Invalid landlordId.' } };
  }

  if (!userId) {
    return { status: 400, body: { error: 'Missing userId.' } };
  }

  if (!referralCode) {
    return { status: 400, body: { error: 'Invalid referralCode.' } };
  }

  const { data: referredLandlord, error: referredLandlordError } = await supabaseAdmin
    .from('landlords')
    .select('id, user_id')
    .eq('id', landlordId)
    .maybeSingle();

  if (referredLandlordError) {
    return { status: 500, body: { error: 'Failed to verify landlord account.' } };
  }

  if (!referredLandlord) {
    return { status: 404, body: { error: 'Landlord account was not found.' } };
  }

  if (referredLandlord.user_id !== userId) {
    return { status: 403, body: { error: 'Forbidden: landlordId does not match userId.' } };
  }

  const { data: codeRow, error: codeError } = await supabaseAdmin
    .from('referral_codes')
    .select('landlord_id, code, active')
    .eq('code', referralCode)
    .eq('active', true)
    .maybeSingle();

  if (codeError) {
    return { status: 500, body: { error: 'Failed to look up referral code.' } };
  }

  if (!codeRow) {
    return { status: 200, body: { attributed: false, reason: 'unknown_or_inactive_code' } };
  }

  if (Number(codeRow.landlord_id) === landlordId) {
    return { status: 200, body: { attributed: false, reason: 'self_referral_blocked' } };
  }

  const { data: upsertedRows, error: upsertError } = await supabaseAdmin
    .from('referral_events')
    .upsert(
      [
        {
          referrer_landlord_id: Number(codeRow.landlord_id),
          referred_landlord_id: landlordId,
          referral_code: codeRow.code,
          source,
          status: 'attributed',
          metadata: {
            userId,
          },
        },
      ],
      {
        onConflict: 'referred_landlord_id',
        ignoreDuplicates: true,
      }
    )
    .select('id');

  if (upsertError) {
    return { status: 500, body: { error: 'Failed to record referral attribution.' } };
  }

  return {
    status: 200,
    body: {
      attributed: true,
      referralCode: codeRow.code,
      referrerLandlordId: Number(codeRow.landlord_id),
      created: Array.isArray(upsertedRows) && upsertedRows.length > 0,
    },
  };
}

module.exports = {
  normalizeReferralCode,
  attributeReferral,
};
