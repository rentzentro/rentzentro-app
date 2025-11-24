// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../supabaseAdminClient';

// Initialize Stripe (server-side only)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Base URL for success/cancel redirects
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();

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
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
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
      },
      payment_intent_data: {
        transfer_data: {
          destination: landlordStripeAccountId,
        },
        // If you ever want a per-payment platform fee, set application_fee_amount here.
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
          'Unexpected error while starting the rent payment checkout session.',
      },
      { status: 500 }
    );
  }
}
