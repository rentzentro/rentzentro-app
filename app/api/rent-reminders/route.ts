// app/api/rent-reminders/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';

// ---------- Supabase (admin) ----------
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// ---------- Resend (email) ----------
const resendApiKey = process.env.RESEND_API_KEY;
const defaultFromEmail =
  process.env.RENTZENTRO_FROM_EMAIL || 'no-reply@rentzentro.com';

const resend = resendApiKey ? new Resend(resendApiKey) : null;

// ---------- Types ----------
type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
  next_due_date: string | null; // ISO date string (YYYY-MM-DD or ISO)
  owner_id: number | null;
};

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  status: string | null;
  property_id: number | null;
  monthly_rent: number | null;
};

type LandlordRow = {
  id: number;
  name: string | null;
  email: string;
};

// ---------- Helpers ----------
function todayDateStringUTC() {
  const now = new Date();
  // Use UTC date portion (YYYY-MM-DD)
  return now.toISOString().slice(0, 10);
}

function normalizeDateOnly(value: string | null): string | null {
  if (!value) return null;
  // If already just YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Otherwise, assume ISO and slice
  return value.slice(0, 10);
}

function daysDifference(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00Z').getTime();
  const b = new Date(to + 'T00:00:00Z').getTime();
  const diffMs = b - a;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: number | null): string {
  if (amount == null || Number.isNaN(amount)) return '';
  return `$${amount.toFixed(2)}`;
}

