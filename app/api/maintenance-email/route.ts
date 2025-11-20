import { NextResponse } from 'next/server';
import { Resend } from 'resend';

type MaintenanceEmailPayload = {
  landlordEmail?: string | null;
  tenantName?: string | null;
  tenantEmail?: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: string | null;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as MaintenanceEmailPayload;

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

    // --- Read env vars at request-time, NOT at module load ---
    const apiKey = process.env.RESEND_API_KEY;
    const hasResendKey = !!apiKey;

    const fallbackTo =
      process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL || null;

    const fromEnv = process.env.RENTZENTRO_FROM_EMAIL;
    // fallback is the Resend default sender
    const from =
      fromEnv && fromEnv.trim().length > 0
        ? fromEnv
        : 'RentZentro <onboarding@resend.dev>';

    const to = landlordEmail || fallbackTo;

    console.log('Maintenance email route hit with:', {
      hasResendKey,
      from,
      to,
      landlordEmail,
      fallbackTo,
      tenantName,
      tenantEmail,
      propertyName,
      unitLabel,
      title,
      priority,
    });

    // If config is missing, DO NOT crash, just skip email
    if (!hasResendKey || !to || !from) {
      console.error('Email configuration missing on server.', {
        hasResendKey,
        from,
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

    // --- Create Resend client now that we know apiKey exists ---
    const resend = new Resend(apiKey);

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
              <td style="padding:2px 8px 2px 0; color:#64748b;">Email:</td>
              <td style="padding:2px 0;">${tenantEmail || 'Unknown'}</td>
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

    let emailError: any = null;

    try {
      const { error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });

      if (error) {
        emailError = error;
        console.error('Resend send error:', error);
      }
    } catch (err) {
      emailError = err;
      console.error('Resend threw an exception:', err);
    }

    if (emailError) {
      return NextResponse.json(
        {
          ok: true,
          emailSent: false,
          error:
            (emailError as any)?.message ||
            (emailError as any)?.name ||
            'Unknown email error',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, emailSent: true });
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
