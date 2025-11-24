// app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../supabaseClient';

// Initialize Stripe (no apiVersion to avoid TS noise)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Base URL for success/cancel redirects
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { amount, description, tenantId, propertyId } = body as {
      amount: number;        // dollars, e.g. 1500
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

    // 1) Look up tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, email, property_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('Checkout tenant lookup error:', tenantError);
      return NextResponse.json(
        { error: 'Tenant not found.' },
        { status: 400 }
      );
    }

    // 2) Decide which property to use: explicit propertyId or tenant.property_id
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

    // 3) Load property, including owner_id (which should point to the landlord row)
    const { data: property, error: propError } = await supabase
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

    // 4) Load landlord by properties.owner_id -> landlords.id
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id, stripe_connect_account_id, stripe_connect_onboarded')
      .eq('id', property.owner_id)
      .maybeSingle();

    if (landlordError || !landlord) {
      console.error('Checkout landlord lookup error:', landlordError);
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

    const landlordStripeAccountId = landlord.stripe_connect_account_id as string;

    // 5) Create Stripe Checkout Session that transfers funds to landlord
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
            unit_amount: Math.round(amount * 100), // convert dollars → cents
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
          // 🔥 This is the key line: send funds to the landlord’s connected account
          destination: landlordStripeAccountId,
        },
        // If you ever want a per-transaction fee, set application_fee_amount here:
        // application_fee_amount: Math.round(amount * 100 * 0.00),
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
