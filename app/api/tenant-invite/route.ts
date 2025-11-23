// app/api/tenant-invite/route.ts
import { NextResponse } from 'next/server';
import {
  resend,
  RENTZENTRO_FROM_EMAIL,
  RENTZENTRO_REPLY_TO,
} from '../../lib/resend';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      tenantEmail,
      tenantName,
      propertyName,
      unitLabel,
      landlordName,
    } = body as {
      tenantEmail: string;
      tenantName?: string;
      propertyName: string;
      unitLabel?: string;
      landlordName?: string;
    };

    if (!tenantEmail || !propertyName) {
      return NextResponse.json(
        { error: 'Missing tenantEmail or propertyName.' },
        { status: 400 }
      );
    }

    // Use deployed site URL if set, otherwise fall back to localhost (for local dev)
    const APP_URL =
      process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    const loginUrl = `${APP_URL}/tenant/login`;

    const niceTenantName = tenantName?.trim() || 'there';
    const niceLandlordName = landlordName?.trim() || 'your landlord';
    const niceUnitLabel = unitLabel?.trim()
      ? ` · ${unitLabel.trim()}`
      : '';

    const subject = `You're invited to pay rent online for ${propertyName}${niceUnitLabel}`;

    const text = `
Hi ${niceTenantName},

${niceLandlordName} has invited you to pay rent online with RentZentro for:

${propertyName}${niceUnitLabel}

Use this link to log in or create your tenant account:

${loginUrl}

From your tenant portal you can:
- View your rent amount and due date
- See your lease and shared documents
- Submit and track maintenance requests

If you weren’t expecting this email, you can ignore it.

— RentZentro
Simple rent collection for small landlords.
    `.trim();

    const html = `
<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #e5e7eb; background: #020617; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: radial-gradient(circle at top, #1e293b, #020617); border-radius: 16px; padding: 24px; border: 1px solid #1f2937;">
    <h1 style="font-size: 20px; margin-bottom: 8px; color: #f9fafb;">
      You're invited to pay rent online
    </h1>
    <p style="margin: 0 0 4px 0; font-size: 14px; color: #e5e7eb;">
      Hi ${niceTenantName},
    </p>
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #e5e7eb;">
      ${niceLandlordName} has invited you to pay rent online with <strong>RentZentro</strong> for:
    </p>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #a5b4fc;">
      <strong>${propertyName}${niceUnitLabel}</strong>
    </p>
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #e5e7eb;">
      Click the button below to log in or create your tenant account:
    </p>
    <p style="margin: 0 0 20px 0;">
      <a href="${loginUrl}"
         style="display: inline-block; padding: 10px 18px; border-radius: 999px; background: #22c55e; color: #020617; font-weight: 600; font-size: 14px; text-decoration: none;">
        Open tenant portal
      </a>
    </p>
    <p style="margin: 0 0 12px 0; font-size: 13px; color: #9ca3af;">
      From your tenant portal you can:
    </p>
    <ul style="margin: 0 0 16px 18px; padding: 0; font-size: 13px; color: #9ca3af;">
      <li>View your rent amount and due date</li>
      <li>See your lease and shared documents</li>
      <li>Submit and track maintenance requests</li>
    </ul>
    <p style="margin: 0 0 16px 0; font-size: 12px; color: #6b7280;">
      If you weren’t expecting this email, you can safely ignore it.
    </p>
    <p style="margin: 0; font-size: 12px; color: #6b7280;">
      <strong>RentZentro</strong><br/>
      Simple rent collection for small landlords.
    </p>
  </div>
</div>
    `.trim();

    await resend.emails.send({
      from: RENTZENTRO_FROM_EMAIL,
      to: tenantEmail,
      subject,
      text,
      html,
      // keep or drop this depending on whether TS complains again
      reply_to: RENTZENTRO_REPLY_TO,
    } as any);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('Tenant invite error:', error);
    return NextResponse.json(
      { error: error?.message || 'Unexpected error while sending tenant invite.' },
      { status: 500 }
    );
  }
}
