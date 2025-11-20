import { NextResponse } from 'next/server';
import { Resend } from 'resend';

type MaintenanceEmailBody = {
  landlordEmail?: string | null;
  tenantName?: string | null;
  tenantEmail?: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
};

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
    const body = (await req.json()) as MaintenanceEmailBody;

    const {
      landlordEmail,
      tenantName,
      tenantEmail,
      propertyName,
      unitLabel,
      title,
      description,
      priority,
    } = body;

    // These come from your .env / Vercel env vars
    const apiKey = process.env.RESEND_API_KEY || null;
    const fallbackTo = process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL || null;
    const from =
      process.env.RENTZENTRO_FROM_EMAIL ||
      'RentZentro <no-reply@rentzentro.com>';

    const to = landlordEmail || fallbackTo;

    // ✅ Defensive check so missing config NEVER kills a deploy
    if (!apiKey || !from || !to) {
      console.error('Missing email configuration:', {
        hasApiKey: !!apiKey,
        from,
        to,
      });
      return NextResponse.json(
        { error: 'Email configuration is missing on the server.' },
        { status: 500 }
      );
    }

    // Create the client *inside* the handler so it runs at request-time,
    // not at build-time.
    const resend = new Resend(apiKey);

    const subject = `New maintenance request: ${title || 'No title'}`;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#0f172a;">
        <h2 style="margin:0 0 8px 0; color:#16a34a;">New maintenance request</h2>
        <p style="margin:0 0 16px 0; color:#475569;">
          A tenant submitted a new maintenance request in RentZentro.
        </p>

        <table style="border-collapse:collapse; margin-bottom:16px;">
          <tbody>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Tenant:</td>
              <td style="padding:2px 0;">${tenantName || 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Email:</td>
              <td style="padding:2px 0;">${tenantEmail || 'Unknown'}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0; color:#64748b;">Property:</td>
              <td style="padding:2px 0;">
                ${propertyName || 'Not set'}
                ${unitLabel ? ' · ' + unitLabel : ''}
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

        <p style="margin:0 0 4px 0; color:#64748b;">Request title:</p>
        <p style="margin:0 0 12px 0;"><strong>${title || 'No title'}</strong></p>

        <p style="margin:0 0 4px 0; color:#64748b;">Details:</p>
        <p style="margin:0 0 16px 0; white-space:pre-wrap;">
          ${description || 'No description provided.'}
        </p>

        <p style="margin:0; color:#64748b;">
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
  } catch (err) {
    console.error('Maintenance email route error:', err);
    return NextResponse.json(
      { error: 'Unexpected error sending maintenance email.' },
      { status: 500 }
    );
  }
}
