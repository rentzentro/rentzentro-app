import { NextResponse } from 'next/server';
import {
  resend,
  isResendConfigured,
  RENTZENTRO_FROM_EMAIL,
  RENTZENTRO_REPLY_TO,
} from '../../lib/resend';

const SUPPORT_EMAIL = RENTZENTRO_REPLY_TO || 'support@rentzentro.com';

type Body = {
  email?: string;
  firstName?: string | null;
};

function buildWelcomeEmail({ firstName }: { firstName?: string | null }) {
  const safeName = (firstName || '').trim();
  const greetingName = safeName ? ` ${safeName}` : '';

  const subject = 'Welcome to RentZentro 🎉';
  const text = `Hi${greetingName},\n\nWelcome to RentZentro — we’re glad you’re here.\n\nIf you need any help setting up your account, just reply to this email and ask us any questions. We’re happy to help.\n\n– The RentZentro Team\n${SUPPORT_EMAIL}`;

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <p>Hi${greetingName},</p>
      <p><strong>Welcome to RentZentro</strong> — we’re glad you’re here.</p>
      <p>
        If you need any help setting up your account, just reply to this email and ask us any
        questions. We’re happy to help.
      </p>
      <p>– The RentZentro Team<br/><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
    </div>
  `;

  return { subject, text, html };
}

export async function POST(req: Request) {
  try {
    if (!isResendConfigured()) {
      return NextResponse.json({ ok: false, error: 'Email service is not configured.' }, { status: 503 });
    }

    const body = (await req.json()) as Body;
    const email = String(body?.email || '').trim().toLowerCase();
    const firstName = body?.firstName ?? null;

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email is required.' }, { status: 400 });
    }

    const message = buildWelcomeEmail({ firstName });

    const sendResult = await resend.emails.send({
      from: RENTZENTRO_FROM_EMAIL,
      to: email,
      replyTo: SUPPORT_EMAIL,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return NextResponse.json({ ok: true, data: sendResult });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Unable to send welcome email.' },
      { status: 500 }
    );
  }
}