// ---------- Email builder ----------
function buildEmailForTenant(opts: {
  tenant: TenantRow;
  property: PropertyRow;
  landlord: LandlordRow | null;
  dueDate: string;
  isPastDue: boolean;
  daysLate: number;
}) {
  const { tenant, property, landlord, dueDate, isPastDue, daysLate } = opts;

  const tenantName = tenant.name || 'Tenant';
  const propName = property.name || 'your rental';
  const unit = property.unit_label ? ` · ${property.unit_label}` : '';
  const rentAmount = formatCurrency(tenant.monthly_rent);
  const prettyDue = new Date(dueDate + 'T00:00:00Z').toLocaleDateString(
    'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const subject = isPastDue
    ? `Rent past due for ${propName}${unit}`
    : `Rent due today for ${propName}${unit}`;

  const introLine = isPastDue
    ? `Our records show your rent payment for ${propName}${unit} is past due.`
    : `This is a reminder that your rent payment for ${propName}${unit} is due today.`;

  const lateLine = isPastDue
    ? `As of today, this payment is ${daysLate} day${
        daysLate === 1 ? '' : 's'
      } late.`
    : '';

  const amountLine = rentAmount
    ? `Expected monthly rent: ${rentAmount}.`
    : 'Please refer to your lease for the expected rent amount.';

  const landlordLine = landlord
    ? `If you’ve already paid, you can ignore this message. Otherwise, please submit your payment as soon as possible or contact your landlord, ${landlord.name || landlord.email}, with any questions.`
    : `If you’ve already paid, you can ignore this message. Otherwise, please submit your payment as soon as possible or contact your landlord with any questions.`;

  const text = [
    `${tenantName},`,
    '',
    introLine,
    '',
    `Due date on file: ${prettyDue}.`,
    lateLine,
    '',
    amountLine,
    '',
    'You can pay your rent securely through your RentZentro tenant portal provided by your landlord.',
    '',
    landlordLine,
    '',
    '— RentZentro automated reminder',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, text };
}

// ---------- Main handler ----------
export async function POST(req: Request) {
  try {
    if (!resend) {
      console.error('[rent-reminders] RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service not configured.' },
        { status: 500 }
      );
    }

    const today = todayDateStringUTC();

    // 1) Find all properties with next_due_date <= today
    const { data: properties, error: propsError } = await supabaseAdmin
      .from('properties')
      .select('id, name, unit_label, next_due_date, owner_id')
      .not('next_due_date', 'is', null)
      .lte('next_due_date', today);

    if (propsError) {
      console.error('[rent-reminders] Error loading properties:', propsError);
      return NextResponse.json(
        { error: 'Failed to load due properties.' },
        { status: 500 }
      );
    }

    if (!properties || properties.length === 0) {
      console.log(
        '[rent-reminders] No properties with rent due or past due today.'
      );
      return NextResponse.json(
        { message: 'No rent reminders to send today.' },
        { status: 200 }
      );
    }

    const normalizedProps: PropertyRow[] = properties.map((p: any) => ({
      id: p.id,
      name: p.name,
      unit_label: p.unit_label,
      next_due_date: normalizeDateOnly(p.next_due_date),
      owner_id: p.owner_id,
    }));

    const propertyIds = normalizedProps.map((p) => p.id);
    const landlordIds = Array.from(
      new Set(
        normalizedProps
          .map((p) => p.owner_id)
          .filter((id): id is number => typeof id === 'number')
      )
    );

    // 2) Load landlords in one query
    const landlordsMap = new Map<number, LandlordRow>();
    if (landlordIds.length > 0) {
      const { data: landlords, error: landlordsError } = await supabaseAdmin
        .from('landlords')
        .select('id, name, email')
        .in('id', landlordIds);

      if (landlordsError) {
        console.error(
          '[rent-reminders] Error loading landlords:',
          landlordsError
        );
      } else if (landlords) {
        for (const l of landlords) {
          landlordsMap.set(l.id, {
            id: l.id,
            name: l.name,
            email: l.email,
          });
        }
      }
    }

    // 3) Load tenants for those properties
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, email, status, property_id, monthly_rent')
      .in('property_id', propertyIds);

    if (tenantsError) {
      console.error('[rent-reminders] Error loading tenants:', tenantsError);
      return NextResponse.json(
        { error: 'Failed to load tenants for due properties.' },
        { status: 500 }
      );
    }

    if (!tenants || tenants.length === 0) {
      console.log(
        '[rent-reminders] No tenants found for due properties; nothing to email.'
      );
      return NextResponse.json(
        { message: 'No tenants to notify.' },
        { status: 200 }
      );
    }

    // Optional: filter to "active" tenants if you use a status field
    const activeTenants: TenantRow[] = tenants.filter((t: any) => {
      if (!t.email) return false;
      if (!t.property_id) return false;
      // If you have specific statuses like 'active', 'moved_out', adjust here
      if (!t.status) return true;
      return t.status.toLowerCase() === 'active';
    });

    if (activeTenants.length === 0) {
      console.log(
        '[rent-reminders] No active tenants with email addresses found.'
      );
      return NextResponse.json(
        { message: 'No active tenants to notify.' },
        { status: 200 }
      );
    }

    // 4) Map properties by id for quick lookup
    const propsMap = new Map<number, PropertyRow>();
    for (const p of normalizedProps) {
      propsMap.set(p.id, p);
    }

    // 5) Send emails
    let sentCount = 0;
    const todayStr = today;

    for (const tenant of activeTenants) {
      const prop = tenant.property_id
        ? propsMap.get(tenant.property_id)
        : undefined;

      if (!prop || !prop.next_due_date) continue;

      const dueDate = prop.next_due_date;
      const diffDays = daysDifference(dueDate, todayStr);

      // dueDate > todayStr should not happen because we filtered <= today,
      // but guard anyway.
      if (diffDays < 0) continue;

      const isPastDue = dueDate < todayStr;
      const landlord =
        prop.owner_id != null ? landlordsMap.get(prop.owner_id) || null : null;

      const { subject, text } = buildEmailForTenant({
        tenant,
        property: prop,
        landlord,
        dueDate,
        isPastDue,
        daysLate: isPastDue ? diffDays : 0,
      });

      try {
        await resend.emails.send({
          from: defaultFromEmail,
          to: [tenant.email],
          subject,
          text,
        });

        console.log('[rent-reminders] Sent reminder to tenant', {
          tenantId: tenant.id,
          tenantEmail: tenant.email,
          propertyId: prop.id,
          dueDate,
          isPastDue,
          daysLate: isPastDue ? diffDays : 0,
        });

        sentCount += 1;
      } catch (err) {
        console.error(
          '[rent-reminders] Error sending email to tenant',
          tenant.email,
          err
        );
      }
    }

    return NextResponse.json(
      {
        message: `Rent reminders processed.`,
        sent: sentCount,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[rent-reminders] Unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while sending rent reminders.',
      },
      { status: 500 }
    );
  }
}
