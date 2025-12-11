// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../supabaseAdminClient';

// Initialize Stripe (server-side only)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Base URL for success/cancel redirects
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

// Optional: per-signature e-sign price in Stripe
// Create a Price in Stripe and set this env var.
const ESIGN_PRICE_ID = process.env.STRIPE_ESIGN_PRICE_ID as string | undefined;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;

    // Decide which flow this is: rent (default) or e-sign purchase
    const paymentKind: 'rent' | 'esign' =
      body.paymentKind || body.payment_kind || 'rent';

    // -------------------------------------------------------------------
    // 1) LANDLORD E-SIGN CREDIT PURCHASE (PER SIGNATURE)
    // -------------------------------------------------------------------
    if (paymentKind === 'esign') {
      const signatures = Number(body.signatures ?? 0);
      const landlordUserId = body.landlordUserId as string | undefined;
      const description =
        (body.description as string | undefined) ||
        `E-signature credits (${signatures})`;

      if (!landlordUserId) {
        return NextResponse.json(
          { error: 'Missing landlordUserId for e-sign purchase.' },
          { status: 400 }
        );
      }

      if (!signatures || Number.isNaN(signatures) || signatures <= 0) {
        return NextResponse.json(
          { error: 'Please choose at least 1 signature to purchase.' },
          { status: 400 }
        );
      }

      if (!ESIGN_PRICE_ID) {
        console.error(
          'Missing STRIPE_ESIGN_PRICE_ID env var for e-sign purchases.'
        );
        return NextResponse.json(
          {
            error:
              'E-sign pricing is not configured yet. Please contact RentZentro support.',
          },
          { status: 500 }
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price: ESIGN_PRICE_ID,
            quantity: signatures,
          },
        ],
        success_url: `${APP_URL}/landlord/documents?esign=success`,
        cancel_url: `${APP_URL}/landlord/documents?esign=cancelled`,
        metadata: {
          payment_kind: 'esign',
          landlord_user_id: landlordUserId,
          signatures: String(signatures),
          description,
        },
      });

      if (!session.url) {
        return NextResponse.json(
          { error: 'Stripe session created without a redirect URL.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ url: session.url }, { status: 200 });
    }

    // -------------------------------------------------------------------
    // 2) DEFAULT: TENANT RENT PAYMENT (EXISTING FLOW)
    // -------------------------------------------------------------------
    const { amount, description, tenantId, propertyId } = body as {
      amount: number; // dollars, e.g. 1500
      description?: string;
      tenantId: number;
      propertyId?: number | null;
    };

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount.' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Missing tenantId.' },
        { status: 400 }
      );
    }

    // 1) Look up tenant (server-side admin client, bypasses RLS safely)
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, email, property_id, owner_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Checkout tenant lookup error:', tenantError);
      return NextResponse.json(
        { error: 'Tenant not found.' },
        { status: 400 }
      );
    }

    // 2) Decide which property to use
    const effectivePropertyId = propertyId ?? tenant.property_id;
    if (!effectivePropertyId) {
      return NextResponse.json(
        {
          error:
            'No property is linked to this tenant. Please contact your landlord.',
        },
        { status: 400 }
      );
    }

    // 3) Load property, including owner_id (may be null/old in some rows)
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, name, unit_label, owner_id')
      .eq('id', effectivePropertyId)
      .maybeSingle();

    if (propError || !property) {
      console.error('Checkout property lookup error:', propError);
      return NextResponse.json(
        { error: 'Property not found for this tenant.' },
        { status: 400 }
      );
    }

    // 4) Figure out which landlord ID to use
    // Prefer the tenant.owner_id (newer, more reliable),
    // fall back to property.owner_id (older data).
    const landlordForeign = tenant.owner_id ?? property.owner_id;

    if (!landlordForeign) {
      return NextResponse.json(
        {
          error:
            'No landlord is linked to this property. Please contact your landlord or RentZentro support.',
        },
        { status: 400 }
      );
    }

    // 5) Try to load landlord by numeric id first...
    let landlord = null as
      | {
          id: number;
          stripe_connect_account_id: string | null;
          stripe_connect_onboarded: boolean;
        }
      | null;

    const { data: landlordById, error: landlordByIdError } =
      await supabaseAdmin
        .from('landlords')
        .select('id, stripe_connect_account_id, stripe_connect_onboarded')
        .eq('id', landlordForeign)
        .maybeSingle();

    if (landlordByIdError) {
      console.error('Checkout landlordById error:', landlordByIdError);
    }

    if (landlordById) {
      landlord = landlordById;
    } else {
      // 6) ...if that fails, try matching a landlord.user_id (UUID) to landlordForeign
      const { data: landlordByUserId, error: landlordByUserIdError } =
        await supabaseAdmin
          .from('landlords')
          .select('id, stripe_connect_account_id, stripe_connect_onboarded')
          .eq('user_id', landlordForeign)
          .maybeSingle();

      if (landlordByUserIdError) {
        console.error(
          'Checkout landlordByUserId error:',
          landlordByUserIdError
        );
      }

      if (landlordByUserId) {
        landlord = landlordByUserId;
      }
    }

    if (!landlord) {
      console.error(
        'No landlord found for landlordForeign:',
        landlordForeign,
        'tenant.owner_id =',
        tenant.owner_id,
        'property.owner_id =',
        property.owner_id
      );
      return NextResponse.json(
        { error: 'Landlord not found for this property.' },
        { status: 400 }
      );
    }

    if (!landlord.stripe_connect_account_id) {
      return NextResponse.json(
        {
          error:
            'Your landlord has not finished setting up payouts yet. Please contact them directly.',
        },
        { status: 400 }
      );
    }

    if (!landlord.stripe_connect_onboarded) {
      return NextResponse.json(
        {
          error:
            'Your landlord’s payout setup is still in progress. Please try again later or contact them directly.',
        },
        { status: 400 }
      );
    }

    const landlordStripeAccountId =
      landlord.stripe_connect_account_id as string;

    // 7) Create Stripe Checkout Session that transfers funds to landlord
    //    ACH added: allow both card + US bank account
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card', 'us_bank_account'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name:
                description ||
                `Rent payment for ${
                  property.name || 'your rental'
                }${property.unit_label ? ` · ${property.unit_label}` : ''}`,
            },
            unit_amount: Math.round(amount * 100), // dollars → cents
          },
        },
      ],
      success_url: `${APP_URL}/tenant/payment-success`,
      cancel_url: `${APP_URL}/tenant/payment-cancelled`,
      metadata: {
        tenant_id: tenant.id,
        property_id: property.id,
        landlord_id: landlord.id,
        type: 'rent_payment',
        payment_kind: 'rent',
      },
      payment_intent_data: {
        transfer_data: {
          destination: landlordStripeAccountId,
        },
      },
      payment_method_options: {
        us_bank_account: {
          verification_method: 'automatic',
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe session created without a redirect URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while starting the checkout session.',
      },
      { status: 500 }
    );
  }
}
