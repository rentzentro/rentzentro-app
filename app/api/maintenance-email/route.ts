import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM_ENV = process.env.RENTZENTRO_FROM_EMAIL; // e.g. "RentZentro <no-reply@rentzentro.com>"
const NOTIFY_ENV = process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL; // default landlord inbox
const PUBLIC_FALLBACK = process.env.NEXT_PUBLIC_FALLBACK_EMAIL; // last-resort fallback

const resend = new Resend(RESEND_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      landlordEmail,
      tenantName,
      tenantEmail,
      propertyName,
      unitLabel,
      title,
      description,
      priority,
    } = body || {};

    // ----- Compute from / to -----

    const from =
      (FROM_ENV && FROM_ENV.trim().length > 0
        ? FROM_ENV
        : 'RentZentro <onboarding@resend.dev>');

    const to =
      (landlordEmail && landlordEmail.trim().length > 0
        ? landlordEmail
        : NOTIFY_ENV && NOTIFY_ENV.trim().length > 0
        ? NOTIFY_ENV
        : PUBLIC_FALLBACK && PUBLIC_FALLBACK.trim().length > 0
        ? PUBLIC_FALLBACK
        : '');

    const debugEnv = {
      hasResendKey: !!RESEND_KEY,
      fromEnv: FROM_ENV,
      notifyEnv: NOTIFY_ENV,
      publicFallback: PUBLIC_FALLBACK,
      computedFrom: from,
      computedTo: to,
    };

    if (!RESEND_KEY || !to) {
      console.error('Maintenance email config missing:', debugEnv);
      return NextResponse.json(
        {
          ok: false,
          emailSent: false,
          debug: { env: debugEnv },
          error:
            'Email configuration missing on server (RESEND_API_KEY or destination address).',
        },
        { status: 500 }
      );
    }

    // ----- Build email content -----

    const subject = `New maintenance request: ${title || 'No title'}`;

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
              <td style="padding:2px 0;">${tenantName || 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Tenant email:</td>
              <td style="padding:2px 0;">${tenantEmail || 'Not provided'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Property:</td>
              <td style="padding:2px 0;">
                ${propertyName || 'Not set'}${unitLabel ? ` · ${unitLabel}` : ''}
              </td>
            </tr>
            ${
              priority
                ? `<tr>
                     <td style="padding:2px 8px 2px 0; color:#64748b;">Priority:</td>
                     <td style="padding:2px 0;">${priority}</td>
                   </tr>`
                : ''
            }
          </tbody>
        </table>

        <p style="margin:0 0 8px 0; color:#64748b;"><strong>Request title:</strong></p>
        <p style="margin:0 0 12px 0;">${title || 'No title'}</p>

        <p style="margin:0 0 8px 0; color:#64748b;"><strong>Details:</strong></p>
        <p style="margin:0 0 16px 0; white-space:pre-wrap;">
          ${description || 'No description provided.'}
        </p>

        <p style="margin:0; color:#64748b;">
          Log in to your RentZentro landlord portal to view and manage this request.
        </p>
      </div>
    `;

    // ----- Call Resend -----

    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      // let landlord reply straight to tenant
      reply_to: tenantEmail || undefined,
    });

    const debugResend = { data, error };

    if (error) {
      console.error('Resend maintenance email error:', error);
      return NextResponse.json(
        {
          ok: false,
          emailSent: false,
          debug: { env: debugEnv, resend: debugResend },
          error:
            (error as any)?.message ||
            (error as any)?.name ||
            'Unknown email error from Resend.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      emailSent: true,
      debug: { env: debugEnv, resend: debugResend },
    });
  } catch (err: any) {
    console.error('Maintenance email route fatal error:', err);
    return NextResponse.json(
      {
        ok: false,
        emailSent: false,
        error: err?.message || 'Unexpected error sending maintenance email.',
      },
      { status: 500 }
    );
  }
}
