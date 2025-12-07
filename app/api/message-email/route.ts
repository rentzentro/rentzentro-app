import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN;

const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL || 'RentZentro <notifications@rentzentro.com>';

type Direction = 'tenant_to_landlord' | 'landlord_or_team_to_tenant';

type EmailPayload = {
  direction: Direction;
  landlordName: string;
  landlordEmail: string;
  tenantName: string;
  tenantEmail: string;
  messageBody: string;
};

export async function POST(req: Request) {
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured.');
    return NextResponse.json(
      { error: 'Email is not configured.' },
      { status: 500 }
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    const body = (await req.json()) as EmailPayload;

    const {
      direction,
      landlordName,
      landlordEmail,
      tenantName,
      tenantEmail,
      messageBody,
    } = body;

    if (!direction || !landlordEmail || !tenantEmail || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required email fields.' },
        { status: 400 }
      );
    }

    let to: string;
    let subject: string;
    let introLine: string;

    if (direction === 'tenant_to_landlord') {
      to = landlordEmail;
      subject = `New message from ${tenantName} in RentZentro`;
      introLine = `${tenantName} sent you a new message in your RentZentro portal.`;
    } else {
      to = tenantEmail;
      subject = `New message from your landlord in RentZentro`;
      introLine = `${landlordName} sent you a new message in your RentZentro portal.`;
    }

    const preview =
      messageBody.length > 180
        ? messageBody.slice(0, 177).trimEnd() + '…'
        : messageBody;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
        <p>${introLine}</p>
        <p style="margin-top: 16px; margin-bottom: 4px; font-weight: 600;">Message preview:</p>
        <blockquote style="margin: 0; padding: 8px 12px; border-left: 3px solid #10b981; background:#f1f5f9;">
          ${preview.replace(/\n/g, '<br/>')}
        </blockquote>
        <p style="margin-top: 16px;">
          To reply, log in to your RentZentro portal.
        </p>
        <p style="margin-top: 24px; font-size: 12px; color:#64748b;">
          This notification was sent by RentZentro so you don’t miss important messages about your rentals.
        </p>
      </div>
    `;

    const text = `${introLine}\n\nMessage preview:\n\n${messageBody}\n\nTo reply, log in to your RentZentro portal.`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error sending message email:', err);
    return NextResponse.json(
      { error: 'Failed to send email.' },
      { status: 500 }
    );
  }
}
