// app/api/rent-reminders/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';

// --- Supabase admin client ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- Email setup (same stack as maintenance emails) ---
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL || 'no-reply@rentzentro.com';

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function POST() {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error('[rent-reminders] Supabase env vars missing');
      return NextResponse.json(
        { error: 'Server not configured for Supabase.' },
        { status: 500 }
      );
    }

    if (!resend) {
      console.error('[rent-reminders] RESEND_API_KEY missing');
      return NextResponse.json(
        { error: 'Email service not configured.' },
        { status: 500 }
      );
    }

    // Use pure date string (no time zone) for comparison
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

    // 1) Find properties with rent due today or earlier
    const { data: dueProperties, error: propsError } = await supabaseAdmin
      .from('properties')
      .select('id, name, unit_label, monthly_rent, next_due_date, owner_id')
      .not('next_due_date', 'is', null)
      .lte('next_due_date', today);
      // NOTE: intentionally no .eq('status', 'current') so we don't miss "Current"

    if (propsError) {
      console.error('[rent-reminders] Error loading properties:', propsError);
      return NextResponse.json(
        { error: 'Failed to load properties.' },
        { status: 500 }
      );
    }

    if (!dueProperties || dueProperties.length === 0) {
      console.log('[rent-reminders] No properties due on or before', today);
      return NextResponse.json(
        { message: 'Success: No active tenants to notify' },
        { status: 200 }
      );
    }

    const propertyIds = dueProperties.map((p) => p.id);

    // 2) Load tenants on those properties who have an email
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, email, status, monthly_rent, property_id')
      .in('property_id', propertyIds)
      .not('email', 'is', null)
      .neq('email', '');
      // NOTE: no status filter, to avoid "current" vs "Current" mismatch

    if (tenantsError) {
      console.error('[rent-reminders] Error loading tenants:', tenantsError);
      return NextResponse.json(
        { error: 'Failed to load tenants.' },
        { status: 500 }
      );
    }

    if (!tenants || tenants.length === 0) {
      console.log(
        '[rent-reminders] Properties due, but no tenants with email.'
      );
      return NextResponse.json(
        { message: 'Success: No active tenants to notify' },
        { status: 200 }
      );
    }

    // Quick lookup for property info by id
    const propertyById = new Map<number, any>();
    for (const p of dueProperties) {
      propertyById.set(p.id as number, p);
    }

    // 3) Send emails (one per tenant)
    let successCount = 0;
    let failCount = 0;

    for (const t of tenants) {
      const email = (t.email || '').trim();
      if (!email) continue;

      const prop = t.property_id
        ? propertyById.get(t.property_id as number)
        : null;

      const propertyName = prop?.name || 'your rental unit';
      const unitLabel = prop?.unit_label ? ` · ${prop.unit_label}` : '';
      const rentAmount = t.monthly_rent ?? prop?.monthly_rent ?? null;
      const dueDate = prop?.next_due_date || today; // fallback

      const subject = `Rent reminder for ${propertyName}${unitLabel}`;
      const friendlyAmount = rentAmount
        ? `$${Number(rentAmount).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : 'your monthly rent';

      const friendlyDate = new Date(dueDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const html = `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #0f172a;">
          <h2 style="color:#022c22;">Rent reminder from RentZentro</h2>
          <p>Hi ${t.name || 'there'},</p>
          <p>This is a friendly reminder that your rent for
            <strong>${propertyName}${unitLabel}</strong>
            is due on <strong>${friendlyDate}</strong>.</p>
          <p>Amount due: <strong>${friendlyAmount}</strong></p>
          <p>If your landlord has enabled online payments, you can pay securely through your RentZentro tenant portal.</p>
          <p style="margin-top:16px;">If you&apos;ve already paid, you can ignore this message.</p>
          <p style="margin-top:24px; font-size:12px; color:#64748b;">
            Sent by RentZentro on behalf of your landlord.
          </p>
        </div>
      `;

      try {
        const result = await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject,
          html,
        });

        console.log('[rent-reminders] Email sent', {
          tenantId: t.id,
          email,
          resultId: (result as any)?.id,
        });

        successCount++;
      } catch (sendErr: any) {
        console.error(
          '[rent-reminders] Failed to send email to',
          email,
          sendErr
        );
        failCount++;
      }
    }

    return NextResponse.json(
      {
        message: `Reminder job completed. Emails sent: ${successCount}, failed: ${failCount}.`,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[rent-reminders] Unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while running rent reminders.',
      },
      { status: 500 }
    );
  }
}
