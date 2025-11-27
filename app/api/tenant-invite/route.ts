// app/api/tenant-invite/route.ts
import { NextResponse } from 'next/server';
import { resend } from '../../lib/resend';

const RENTZENTRO_FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL ||
  'RentZentro <notifications@rentzentro.com>';

const RENTZENTRO_REPLY_TO =
  process.env.RENTZENTRO_REPLY_TO || 'rentzentro@gmail.com';

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
      propertyName?: string;
      unitLabel?: string;
      landlordName?: string;
    };

    if (!tenantEmail) {
      return NextResponse.json(
        { error: 'Missing tenantEmail in request body.' },
        { status: 400 }
      );
    }

    const safeTenantName = tenantName?.trim() || 'there';
    const safePropertyName = propertyName?.trim() || 'your rental';
    const safeUnitLabel = unitLabel?.trim()
      ? ` · ${unitLabel.trim()}`
      : '';
    const safeLandlordName = landlordName?.trim() || 'your landlord';

    // 🔥 Single-entry link: goes straight to signup with email prefilled
    const signupUrl = `https://www.rentzentro.com/tenant/signup?email=${encodeURIComponent(
      tenantEmail
    )}`;

    const subject = `You're invited to pay rent online for ${safePropertyName}${safeUnitLabel}`;

    const text = `
Hi ${safeTenantName},

${safeLandlordName} has invited you to pay rent online with RentZentro for:

${safePropertyName}${safeUnitLabel}

To get started, open your tenant signup page here:
${signupUrl}

From your tenant portal you will be able to:
- View your rent amount and due date
- See your lease and shared documents
- Submit and track maintenance requests

If you weren't expecting this email, you can safely ignore it.

– RentZentro
Simple rent collection for landlords.
    `.trim();

    const html = `
<div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #e5e7eb; background: #020617; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background: radial-gradient(circle at top, #1e293b, #020617); border-radius: 16px; padding: 24px; border: 1px solid #1f2937;">
    <h1 style="font-size: 20px; margin-bottom: 8px; color: #f9fafb;">
      You're invited to your RentZentro tenant portal
    </h1>
    <p style="margin: 0 0 4px 0; font-size: 14px; color: #e5e7eb;">
      Hi ${safeTenantName},
    </p>
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #e5e7eb;">
      <strong>${safeLandlordName}</strong> has invited you to pay rent online for:
    </p>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #a5b4fc;">
      <strong>${safePropertyName}${safeUnitLabel}</strong>
    </p>
    <p style="margin: 0 0 12px 0; font-size: 14px; color: #e5e7eb;">
      Click the button below to create your tenant portal account:
    </p>
    <p style="margin: 0 0 20px 0;">
      <a href="${signupUrl}"
         style="display: inline-block; padding: 10px 18px; border-radius: 999px; background: #22c55e; color: #020617; font-weight: 600; font-size: 14px; text-decoration: none;">
        Complete tenant signup
      </a>
    </p>
    <p style="margin: 0 0 12px 0; font-size: 13px; color: #9ca3af;">
      Or copy and paste this link into your browser:<br/>
      <span style="color:#e5e7eb;">${signupUrl}</span>
    </p>
    <hr style="border:none; border-top:1px solid #1f2937; margin:16px 0;" />
    <p style="margin: 0; font-size: 12px; color: #6b7280;">
      If you weren't expecting this email, you can safely ignore it.
    </p>
    <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">
      – RentZentro
    </p>
  </div>
</div>
    `.trim();

    const result = await resend.emails.send({
      from: RENTZENTRO_FROM_EMAIL,
      to: tenantEmail,
      subject,
      text,
      html,
      // Resend supports reply_to; we cast to any to keep TS happy
      reply_to: RENTZENTRO_REPLY_TO,
    } as any);

    console.log('Tenant invite sent:', result);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('Tenant invite error:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unexpected error while sending tenant invite.',
      },
      { status: 500 }
    );
  }
}
