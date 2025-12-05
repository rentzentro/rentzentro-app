import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.rentzentro.com';

const resend = new Resend(RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { inviteId, inviteEmail, role, ownerEmail, ownerName } = body;

    if (!inviteId || !inviteEmail) {
      return NextResponse.json(
        { error: 'Missing inviteId or inviteEmail.' },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY env var');
      return NextResponse.json(
        { error: 'Email service not configured.' },
        { status: 500 }
      );
    }

    const safeRole =
      role === 'viewer'
        ? 'Viewer — read-only'
        : 'Manager — full access';

    const fromName = ownerName || ownerEmail || 'RentZentro landlord';
    const inviteLink = `${APP_URL}/landlord/login?team_invite=${inviteId}`;

    const subject = `You’ve been invited to help manage rentals on RentZentro`;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color:#020617; color:#e5e7eb; padding:24px;">
        <div style="max-width:480px; margin:0 auto; border-radius:16px; background-color:#020617; border:1px solid #1f2937; padding:24px;">
          <h1 style="font-size:20px; margin:0 0 12px; color:#e5e7eb;">
            RentZentro team access
          </h1>
          <p style="font-size:14px; margin:0 0 12px; color:#9ca3af;">
            <strong>${fromName}</strong> has invited you to help manage their rentals in RentZentro.
          </p>
          <p style="font-size:14px; margin:0 0 12px; color:#9ca3af;">
            Role: <strong>${safeRole}</strong>
          </p>
          <p style="font-size:14px; margin:0 0 16px; color:#9ca3af;">
            Click the button below to sign up or log in with this email and access their landlord dashboard.
          </p>
          <p style="text-align:center; margin:0 0 20px;">
            <a href="${inviteLink}"
               style="display:inline-block; background-color:#22c55e; color:#020617; padding:10px 18px; border-radius:999px; font-size:14px; font-weight:600; text-decoration:none;">
              Accept team invite
            </a>
          </p>
          <p style="font-size:12px; margin:0; color:#6b7280;">
            Or copy and paste this link into your browser:<br/>
            <span style="color:#9ca3af; word-break:break-all;">${inviteLink}</span>
          </p>
        </div>
      </div>
    `;

    const text = `
${fromName} has invited you to help manage their rentals in RentZentro.

Role: ${safeRole}

Open this link to accept the invite:
${inviteLink}
    `.trim();

    const sendResult = await resend.emails.send({
      from: 'RentZentro Team <team@rentzentro.com>',
      to: inviteEmail,
      subject,
      html,
      text,
    });

    if ((sendResult as any).error) {
      console.error('Resend error:', (sendResult as any).error);
      return NextResponse.json(
        { error: 'Failed to send invite email.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      inviteId,
    });
  } catch (err: any) {
    console.error('Team invite API error:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error sending invite.' },
      { status: 500 }
    );
  }
}
