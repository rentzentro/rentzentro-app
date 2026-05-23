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
    const tenantIdentifier = String(body?.tenantId ?? '').trim();
    const tenantUserIdentifier = String(body?.tenantUserId ?? '').trim();
    const tenantEmailIdentifier = String(body?.tenantEmail ?? '').trim().toLowerCase();
    if (!tenantIdentifier) {
      return NextResponse.json({ error: 'Missing tenantId.' }, { status: 400 });
    }

    const isNumericTenantId = /^\d+$/.test(tenantIdentifier);

    const tenantSelect = 'id, email, name, stripe_customer_id';

    const findTenantByColumn = async (
      column: 'id' | 'user_id' | 'email',
      value: string
    ) => {
      const { data, error } = await supabaseAdmin
        .from('tenants')
        .select(tenantSelect)
        .eq(column, value)
        .maybeSingle();
      return { data, error };
    };

    let tenantResult = isNumericTenantId
      ? await findTenantByColumn('id', tenantIdentifier)
      : await findTenantByColumn('user_id', tenantIdentifier);

    if (!tenantResult?.data && tenantIdentifier.length > 0) {
      const fallback = isNumericTenantId
        ? await findTenantByColumn('user_id', tenantIdentifier)
        : await findTenantByColumn('id', tenantIdentifier);
      if (fallback?.data || fallback?.error) {
        tenantResult = fallback;
      }
    }

    if ((!tenantResult?.data || tenantResult?.error) && tenantUserIdentifier) {
      tenantResult = await findTenantByColumn('user_id', tenantUserIdentifier);
    }

    if ((!tenantResult?.data || tenantResult?.error) && tenantEmailIdentifier) {
      tenantResult = await findTenantByColumn('email', tenantEmailIdentifier);
    }

    const tenant = tenantResult?.data;
    const tenantError = tenantResult?.error;

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
