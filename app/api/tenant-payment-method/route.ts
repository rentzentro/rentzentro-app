import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '../../supabaseAdminClient';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.rentzentro.com';

async function getAuthenticatedTenantFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    console.warn('tenant-payment-method: unable to verify tenant auth token', error);
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email || null,
  };
}

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

export async function POST(req: Request) {
  try {
    if (!stripe) {
      return NextResponse.json(
        { error: 'Missing STRIPE_SECRET_KEY env var.' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const authenticatedTenant = await getAuthenticatedTenantFromRequest(req);
    const tenantIdentifier = String(body?.tenantId ?? '').trim();
    const tenantUserIdentifier = String(body?.tenantUserId ?? '').trim();
    const tenantEmailIdentifier = String(body?.tenantEmail ?? '').trim().toLowerCase();
    const authUserIdentifier = String(authenticatedTenant?.id ?? body?.authUserId ?? '').trim();
    const authEmailIdentifier = String(
      authenticatedTenant?.email ?? body?.authEmail ?? ''
    )
      .trim()
      .toLowerCase();
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

    const normalizeEmail = (value: unknown) =>
      String(value ?? '')
        .trim()
        .toLowerCase();

    const findTenantByEmailLoose = async (rawEmail: unknown) => {
      const normalized = normalizeEmail(rawEmail);
      if (!normalized) return { data: null, error: null };

      const { data, error } = await supabaseAdmin
        .from('tenants')
        .select(tenantSelect)
        .ilike('email', `%${normalized}%`)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) return { data: null, error };

      const match = (Array.isArray(data) ? data : []).find(
        (row: any) => normalizeEmail(row?.email) === normalized
      );

      return { data: match ?? null, error: null };
    };


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

      const query = supabaseAdmin.from('tenants').select(tenantSelect);
      const filteredQuery =
        column === 'email' ? query.ilike(column, value) : query.eq(column, value);
      const { data, error } = await filteredQuery
        .order('created_at', { ascending: true })
        .limit(1);

      return { data: Array.isArray(data) ? data[0] ?? null : null, error };
    };

    const lookupCandidates = [
      authUserIdentifier && { column: 'user_id', value: authUserIdentifier },
      authEmailIdentifier && { column: 'email', value: authEmailIdentifier },
      tenantUserIdentifier && { column: 'user_id', value: tenantUserIdentifier },
      tenantIdentifier && {
        column: isNumericTenantId ? 'id' : 'user_id',
        value: tenantIdentifier,
      },
      tenantIdentifier && {
        column: isNumericTenantId ? 'user_id' : 'id',
        value: tenantIdentifier,
      },
      tenantEmailIdentifier && { column: 'email', value: tenantEmailIdentifier },
    ].filter(Boolean) as Array<{
      column: 'id' | 'user_id' | 'email';
      value: string;
    }>;

    let tenantResult: { data: any; error: any } = { data: null, error: null };

    for (const candidate of lookupCandidates) {
      const result = await findTenantByColumn(candidate.column, candidate.value);

      if (result?.data || (result?.error && !isTenantLookupTypeError(result.error))) {
        tenantResult = result;
        break;
      }
    }

    if ((!tenantResult?.data || tenantResult?.error) && authEmailIdentifier) {
      tenantResult = await findTenantByEmailLoose(authEmailIdentifier);
    }

    if ((!tenantResult?.data || tenantResult?.error) && tenantEmailIdentifier) {
      tenantResult = await findTenantByEmailLoose(tenantEmailIdentifier);
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
