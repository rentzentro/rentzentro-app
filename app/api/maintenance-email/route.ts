import { NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * Maintenance email route
 *
 * Expects JSON body like:
 * {
 *   landlordEmail?: string;
 *   tenantName?: string;
 *   tenantEmail?: string;
 *   propertyName?: string;
 *   unitLabel?: string;
 *   title?: string;
 *   description?: string;
 *   priority?: string;
 * }
 */
export async function POST(req: Request) {
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

    // ----- ENV CONFIG -----
    const resendKey = process.env.RESEND_API_KEY || '';
    const fromEnv = process.env.RENTZENTRO_FROM_EMAIL;
    const notifyEnv = process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL;
    const publicFallback = process.env.NEXT_PUBLIC_FALLBACK_EMAIL;

    const defaultFrom = 'RentZentro <onboarding@resend.dev>';

    // sender: prefer custom fromEnv, otherwise Resend default
    const initialFrom =
      fromEnv && fromEnv.trim().length > 0 ? fromEnv.trim() : defaultFrom;

    // recipient:
    // 1) landlordEmail from request (preferred)
    // 2) maintenance notify env
    // 3) public fallback env
    const to =
      (landlordEmail && landlordEmail.trim().length > 0
        ? landlordEmail.trim()
        : notifyEnv && notifyEnv.trim().length > 0
        ? notifyEnv.trim()
        : publicFallback && publicFallback.trim().length > 0
        ? publicFallback.trim()
        : '') || '';

    console.log('Maintenance email env debug:', {
      hasResendKey: !!resendKey,
      fromEnv,
      notifyEnv,
      publicFallback,
      computedFrom: initialFrom,
      computedTo: to,
    });

    // If we’re missing critical config, don't throw – just report emailSent: false
    if (!resendKey || !to) {
      console.error('Email configuration missing on server.', {
        hasResendKey: !!resendKey,
        to,
      });

      return NextResponse.json(
        {
          ok: true,
          emailSent: false,
          error: 'Email configuration missing on server.',
        },
        { status: 200 }
      );
    }

    const resend = new Resend(resendKey);

    const subject = `New maintenance request: ${title || 'No title'}`;

    const safeDescription = (description || 'No description provided.')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
        <h2 style="margin-bottom: 4px; color:#0f172a;">New maintenance request</h2>
        <p style="margin:0 0 12px 0; color:#64748b;">
          A tenant submitted a new maintenance request in RentZentro.
        </p>

        <table style="border-collapse:collapse; margin-bottom:16px;">
          <tbody>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Tenant:</td>
              <td style="padding:2px 0;">${tenantName || 'Unknown'}${
      tenantEmail ? ` (${tenantEmail})` : ''
    }</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Property:</td>
              <td style="padding:2px 0;">${propertyName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Unit:</td>
              <td style="padding:2px 0;">${unitLabel || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Priority:</td>
              <td style="padding:2px 0;">${priority || 'N/A'}</td>
            </tr>
          </tbody>
        </table>

        <h3 style="margin:0 0 4px 0; font-size: 15px;">Title</h3>
        <p style="margin:0 0 12px 0;">${title || 'No title provided.'}</p>

        <h3 style="margin:0 0 4px 0; font-size: 15px;">Details</h3>
        <p style="margin:0 0 16px 0; white-space:pre-wrap;">${safeDescription}</p>

        <p style="margin:0; color:#64748b;">
          Log in to your RentZentro landlord portal to view and manage this request.
        </p>
      </div>
    `;

    const textBody = `
New maintenance request in RentZentro

Tenant: ${tenantName || 'Unknown'} (${tenantEmail || 'No email'})
Property: ${propertyName || 'N/A'}
Unit: ${unitLabel || 'N/A'}
Priority: ${priority || 'N/A'}

Title:
${title || 'No title provided.'}

Description:
${description || 'No description provided.'}
    `.trim();

    let lastError: any = null;

    // First attempt: use initialFrom (your custom from if configured)
    try {
      const result = await resend.emails.send({
        from: initialFrom,
        to,
        replyTo: tenantEmail || undefined, // ✅ camelCase for Resend Node SDK
        subject,
        html,
        text: textBody,
      });

      console.log('Maintenance email primary send result:', result);

      return NextResponse.json(
        { ok: true, emailSent: true, usedFallbackFrom: false },
        { status: 200 }
      );
    } catch (err: any) {
      lastError = err;
      console.error('Maintenance email primary send failed:', {
        message: err?.message,
      });
    }

    // Fallback attempt: if initialFrom was custom and different from default, retry with defaultFrom
    if (initialFrom !== defaultFrom) {
      try {
        const fallbackResult = await resend.emails.send({
          from: defaultFrom,
          to,
          replyTo: tenantEmail || undefined, // ✅ camelCase here too
          subject,
          html,
          text: textBody,
        });

        console.log('Maintenance email fallback send result:', fallbackResult);

        return NextResponse.json(
          { ok: true, emailSent: true, usedFallbackFrom: true },
          { status: 200 }
        );
      } catch (fallbackErr: any) {
        lastError = fallbackErr;
        console.error('Maintenance email fallback send failed:', {
          message: fallbackErr?.message,
        });
      }
    }

    // If we got here, both attempts failed
    return NextResponse.json(
      {
        ok: false,
        emailSent: false,
        error:
          lastError?.message || 'Failed to send maintenance email via Resend.',
      },
      { status: 500 }
    );
  } catch (err: any) {
    console.error('Maintenance email route fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        emailSent: false,
        error:
          err?.message || 'Unexpected error sending maintenance email.',
      },
      { status: 500 }
    );
  }
}
