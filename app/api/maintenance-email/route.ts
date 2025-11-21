import { NextResponse } from 'next/server';
import { Resend } from 'resend';

/**
 * Maintenance email route
 * Sends maintenance request emails directly to the landlord of the tenant.
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      landlordEmail,       // 👈 landlord-specific email from the frontend
      tenantName,
      tenantEmail,
      propertyName,
      unitLabel,
      title,
      description,
      priority,
    } = body;

    // Required: RESEND API key
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error("RESEND_API_KEY missing in environment.");
      return NextResponse.json(
        { ok: false, emailSent: false, error: "Missing server email config." },
        { status: 500 }
      );
    }

    const resend = new Resend(resendKey);

    // FROM address — safe and always allowed
    const FROM_EMAIL = "RentZentro <onboarding@resend.dev>";

    // Determine TO address (landlord first, fallback to env)
    const fallbackNotify = process.env.RENTZENTRO_MAINTENANCE_NOTIFY_EMAIL;
    const fallbackPublic = process.env.NEXT_PUBLIC_FALLBACK_EMAIL;

    const to =
      (landlordEmail && landlordEmail.trim()) ||
      (fallbackNotify && fallbackNotify.trim()) ||
      (fallbackPublic && fallbackPublic.trim()) ||
      "";

    if (!to) {
      console.error("No valid TO email found.");
      return NextResponse.json(
        { ok: true, emailSent: false, error: "No valid landlord email." },
        { status: 200 }
      );
    }

    const subject = `New maintenance request: ${title || "No title"}`;

    const safeDescription = (description || "No description provided")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const html = `
      <div style="font-family: sans-serif; font-size:14px;">
        <h2>New maintenance request</h2>
        <p>A tenant submitted a new maintenance request via RentZentro.</p>

        <p><strong>Tenant:</strong> ${tenantName || "Unknown"} ${
      tenantEmail ? `(${tenantEmail})` : ""
    }</p>
        <p><strong>Property:</strong> ${propertyName || "N/A"}</p>
        <p><strong>Unit:</strong> ${unitLabel || "N/A"}</p>
        <p><strong>Priority:</strong> ${priority || "N/A"}</p>

        <h3>Title</h3>
        <p>${title || "No title provided"}</p>

        <h3>Description</h3>
        <p style="white-space:pre-wrap;">${safeDescription}</p>

        <hr />
        <p style="font-size:12px; color:#888;">View and manage this request in your landlord dashboard.</p>
      </div>
    `;

    const text = `
New maintenance request in RentZentro

Tenant: ${tenantName || "Unknown"} (${tenantEmail || "No email"})
Property: ${propertyName || "N/A"}
Unit: ${unitLabel || "N/A"}
Priority: ${priority || "N/A"}

Title:
${title || "No title"}

Description:
${description || "No description provided"}
    `.trim();

    // Send the email
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      replyTo: tenantEmail || undefined, // landlord clicks reply → responds directly to the tenant
      subject,
      html,
      text,
    });

    console.log("Maintenance email sent:", result);

    return NextResponse.json(
      { ok: true, emailSent: true },
      { status: 200 }
    );

  } catch (err: any) {
    console.error("Maintenance email error:", err);
    return NextResponse.json(
      { ok: false, emailSent: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}
