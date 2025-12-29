// app/api/account/delete-request/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  landlordId?: number;
  landlordEmail?: string;
  landlordName?: string | null;
  userId?: string | null;
  reason?: string | null;
};

function safeString(v: unknown, max = 5000) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;

    const landlordId =
      typeof body.landlordId === 'number' ? body.landlordId : null;
    const landlordEmail = safeString(body.landlordEmail, 320);
    const landlordName = safeString(body.landlordName ?? '', 200) || null;
    const userId = safeString(body.userId ?? '', 200) || null;
    const reason = safeString(body.reason ?? '', 2000) || null;

    if (!landlordId || !landlordEmail) {
      return NextResponse.json(
        { error: 'Missing landlord information.' },
        { status: 400 }
      );
    }

    // --- Resend ---
    // Env required:
    // RESEND_API_KEY=...
    //
    // Optional overrides:
    // SUPPORT_EMAIL=support@rentzentro.com
    // RESEND_FROM_EMAIL=support@rentzentro.com
    const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
    const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@rentzentro.com';

    // Use your verified domain sender (rentzentro.com)
    const FROM_EMAIL =
      process.env.RESEND_FROM_EMAIL || 'support@rentzentro.com';

    if (!RESEND_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Account deletion request email is not configured (missing RESEND_API_KEY). Add RESEND_API_KEY and redeploy.',
        },
        { status: 500 }
      );
    }

    const subject = `RentZentro: Account deletion request (Landlord #${landlordId})`;

    const text = [
      'Account deletion request received.',
      '',
      `Landlord ID: ${landlordId}`,
      `Email: ${landlordEmail}`,
      `Name: ${landlordName || '(none)'}`,
      `Auth User ID: ${userId || '(unknown)'}`,
      `Reason: ${reason || '(none)'}`,
      '',
      'Note: Deleting an account should remove access and personal data where allowed. Payment/transaction records may be retained for legal/accounting purposes.',
    ].join('\n');

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height: 1.4;">
        <h2 style="margin:0 0 10px;">Account deletion request received</h2>
        <p style="margin:0 0 10px;">A landlord submitted an account deletion request from the Account &amp; subscription page.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #334155;">
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Landlord ID</td><td style="border:1px solid #334155; color:#e2e8f0;">${landlordId}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Email</td><td style="border:1px solid #334155; color:#e2e8f0;">${landlordEmail}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Name</td><td style="border:1px solid #334155; color:#e2e8f0;">${landlordName || '(none)'}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Auth User ID</td><td style="border:1px solid #334155; color:#e2e8f0;">${userId || '(unknown)'}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Reason</td><td style="border:1px solid #334155; color:#e2e8f0;">${reason || '(none)'}</td></tr>
        </table>
        <p style="margin:12px 0 0; color:#94a3b8; font-size: 12px;">
          Note: Deleting an account should remove access and personal data where allowed. Payment/transaction records may be retained for legal/accounting purposes.
        </p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `RentZentro <${FROM_EMAIL}>`,
        to: [SUPPORT_EMAIL],
        reply_to: landlordEmail,
        subject,
        text,
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error('Resend error:', resendData);
      return NextResponse.json(
        { error: 'Failed to send deletion request email.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Delete request API error:', err);
    return NextResponse.json(
      { error: 'Unexpected error submitting deletion request.' },
      { status: 500 }
    );
  }
}
