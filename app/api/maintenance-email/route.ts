import { NextResponse } from 'next/server';
import {
  resend,
  RENTZENTRO_FROM_EMAIL,
  RENTZENTRO_REPLY_TO,
} from '../../lib/resend';

const MAINTENANCE_NOTIFY =
  process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL || '';
const PUBLIC_FALLBACK = process.env.NEXT_PUBLIC_FALLBACK_EMAIL || '';

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

    const from = RENTZENTRO_FROM_EMAIL;

    const to =
      (landlordEmail && landlordEmail.trim()) ||
      (MAINTENANCE_NOTIFY && MAINTENANCE_NOTIFY.trim()) ||
      (RENTZENTRO_REPLY_TO && RENTZENTRO_REPLY_TO.trim()) ||
      (PUBLIC_FALLBACK && PUBLIC_FALLBACK.trim()) ||
      '';

    const debugEnv = {
      from,
      to,
      landlordEmail,
      MAINTENANCE_NOTIFY,
      PUBLIC_FALLBACK,
      RENTZENTRO_REPLY_TO,
    };

    if (!to) {
      console.error('Maintenance email: no "to" address resolved', debugEnv);
      return NextResponse.json(
        {
          ok: false,
          emailSent: false,
          error:
            'No destination email configured for maintenance notifications.',
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

    // ----- Call Resend (same client as tenant-invite) -----

    const emailOptions: {
      from: string;
      to: string;
      subject: string;
      html: string;
      reply_to?: string | string[];
    } = {
      from,
      to,
      subject,
      html,
    };

    if (tenantEmail && tenantEmail.trim().length > 0) {
      emailOptions.reply_to = tenantEmail.trim();
    } else if (RENTZENTRO_REPLY_TO) {
      emailOptions.reply_to = RENTZENTRO_REPLY_TO;
    }

    const { data, error } = await resend.emails.send(emailOptions as any);

    const debugResend = { data, error };

    if (error) {
      console.error('Resend maintenance email error:', error);
      return NextResponse.json(
        {
          ok: false,
          emailSent: false,
          error:
            (error as any)?.message ||
            (error as any)?.name ||
            'Unknown email error from Resend.',
        },
        { status: 500 }
      );
    }

    console.log(
      'Maintenance email sent:',
      (data as any)?.id || data || 'no-id',
      'to:',
      to
    );

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
