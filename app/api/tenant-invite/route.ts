// app/api/tenant-invite/route.ts
import { NextResponse } from 'next/server';
import { resend, RENTZENTRO_FROM_EMAIL, RENTZENTRO_REPLY_TO } from '../../lib/resend';

type TenantInvitePayload = {
  tenantName: string;
  tenantEmail: string;
  propertyName?: string | null;
  unitLabel?: string | null;
  landlordName?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TenantInvitePayload;

    const {
      tenantName,
      tenantEmail,
      propertyName,
      unitLabel,
      landlordName,
    } = body;

    if (!tenantEmail) {
      return NextResponse.json(
        { error: 'Missing tenantEmail in request body.' },
        { status: 400 }
      );
    }

    const safeTenantName = tenantName?.trim() || 'there';
    const safePropertyName = propertyName?.trim() || 'your rental';
    const safeUnitLabel = unitLabel?.trim() || '';
    const safeLandlordName = landlordName?.trim() || 'your landlord';

    const fullPropertyLabel = safeUnitLabel
      ? `${safePropertyName} · ${safeUnitLabel}`
      : safePropertyName;

    const subject = `You’ve been invited to pay rent online with RentZentro`;
    const text = [
      `Hi ${safeTenantName},`,
      '',
      `${safeLandlordName} has invited you to pay rent online for ${fullPropertyLabel} using RentZentro.`,
      '',
      `With RentZentro you can:`,
      `• View your rent amount and due date`,
      `• See your lease and shared documents`,
      `• Track maintenance requests`,
      '',
      `To get started, look for an email from your landlord with your login details or portal link.`,
      '',
      `If you weren’t expecting this invitation, you can safely ignore this email.`,
      '',
      `- RentZentro`,
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
        <p>Hi ${safeTenantName},</p>

        <p><strong>${safeLandlordName}</strong> has invited you to pay rent online for <strong>${fullPropertyLabel}</strong> using RentZentro.</p>

        <p>With RentZentro you can:</p>
        <ul>
          <li>View your rent amount and due date</li>
          <li>See your lease and shared documents</li>
          <li>Track maintenance requests</li>
        </ul>

        <p>To get started, look for a follow-up email from your landlord with your login details or tenant portal link.</p>

        <p>If you weren’t expecting this invitation, you can safely ignore this email.</p>

        <p style="margin-top: 16px;">
          <strong>RentZentro</strong><br />
          Simple rent collection for small landlords.
        </p>
      </div>
    `;

    const data = await resend.emails.send({
      from: RENTZENTRO_FROM_EMAIL,
      to: tenantEmail,
      replyTo: RENTZENTRO_REPLY_TO,
      subject,
      text,
      html,
    });

    console.log('Tenant invite sent:', data);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('Tenant invite error:', error);
    return NextResponse.json(
      {
        error:
          error?.message || 'Unexpected error while sending tenant invite.',
      },
      { status: 500 }
    );
  }
}
