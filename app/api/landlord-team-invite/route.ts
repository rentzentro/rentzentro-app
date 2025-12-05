// app/api/landlord-team-invite/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Re-use whatever "from" address you already use for tenant invites
const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL ||
  process.env.RENTZENTRO_FROM_ADDRESS ||
  'RentZentro <no-reply@rentzentro.com>';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { inviteEmail, landlordName } = body as {
      inviteEmail?: string;
      landlordName?: string | null;
    };

    if (!inviteEmail) {
      return NextResponse.json(
        { error: 'inviteEmail is required' },
        { status: 400 }
      );
    }

    const safeLandlordName = landlordName || 'your landlord';

    if (!process.env.RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY env var.');
      return NextResponse.json(
        {
          error:
            'Email service is not configured. Please contact support or set RESEND_API_KEY.',
        },
        { status: 500 }
      );
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: inviteEmail,
      subject: 'You’ve been invited to RentZentro',
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
          <p>Hi there,</p>
          <p><strong>${safeLandlordName}</strong> has invited you to help manage their rental portfolio in <strong>RentZentro</strong>.</p>
          <p>To get started:</p>
          <ol>
            <li>Sign up or sign in at <a href="https://www.rentzentro.com/landlord/login" target="_blank">rentzentro.com/landlord/login</a> using <strong>${inviteEmail}</strong>.</li>
            <li>Once you log in with this email, RentZentro will automatically link your account as a team member.</li>
          </ol>
          <p>If you weren’t expecting this invite, you can ignore this email.</p>
          <p style="margin-top: 16px;">Thanks,<br/>The RentZentro team</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Error sending landlord team invite email:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Failed to send team invite email. Please try again later.',
      },
      { status: 500 }
    );
  }
}
