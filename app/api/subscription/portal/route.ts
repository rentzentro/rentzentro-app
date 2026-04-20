// app/api/subscription/portal/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

// ✅ If your Stripe package/types are older, apiVersion will underline red unless cast.
const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2024-06-20' as any,
    })
  : null;

const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;
const supabaseAuth =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function POST(req: Request) {
  try {
    if (!stripe || !supabaseAdmin || !supabaseAuth) {
      return NextResponse.json(
        {
          error:
            'Missing STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY env vars.',
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { landlordId } = body as { landlordId?: number };

    if (landlordId != null && typeof landlordId !== 'number') {
      return NextResponse.json(
        { error: 'Invalid landlordId.' },
        { status: 400 }
      );
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 });
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const authedUserId = authData.user.id;

    // Load landlord
    const { data: landlord, error } = await supabaseAdmin
      .from('landlords')
      .select('id, user_id, stripe_customer_id')
      .eq('user_id', authedUserId)
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

    if (landlordId != null && landlord.id !== landlordId) {
      return NextResponse.json(
        { error: 'Forbidden: landlordId does not match authenticated account.' },
        { status: 403 }
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
