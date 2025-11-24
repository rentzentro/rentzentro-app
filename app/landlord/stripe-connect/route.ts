// app/landlord/stripe-connect/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../supabaseClient';

// Initialize Stripe – no apiVersion field to avoid TS lint issues
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

// Your deployed domain (used for Stripe redirect URLs)
const DOMAIN =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

export async function POST(req: Request) {
  try {
    const { landlordId } = await req.json();

    if (!landlordId) {
      return NextResponse.json(
        { error: 'Missing landlordId.' },
        { status: 400 }
      );
    }

    // Fetch landlord from DB
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id, email, stripe_connect_account_id')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError || !landlord) {
      console.error('Landlord fetch error:', landlordError);
      return NextResponse.json(
        { error: 'Landlord not found.' },
        { status: 404 }
      );
    }

    let accountId = landlord.stripe_connect_account_id as string | null;

    // If no connected account yet, create one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: landlord.email,
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
      });

      accountId = account.id;

      // Save account ID back to landlord row
      const { error: updateError } = await supabase
        .from('landlords')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', landlord.id);

      if (updateError) {
        console.error('Failed to save stripe_connect_account_id:', updateError);
        return NextResponse.json(
          { error: 'Unable to save Stripe account ID.' },
          { status: 500 }
        );
      }
    }

    // Create Stripe onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${DOMAIN}/landlord/complete-setup`,
      return_url: `${DOMAIN}/landlord/complete-setup`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url }, { status: 200 });
  } catch (err: any) {
    console.error('Stripe onboarding error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while creating Stripe onboarding link.',
      },
      { status: 500 }
    );
  }
}
