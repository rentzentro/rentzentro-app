const DEFAULT_ERROR = 'Unable to create billing portal session.';

const json = (status, body) => ({ status, body });

async function createSubscriptionPortal({
  stripe,
  supabaseAdmin,
  supabaseAuth,
  appUrl,
  authHeader,
  landlordId,
}) {
  if (!stripe) {
    return json(500, { error: 'Stripe secret key not configured on server.' });
  }

  if (!supabaseAdmin || !supabaseAuth) {
    return json(500, { error: 'Supabase credentials not configured on server.' });
  }

  if (landlordId != null && typeof landlordId !== 'number') {
    return json(400, { error: 'Invalid landlordId.' });
  }

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    return json(401, { error: 'Missing bearer token.' });
  }

  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !authData?.user) {
    return json(401, { error: 'Not authenticated.' });
  }

  const authedUserId = authData.user.id;

  try {
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, user_id, stripe_customer_id')
      .eq('user_id', authedUserId)
      .maybeSingle();

    if (landlordError) {
      return json(500, { error: 'Unable to load landlord account.' });
    }

    if (!landlord?.stripe_customer_id) {
      return json(400, { error: 'Stripe customer not found for landlord.' });
    }

    if (landlordId != null && landlord.id !== landlordId) {
      return json(403, {
        error: 'Forbidden: landlordId does not match authenticated account.',
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: landlord.stripe_customer_id,
      return_url: `${appUrl}/landlord/settings`,
    });

    if (!portalSession.url) {
      return json(500, { error: 'Stripe portal session missing redirect URL.' });
    }

    return json(200, { url: portalSession.url });
  } catch (err) {
    return json(500, {
      error: err?.message || DEFAULT_ERROR,
    });
  }
}

module.exports = {
  createSubscriptionPortal,
};
