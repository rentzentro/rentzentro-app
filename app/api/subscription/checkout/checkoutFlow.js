const DEFAULT_ERROR =
  'Something went wrong creating the subscription checkout session.';

const json = (status, body) => ({ status, body });

const hasCancellableSubscription = (subscription) => {
  const status = String(subscription?.status || '').toLowerCase();
  return (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'unpaid'
  );
};

async function createSubscriptionCheckout({
  stripe,
  supabaseAdmin,
  supabaseAuth,
  subscriptionPriceId,
  selectedPlanKey,
  selectedPlanUnitLimit,
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

  if (landlordId != null && typeof landlordId !== 'number') {
    return json(400, { error: 'Invalid landlordId in request body.' });
  }

  if (!subscriptionPriceId) {
    return json(500, { error: 'Subscription price not configured on server.' });
  }

  try {
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, user_id, email, stripe_customer_id')
      .eq('user_id', authedUserId)
      .maybeSingle();

    if (landlordError) {
      return json(500, { error: 'Unable to load landlord account.' });
    }

    if (!landlord) {
      return json(404, { error: 'Landlord account not found for authenticated user.' });
    }

    if (landlordId != null && landlord.id !== landlordId) {
      return json(403, { error: 'Forbidden: landlordId does not match authenticated account.' });
    }

    if (selectedPlanKey && typeof selectedPlanUnitLimit === 'number') {
      const { count: unitCount, error: unitCountError } = await supabaseAdmin
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', authedUserId);

      if (unitCountError) {
        return json(500, { error: 'Unable to validate unit count for selected plan.' });
      }

      if ((unitCount || 0) > selectedPlanUnitLimit) {
        return json(400, {
          error: `Your account has ${unitCount || 0} units, which exceeds the ${selectedPlanKey} plan limit of ${selectedPlanUnitLimit}. Please choose a larger plan.`,
        });
      }
    }

    let customerId = landlord.stripe_customer_id || null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: landlord.email,
        metadata: {
          landlordId: String(landlord.id),
        },
      });

      customerId = customer.id;

      await supabaseAdmin
        .from('landlords')
        .update({ stripe_customer_id: customerId })
        .eq('id', landlord.id);
    }

    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });

    const alreadySubscribed = (existingSubscriptions?.data || []).some(
      hasCancellableSubscription
    );

    if (alreadySubscribed) {
      return json(409, {
        error:
          'An active subscription already exists for this account. Please use billing portal to manage your plan.',
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: String(landlord.id),
      line_items: [{ price: subscriptionPriceId, quantity: 1 }],
      success_url: `${appUrl}/landlord/settings?billing=success`,
      cancel_url: `${appUrl}/landlord/settings?billing=cancelled`,
      metadata: {
        landlordId: String(landlord.id),
      },
      subscription_data: {
        metadata: {
          landlordId: String(landlord.id),
        },
      },
    });

    if (!session.url) {
      return json(500, { error: 'Stripe session created without a redirect URL.' });
    }

    return json(200, { url: session.url });
  } catch (err) {
    return json(500, {
      error: err?.message || DEFAULT_ERROR,
    });
  }
}

module.exports = {
  createSubscriptionCheckout,
};
