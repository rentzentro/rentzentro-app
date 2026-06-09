// app/api/tenant-autopay/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '../../lib/supabaseEnv';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = getSupabaseUrl();
const SERVICE_ROLE_KEY = getSupabaseServiceRoleKey();
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const supabaseAdmin =
  SUPABASE_URL && SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    : null;

const isTenantLookupTypeError = (err: any) => {
  const message =
    typeof err?.message === 'string' ? err.message.toLowerCase() : '';
  const code = typeof err?.code === 'string' ? err.code : '';
  return (
    message.includes('invalid input syntax') ||
    message.includes('value out of range') ||
    code === '22P02' ||
    code === '22003'
  );
};

async function getAuthenticatedTenantFromRequest(req: Request) {
  if (!supabaseAdmin) return null;

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    console.warn('tenant-autopay: unable to verify tenant auth token', error);
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email || null,
  };
}

const normalizeEmail = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

async function findTenantForPayment({
  tenantId,
  tenantUserId,
  tenantEmail,
  authUserId,
  authEmail,
}: {
  tenantId?: string | number | null;
  tenantUserId?: string | null;
  tenantEmail?: string | null;
  authUserId?: string | null;
  authEmail?: string | null;
}) {
  if (!supabaseAdmin) return { data: null, error: null };

  const tenantIdentifier =
    tenantId === undefined || tenantId === null ? '' : String(tenantId).trim();
  const tenantUserIdentifier = String(tenantUserId ?? '').trim();
  const tenantEmailIdentifier = normalizeEmail(tenantEmail);
  const authUserIdentifier = String(authUserId ?? '').trim();
  const authEmailIdentifier = normalizeEmail(authEmail);
  const isNumericTenantId = /^\d+$/.test(tenantIdentifier);
  const tenantSelect =
    'id, owner_id, property_id, email, name, monthly_rent, auto_pay_enabled, auto_pay_stripe_subscription_id';

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

  const findTenantByEmailLoose = async (rawEmail: string) => {
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

  const lookupCandidates = [
    authUserIdentifier && { column: 'user_id', value: authUserIdentifier },
    authEmailIdentifier && { column: 'email', value: authEmailIdentifier },
    tenantUserIdentifier && { column: 'user_id', value: tenantUserIdentifier },
    tenantEmailIdentifier && { column: 'email', value: tenantEmailIdentifier },
    tenantIdentifier && {
      column: isNumericTenantId ? 'id' : 'user_id',
      value: tenantIdentifier,
    },
    tenantIdentifier && {
      column: isNumericTenantId ? 'user_id' : 'id',
      value: tenantIdentifier,
    },
  ].filter(Boolean) as Array<{
    column: 'id' | 'user_id' | 'email';
    value: string;
  }>;

  for (const candidate of lookupCandidates) {
    const result = await findTenantByColumn(candidate.column, candidate.value);

    if (result?.data || (result?.error && !isTenantLookupTypeError(result.error))) {
      return result;
    }
  }

  if (authEmailIdentifier) {
    const result = await findTenantByEmailLoose(authEmailIdentifier);
    if (result?.data || result?.error) return result;
  }

  if (tenantEmailIdentifier) {
    return findTenantByEmailLoose(tenantEmailIdentifier);
  }

  return { data: null, error: null };
}

export async function POST(req: Request) {
  try {
    if (!stripe || !supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            'Missing STRIPE_SECRET_KEY or Supabase admin env vars. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const authenticatedTenant = await getAuthenticatedTenantFromRequest(req);
    const { action, tenantId, tenantUserId, tenantEmail } = body as {
      action?: 'enable' | 'disable';
      tenantId?: number | string;
      tenantUserId?: string | null;
      tenantEmail?: string | null;
    };

    if (
      !action ||
      (!tenantId &&
        !tenantUserId &&
        !tenantEmail &&
        !authenticatedTenant?.id &&
        !authenticatedTenant?.email)
    ) {
      return NextResponse.json(
        { error: 'Missing action or tenant identifier.' },
        { status: 400 }
      );
    }

    // Load tenant (server-side, using service role). Prefer the verified
    // authenticated user over client-provided tenant ids, which can be stale.
    const { data: tenant, error: tenantError } = await findTenantForPayment({
      tenantId,
      tenantUserId: tenantUserId ?? null,
      tenantEmail: tenantEmail ?? null,
      authUserId: authenticatedTenant?.id ?? null,
      authEmail: authenticatedTenant?.email ?? null,
    });

    if (tenantError) {
      console.error('tenant-autopay: tenantError', tenantError);
      return NextResponse.json(
        { error: 'Failed to load tenant.' },
        { status: 500 }
      );
    }

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found.' },
        { status: 404 }
      );
    }

    // Load property to get rent + display info
    const { data: property, error: propError } = await supabaseAdmin
      .from('properties')
      .select('id, owner_id, name, unit_label, monthly_rent')
      .eq('id', tenant.property_id)
      .maybeSingle();

    if (propError) {
      console.error('tenant-autopay: propError', propError);
      return NextResponse.json(
        { error: 'Failed to load property for tenant.' },
        { status: 500 }
      );
    }

    const effectiveRent =
      property?.monthly_rent ?? tenant.monthly_rent ?? null;

    if (!effectiveRent || effectiveRent <= 0) {
      return NextResponse.json(
        {
          error:
            'Rent amount is not set for this tenant. Please ask your landlord to update the rent before enabling auto-pay.',
        },
        { status: 400 }
      );
    }

    const amountCents = Math.round(effectiveRent * 100);

    if (action === 'enable') {
      if (tenant.auto_pay_enabled && tenant.auto_pay_stripe_subscription_id) {
        // Already enabled
        return NextResponse.json(
          { error: 'Automatic payments are already enabled.' },
          { status: 400 }
        );
      }

      // Create a subscription Checkout Session so Stripe handles SCA + card setup.
      // NOTE: If you’re using Connect / application fees in /api/checkout,
      // copy that configuration (on_behalf_of, transfer_data, application_fee_amount, etc.) here.
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer_email: tenant.email || undefined,
        metadata: {
          type: 'tenant_rent_autopay',
          tenantId: String(tenant.id),
          ownerId: tenant.owner_id || '',
          propertyId: tenant.property_id ? String(tenant.property_id) : '',
        },
        subscription_data: {
          metadata: {
            type: 'tenant_rent_autopay',
            tenantId: String(tenant.id),
            ownerId: tenant.owner_id || '',
            propertyId: tenant.property_id ? String(tenant.property_id) : '',
          },
        },
        line_items: [
          {
            price_data: {
              currency: 'usd',
              recurring: { interval: 'month' },
              unit_amount: amountCents,
              product_data: {
                name:
                  property?.name && property?.unit_label
                    ? `Rent for ${property.name} · ${property.unit_label}`
                    : property?.name
                    ? `Rent for ${property.name}`
                    : 'Monthly rent',
              },
            },
            quantity: 1,
          },
        ],
        success_url: `${APP_URL}/tenant/portal?autopay=success`,
        cancel_url: `${APP_URL}/tenant/portal?autopay=cancelled`,
      });

      if (!session.url) {
        return NextResponse.json(
          { error: 'Stripe session did not include a redirect URL.' },
          { status: 500 }
        );
      }

      // We do NOT set auto_pay_enabled here — we wait for the webhook to confirm.
      return NextResponse.json({ url: session.url });
    }

    if (action === 'disable') {
      const subscriptionId = tenant.auto_pay_stripe_subscription_id as
        | string
        | null;

      if (subscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscriptionId);
        } catch (subErr: any) {
          console.error(
            'tenant-autopay: error cancelling subscription',
            subErr
          );
          // We still continue to mark it disabled locally so UI is correct.
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('tenants')
        .update({
          auto_pay_enabled: false,
          auto_pay_stripe_subscription_id: null,
        })
        .eq('id', tenant.id);

      if (updateError) {
        console.error('tenant-autopay: updateError', updateError);
        return NextResponse.json(
          { error: 'Failed to turn off automatic payments.' },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    console.error('tenant-autopay: unhandled error', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error.' },
      { status: 500 }
    );
  }
}
