// app/api/link-tenant-user/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../supabaseAdminClient';

const TENANT_LINK_SELECT =
  'id, owner_id, name, email, phone, status, property_id, monthly_rent, lease_start, lease_end, user_id, allow_early_payment, auto_pay_enabled';

const normalizeEmail = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

async function getAuthenticatedTenantFromRequest(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    console.warn('link-tenant-user: unable to verify tenant auth token', error);
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email || null,
  };
}

async function findTenantByEmail(email: string) {
  const normalized = normalizeEmail(email);

  if (!normalized) return { data: null, error: null };

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select(TENANT_LINK_SELECT)
    .ilike('email', email.trim())
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) return { data: null, error };

  const tenant = (data || []).find(
    (row: any) => normalizeEmail(row?.email) === normalized
  );

  return { data: tenant || null, error: null };
}

async function backfillMessageTenantUserId(tenantId: number | string, userId: string) {
  try {
    await supabaseAdmin
      .from('messages')
      .update({ tenant_user_id: userId })
      .eq('tenant_id', tenantId)
      .is('tenant_user_id', null);
  } catch (backfillError) {
    console.error(
      'link-tenant-user: message tenant_user_id backfill error:',
      backfillError
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const authenticatedTenant = await getAuthenticatedTenantFromRequest(req);

    const { tenantName } = body as {
      email?: string;
      userId?: string;
      tenantName?: string;
    };

    const email = authenticatedTenant?.email || body?.email;
    const userId = authenticatedTenant?.id || body?.userId;

    if (!email || !userId) {
      return NextResponse.json(
        { error: 'Missing email or userId in request body.' },
        { status: 400 }
      );
    }

    const { data: tenant, error: tenantLookupError } = await findTenantByEmail(email);

    if (tenantLookupError) {
      console.error('link-tenant-user tenant lookup error:', tenantLookupError);
      return NextResponse.json(
        { error: 'Failed to find tenant by email.' },
        { status: 500 }
      );
    }

    if (!tenant) {
      console.log('link-tenant-user: no tenant row found for email:', email);
      return NextResponse.json({ ok: true, linked: false }, { status: 200 });
    }

    if (tenant.user_id && tenant.user_id !== userId) {
      console.warn('link-tenant-user: tenant row already linked to another user', {
        tenantId: tenant.id,
      });
      return NextResponse.json(
        {
          error:
            'This tenant profile is already linked to another login. Please contact your landlord or RentZentro support.',
        },
        { status: 409 }
      );
    }

    if (tenant.user_id === userId) {
      await backfillMessageTenantUserId(tenant.id, userId);
      return NextResponse.json(
        { ok: true, linked: true, tenantId: tenant.id, tenant },
        { status: 200 }
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tenants')
      .update({
        user_id: userId,
        ...(tenantName ? { name: tenantName } : {}),
      })
      .eq('id', tenant.id)
      .is('user_id', null)
      .select(TENANT_LINK_SELECT)
      .maybeSingle();

    if (updateError) {
      console.error('link-tenant-user update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to link tenant to user.' },
        { status: 500 }
      );
    }

    if (!updated) {
      console.log('link-tenant-user: no tenant row updated for email:', email);
      return NextResponse.json(
        { ok: true, linked: false, tenantId: tenant.id, tenant },
        { status: 200 }
      );
    }

    await backfillMessageTenantUserId(updated.id, userId);

    console.log('link-tenant-user: linked tenant id', updated.id, 'to user', userId);

    return NextResponse.json(
      { ok: true, linked: true, tenantId: updated.id, tenant: updated },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('link-tenant-user unexpected error:', error);
    return NextResponse.json(
      {
        error:
          error?.message || 'Unexpected error while linking tenant user.',
      },
      { status: 500 }
    );
  }
}
