// app/api/tenant-autopay/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars'
  );
}

const stripe = new Stripe(STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, tenantId } = body as {
      action?: 'enable' | 'disable';
      tenantId?: number;
    };

    if (!action || !tenantId) {
      return NextResponse.json(
        { error: 'Missing action or tenantId.' },
        { status: 400 }
      );
    }

    // Load tenant (server-side, using service role)
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select(
        'id, owner_id, property_id, email, name, monthly_rent, auto_pay_enabled, auto_pay_stripe_subscription_id'
      )
      .eq('id', tenantId)
      .maybeSingle();

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
