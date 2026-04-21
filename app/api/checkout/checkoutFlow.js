const DEFAULT_ERROR =
  'Unexpected error while starting the checkout session.';

const CARD_FEE_PERCENT = 0.035;
const CARD_FEE_FLAT_CENTS = 50;
const MAX_FEE_CENTS = 999999;
const ACH_FEE_CENTS = 500;

const toCents = (dollars) => Math.max(0, Math.round(dollars * 100));

const json = (status, body) => ({ status, body });

async function createCheckoutSession({
  stripe,
  supabaseAdmin,
  appUrl,
  esignPriceId,
  body,
}) {
  try {
    if (!stripe) {
      return json(500, { error: 'Missing STRIPE_SECRET_KEY env var.' });
    }

    const paymentKind = body.paymentKind || body.payment_kind || 'rent';

    if (paymentKind === 'esign') {
      const signatures = Number(body.signatures ?? 0);
      const landlordUserId = body.landlordUserId;
      const description =
        body.description || `E-signature credits (${signatures})`;

      if (!landlordUserId) {
        return json(400, { error: 'Missing landlordUserId for e-sign purchase.' });
      }

      if (!signatures || Number.isNaN(signatures) || signatures <= 0) {
        return json(400, { error: 'Please choose at least 1 signature to purchase.' });
      }

      if (!esignPriceId) {
        return json(500, {
          error:
            'E-sign pricing is not configured yet. Please contact RentZentro support.',
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price: esignPriceId,
            quantity: signatures,
          },
        ],
        success_url: `${appUrl}/landlord/documents?esign=success`,
        cancel_url: `${appUrl}/landlord/documents?esign=cancelled`,
        metadata: {
          payment_kind: 'esign',
          landlord_user_id: landlordUserId,
          signatures: String(signatures),
          description,
        },
      });

      if (!session.url) {
        return json(500, { error: 'Stripe session created without a redirect URL.' });
      }

      return json(200, { url: session.url });
    }

    const {
      amount,
      description,
      tenantId,
      propertyId,
      paymentMethodType,
      paymentMethod,
      method,
    } = body;

    if (!amount || amount <= 0) {
      return json(400, { error: 'Invalid amount.' });
    }

    if (!tenantId) {
      return json(400, { error: 'Missing tenantId.' });
    }

    const requestedMethod = paymentMethodType || paymentMethod || method || 'card';

    if (requestedMethod !== 'card' && requestedMethod !== 'us_bank_account') {
      return json(400, { error: 'Invalid payment method.' });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, email, property_id, owner_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return json(400, { error: 'Tenant not found.' });
    }

    const effectivePropertyId = propertyId ?? tenant.property_id;
    if (!effectivePropertyId) {
      return json(400, {
        error:
          'No property is linked to this tenant. Please contact your landlord.',
      });
    }

    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, name, unit_label, owner_id')
      .eq('id', effectivePropertyId)
      .maybeSingle();

    if (propError || !property) {
      return json(400, { error: 'Property not found for this tenant.' });
    }

    const landlordForeign = tenant.owner_id ?? property.owner_id;

    if (!landlordForeign) {
      return json(400, {
        error:
          'No landlord is linked to this property. Please contact your landlord or RentZentro support.',
      });
    }

    let landlord = null;

    const { data: landlordById } = await supabaseAdmin
      .from('landlords')
      .select('id, stripe_connect_account_id, stripe_connect_onboarded')
      .eq('id', landlordForeign)
      .maybeSingle();

    if (landlordById) {
      landlord = landlordById;
    } else {
      const { data: landlordByUserId } = await supabaseAdmin
        .from('landlords')
        .select('id, stripe_connect_account_id, stripe_connect_onboarded')
        .eq('user_id', landlordForeign)
        .maybeSingle();

      if (landlordByUserId) {
        landlord = landlordByUserId;
      }
    }

    if (!landlord) {
      return json(400, { error: 'Landlord not found for this property.' });
    }

    if (!landlord.stripe_connect_account_id) {
      return json(400, {
        error:
          'Your landlord has not finished setting up payouts yet. Please contact them directly.',
      });
    }

    if (!landlord.stripe_connect_onboarded) {
      return json(400, {
        error:
          'Your landlord’s payout setup is still in progress. Please try again later or contact them directly.',
      });
    }

    const rentCents = toCents(amount);

    const cardFeeRaw =
      Math.round(rentCents * CARD_FEE_PERCENT) + CARD_FEE_FLAT_CENTS;
    const cardFeeCents = Math.min(MAX_FEE_CENTS, Math.max(0, cardFeeRaw));

    const feeCents = requestedMethod === 'card' ? cardFeeCents : ACH_FEE_CENTS;

    const feeLabel =
      requestedMethod === 'card'
        ? 'Convenience fee for card payments'
        : 'ACH processing fee';

    const totalCents = rentCents + feeCents;

    const rentDescription =
      description ||
      `Rent payment for ${property.name || 'your rental'}${
        property.unit_label ? ` · ${property.unit_label}` : ''
      }`;

    const lineItems = [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product_data: {
            name: rentDescription,
          },
          unit_amount: rentCents,
        },
      },
    ];

    if (feeCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          product_data: {
            name: feeLabel,
          },
          unit_amount: feeCents,
        },
      });
    }

    const sessionParams = {
      mode: 'payment',
      payment_method_types: [requestedMethod],
      line_items: lineItems,
      success_url: `${appUrl}/tenant/payment-success`,
      cancel_url: `${appUrl}/tenant/payment-cancelled`,
      metadata: {
        tenant_id: String(tenant.id),
        property_id: String(property.id),
        landlord_id: String(landlord.id),
        type: 'rent_payment',
        payment_kind: 'rent',
        payment_method_type: requestedMethod,
        rent_cents: String(rentCents),
        fee_cents: String(feeCents),
        total_cents: String(totalCents),
      },
      payment_intent_data: {
        transfer_data: {
          destination: landlord.stripe_connect_account_id,
          amount: rentCents,
        },
      },
    };

    if (requestedMethod === 'us_bank_account') {
      sessionParams.payment_method_options = {
        us_bank_account: {
          verification_method: 'automatic',
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

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
  createCheckoutSession,
};
