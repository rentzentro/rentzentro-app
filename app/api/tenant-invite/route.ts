import { NextResponse } from 'next/server';
import { resend } from '../../lib/resend';

const RENTZENTRO_FROM_EMAIL = 'RentZentro <no-reply@rentzentro.com>';
const RENTZENTRO_REPLY_TO = 'rentzentro@gmail.com';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tenantEmail, tenantName, propertyName, unitLabel } = body;

    if (!tenantEmail) {
      return NextResponse.json(
        { error: 'Missing tenant email' },
        { status: 400 }
      );
    }

    const subject = `You're invited to join RentZentro`;
    const text = `Hello! You've been invited to access your tenant portal at RentZentro.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>You’ve been invited to RentZentro</h2>
        <p>Hello${tenantName ? ` ${tenantName}` : ''},</p>
        <p>Your landlord has added you to their RentZentro account for:</p>
        <p><strong>${propertyName || 'Your Rental Property'}${unitLabel ? ' – ' + unitLabel : ''}</strong></p>

        <p>You can log in using your email to access your tenant portal:</p>

        <p style="margin-top: 20px;">
          <a href="https://rentzentro.com/tenant/login"
            style="background-color: #10b981; padding: 12px 20px; color: white; text-decoration: none; border-radius: 6px;">
            Log In to Tenant Portal
          </a>
        </p>

        <p style="margin-top: 20px;">
          From your portal you can:
        </p>
        <ul>
          <li>View your rent amount and due date</li>
          <li>See your lease and shared documents</li>
          <li>Track maintenance requests</li>
        </ul>

        <p style="margin-top: 20px;">If you weren't expecting this email, you can safely ignore it.</p>
        
        <p style="margin-top: 16px;">
          <strong>RentZentro</strong><br />
          Simple rent collection for small landlords.
        </p>
      </div>
    `;

    // --- SEND EMAIL ---------------------------------------------------------
    const result = await resend.emails.send({
      from: RENTZENTRO_FROM_EMAIL,
      to: tenantEmail,
      subject,
      text,
      html,
      reply_to: RENTZENTRO_REPLY_TO,
    } as any);

    // Safe logging (no TypeScript errors)
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
