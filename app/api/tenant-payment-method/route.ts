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
    const authUserIdentifier = String(body?.authUserId ?? '').trim();
    const authEmailIdentifier = String(body?.authEmail ?? '').trim().toLowerCase();
    if (
      !tenantIdentifier &&
      !tenantUserIdentifier &&
      !tenantEmailIdentifier &&
      !authUserIdentifier &&
      !authEmailIdentifier
    ) {
      return NextResponse.json(
        { error: 'Missing tenant identifier.' },
        { status: 400 }
      );
    }

    const isNumericTenantId = /^\d+$/.test(tenantIdentifier);

    const tenantSelect = 'id, email, name, stripe_customer_id';

    const findTenantByColumn = async (
      column: 'id' | 'user_id' | 'email',
      value: string
    ) => {
      if (column === 'id') {
        const { data, error } = await supabaseAdmin
          .from('tenants')
          .select(tenantSelect)
          .eq(column, value)
          .maybeSingle();
        return { data, error };
      }

      const { data, error } = await supabaseAdmin
        .from('tenants')
        .select(tenantSelect)
        .eq(column, value)
        .order('created_at', { ascending: true })
        .limit(1);

      return { data: Array.isArray(data) ? data[0] ?? null : null, error };
    };

    const isTenantLookupTypeError = (err: any) => {
      const message =
        typeof err?.message === 'string' ? err.message.toLowerCase() : '';
      const code = typeof err?.code === 'string' ? err.code : '';
      return (
        message.includes('invalid input syntax') ||
        message.includes('value out of range') ||
        code === '22P02' || // invalid_text_representation
        code === '22003' // numeric_value_out_of_range
      );
    };

    let tenantResult = isNumericTenantId
      ? await findTenantByColumn('id', tenantIdentifier)
      : await findTenantByColumn('user_id', tenantIdentifier);

    if (!tenantResult?.data && tenantIdentifier.length > 0) {
      const fallback = isNumericTenantId
        ? await findTenantByColumn('user_id', tenantIdentifier)
        : await findTenantByColumn('id', tenantIdentifier);
      if (fallback?.data || (fallback?.error && !isTenantLookupTypeError(fallback.error))) {
        tenantResult = fallback;
      }
    }

    if (tenantResult?.error && isTenantLookupTypeError(tenantResult.error)) {
      tenantResult = { data: null, error: null };
    }

    if ((!tenantResult?.data || tenantResult?.error) && tenantUserIdentifier) {
      tenantResult = await findTenantByColumn('user_id', tenantUserIdentifier);
    }

    if ((!tenantResult?.data || tenantResult?.error) && tenantEmailIdentifier) {
      tenantResult = await findTenantByColumn('email', tenantEmailIdentifier);
    }

    if ((!tenantResult?.data || tenantResult?.error) && authUserIdentifier) {
      tenantResult = await findTenantByColumn('user_id', authUserIdentifier);
    }

    if ((!tenantResult?.data || tenantResult?.error) && authEmailIdentifier) {
      tenantResult = await findTenantByColumn('email', authEmailIdentifier);
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
