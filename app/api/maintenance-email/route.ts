import { NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * Maintenance email route with debug info.
 * Sends maintenance request emails directly to the landlord of the tenant.
 */

export async function POST(req: Request) {
  const debug: any = {};
  try {
    const body = await req.json();

    const {
      landlordEmail,
      tenantName,
      tenantEmail,
      propertyName,
      unitLabel,
      title,
      description,
      priority,
    } = body as {
      landlordEmail?: string | null;
      tenantName?: string | null;
      tenantEmail?: string | null;
      propertyName?: string | null;
      unitLabel?: string | null;
      title?: string | null;
      description?: string | null;
      priority?: string | null;
    };

    debug.body = {
      landlordEmail,
      tenantName,
      tenantEmail,
      propertyName,
      unitLabel,
      title,
      priority,
      hasDescription: !!description,
    };

    const resendKey = process.env.RESEND_API_KEY;
    const fallbackNotify = process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL;
    const fallbackPublic = process.env.NEXT_PUBLIC_FALLBACK_EMAIL;

    const FROM_EMAIL = 'RentZentro <onboarding@resend.dev>';

    const to =
      (landlordEmail && landlordEmail.trim()) ||
      (fallbackNotify && fallbackNotify.trim()) ||
      (fallbackPublic && fallbackPublic.trim()) ||
      '';

    debug.env = {
      hasResendKey: !!resendKey,
      fallbackNotify,
      fallbackPublic,
      computedTo: to,
      from: FROM_EMAIL,
    };

    if (!resendKey) {
      console.error('RESEND_API_KEY missing in environment.');
      return NextResponse.json(
        {
          ok: false,
          emailSent: false,
          error: 'Missing RESEND_API_KEY on server.',
          debug,
        },
        { status: 500 }
      );
    }

    if (!to) {
      console.error('No valid TO email found for maintenance email.');
      return NextResponse.json(
        {
          ok: true,
          emailSent: false,
          error: 'No valid landlord / fallback email.',
          debug,
        },
        { status: 200 }
      );
    }

    const resend = new Resend(resendKey);

    const subject = `New maintenance request: ${title || 'No title'}`;

    const safeDescription = (description || 'No description provided')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `
      <div style="font-family: sans-serif; font-size:14px;">
        <h2>New maintenance request</h2>
        <p>A tenant submitted a new maintenance request via RentZentro.</p>

        <p><strong>Tenant:</strong> ${tenantName || 'Unknown'} ${
      tenantEmail ? `(${tenantEmail})` : ''
    }</p>
        <p><strong>Property:</strong> ${propertyName || 'N/A'}</p>
        <p><strong>Unit:</strong> ${unitLabel || 'N/A'}</p>
        <p><strong>Priority:</strong> ${priority || 'N/A'}</p>

        <h3>Title</h3>
        <p>${title || 'No title provided'}</p>

        <h3>Description</h3>
        <p style="white-space:pre-wrap;">${safeDescription}</p>

        <hr />
        <p style="font-size:12px; color:#888;">View and manage this request in your landlord dashboard.</p>
      </div>
    `;

    const text = `
New maintenance request in RentZentro

Tenant: ${tenantName || 'Unknown'} (${tenantEmail || 'No email'})
Property: ${propertyName || 'N/A'}
Unit: ${unitLabel || 'N/A'}
Priority: ${priority || 'N/A'}

Title:
${title || 'No title'}

Description:
${description || 'No description provided'}
    `.trim();

    try {
      const result = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        replyTo: tenantEmail || undefined,
        subject,
        html,
        text,
      });

      debug.resendResult = result;

      console.log('Maintenance email sent:', result);

      return NextResponse.json(
        { ok: true, emailSent: true, debug },
        { status: 200 }
      );
    } catch (sendErr: any) {
      console.error('Maintenance email send error:', sendErr);
      debug.sendError = sendErr?.message || String(sendErr);

      return NextResponse.json(
        {
          ok: false,
          emailSent: false,
          error: sendErr?.message || 'Failed to send maintenance email.',
          debug,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('Maintenance email route fatal error:', err);
    debug.fatalError = err?.message || String(err);

    return NextResponse.json(
      {
        ok: false,
        emailSent: false,
        error: err?.message || 'Unexpected error sending maintenance email.',
        debug,
      },
      { status: 500 }
    );
  }
}
