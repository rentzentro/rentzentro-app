import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../supabaseAdminClient';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Missing STRIPE_SECRET_KEY env var.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = Number(body?.tenantId || 0);
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId.' }, { status: 400 });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, email, name, stripe_customer_id')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });
    }

    let customerId = tenant.stripe_customer_id as string | null;

    if (customerId) {
      const existing = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1,
      });

      if (existing?.data?.length) {
        return NextResponse.json({ verified: true });
      }
    } else {
      const customer = await stripe.customers.create({
        email: tenant.email || undefined,
        name: tenant.name || undefined,
        metadata: {
          tenant_id: String(tenant.id),
        },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from('tenants')
        .update({ stripe_customer_id: customerId })
        .eq('id', tenant.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      customer: customerId,
      payment_method_types: ['card'],
      success_url: `${APP_URL}/tenant/portal?cardVerification=success`,
      cancel_url: `${APP_URL}/tenant/portal?cardVerification=cancelled`,
      metadata: {
        type: 'tenant_card_verification',
        tenant_id: String(tenant.id),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: 'Stripe verification session created without redirect URL.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ verified: false, url: session.url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Unexpected verification error.' },
      { status: 500 }
    );
  }
}
