// app/api/subscription/portal/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

// ✅ If your Stripe package/types are older, apiVersion will underline red unless cast.
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
});

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (!landlordId || typeof landlordId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid landlordId.' },
        { status: 400 }
      );
    }

    // Load landlord
    const { data: landlord, error } = await supabaseAdmin
      .from('landlords')
      .select('id, stripe_customer_id')
      .eq('id', landlordId)
      .maybeSingle();

    if (error) {
      console.error('Portal landlord lookup error:', error);
      return NextResponse.json(
        { error: 'Unable to load landlord account.' },
        { status: 500 }
      );
    }

    if (!landlord?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'Stripe customer not found for landlord.' },
        { status: 400 }
      );
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: landlord.stripe_customer_id,
      return_url: `${APP_URL}/landlord/settings`,
    });

    return NextResponse.json({ url: portalSession.url }, { status: 200 });
  } catch (err: any) {
    console.error('Billing portal error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unable to create billing portal session.' },
      { status: 500 }
    );
  }
}
