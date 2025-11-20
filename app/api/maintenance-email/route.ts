import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Expects JSON body like:
 * {
 *   landlordEmail: string;
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

    const fallbackTo = process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL || null;
    const from = process.env.RENTZENTRO_FROM_EMAIL;

    const to = landlordEmail || fallbackTo;

    if (!from || !to) {
      console.error(
        'Missing email configuration. From:',
        !!from,
        'To:',
        !!to
      );
      return NextResponse.json(
        { error: 'Email configuration is missing on the server.' },
        { status: 500 }
      );
    }

    const subject = `New maintenance request: ${title || 'No title'}`;

    const html = `
      <div style="font-family: system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;color:#0f172a;">
        <h2 style="margin-bottom:4px;">New maintenance request</h2>
        <p style="margin:0 0 12px 0;color:#6b7280;">
          A tenant submitted a new maintenance request in RentZentro.
        </p>

        <table style="border-collapse:collapse;margin-bottom:16px;">
          <tbody>
            <tr>
              <td style="padding:2px 8px 2px 0;color:#6b7280;">Tenant:</td>
              <td style="padding:2px 0;">${tenantName || 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0;color:#6b7280;">Email:</td>
              <td style="padding:2px 0;">${tenantEmail || 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0;color:#6b7280;">Property:</td>
              <td style="padding:2px 0;">
                ${propertyName || 'Not set'}
                ${unitLabel ? ` · ${unitLabel}` : ''}
              </td>
            </tr>
            ${
              priority
                ? `<tr>
                     <td style="padding:2px 8px 2px 0;color:#6b7280;">Priority:</td>
                     <td style="padding:2px 0;">${priority}</td>
                   </tr>`
                : ''
            }
          </tbody>
        </table>

        <p style="margin:0 0 4px 0;color:#6b7280;">Request title:</p>
        <p style="margin:0 0 12px 0;"><strong>${title || 'No title'}</strong></p>

        <p style="margin:0 0 4px 0;color:#6b7280;">Details:</p>
        <p style="margin:0 0 16px 0;white-space:pre-wrap;">${
          description || 'No description provided.'
        }</p>

        <p style="margin:0;color:#6b7280;">
          Log in to your RentZentro landlord portal to view and manage this request.
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('Resend send error:', error);
      return NextResponse.json(
        { error: 'Failed to send maintenance email.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Maintenance email route error:', err);
    return NextResponse.json(
      { error: 'Unexpected error sending maintenance email.' },
      { status: 500 }
    );
  }
}
