// app/landlord/stripe-status/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../supabaseClient';

// Stripe client – no apiVersion so TS stops complaining
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: Request) {
  try {
    const { landlordId } = await req.json();

    if (!landlordId) {
      return NextResponse.json(
        { error: 'Missing landlordId.' },
        { status: 400 }
      );
    }

    // 1) Get landlord with Stripe account id
    const { data: landlord, error: landlordError } = await supabase
      .from('landlords')
      .select('id, stripe_connect_account_id, stripe_connect_onboarded')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError || !landlord) {
      console.error('Stripe status landlord error:', landlordError);
      return NextResponse.json(
        { error: 'Landlord not found.' },
        { status: 404 }
      );
    }

    if (!landlord.stripe_connect_account_id) {
      // no account yet, definitely not onboarded
      return NextResponse.json({ onboarded: false }, { status: 200 });
    }

    // 2) Check Stripe account status
    const account = await stripe.accounts.retrieve(
      landlord.stripe_connect_account_id
    );

    const isOnboarded =
      !!account.details_submitted &&
      !!account.charges_enabled &&
      !!account.payouts_enabled;

    // 3) If onboarded and not marked yet, update Supabase flag
    if (isOnboarded && !landlord.stripe_connect_onboarded) {
      const { error: updateError } = await supabase
        .from('landlords')
        .update({ stripe_connect_onboarded: true })
        .eq('id', landlord.id);

      if (updateError) {
        console.error('Stripe status update error:', updateError);
      }
    }

    return NextResponse.json({ onboarded: isOnboarded }, { status: 200 });
  } catch (err: any) {
    console.error('Stripe status error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while checking Stripe onboarding status.',
      },
      { status: 500 }
    );
  }
}
