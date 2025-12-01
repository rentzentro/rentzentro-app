import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const RESEND_API_KEY = process.env.RESEND_API_KEY as string;
const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL || 'support@rentzentro.com';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messageId } = body || {};

    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    // 1) Load the message
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .select(
        'id, created_at, sender_type, body, landlord_id, tenant_id'
      )
      .eq('id', messageId)
      .maybeSingle();

    if (msgError) {
      console.error('Message lookup error:', msgError);
      return NextResponse.json(
        { error: 'Failed to load message' },
        { status: 500 }
      );
    }

    if (!msg) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // 2) Load landlord + tenant so we know who to email
    const [{ data: landlordRow }, { data: tenantRow }] = await Promise.all([
      supabaseAdmin
        .from('landlords')
        .select('id, name, email')
        .eq('id', msg.landlord_id)
        .maybeSingle(),
      supabaseAdmin
        .from('tenants')
        .select('id, name, email')
        .eq('id', msg.tenant_id)
        .maybeSingle(),
    ]);

    if (!landlordRow || !tenantRow) {
      console.error('Missing landlord or tenant for message', {
        landlord: landlordRow,
        tenant: tenantRow,
      });
      return NextResponse.json({ ok: true }); // silently skip
    }

    // 3) Decide who should receive the email
    let toEmail: string | null = null;
    let toName: string | null = null;
    let fromDisplay: string = 'RentZentro';

    if (msg.sender_type === 'landlord') {
      // notify tenant
      toEmail = tenantRow.email;
      toName = tenantRow.name || tenantRow.email;
      fromDisplay =
        landlordRow.name || 'Your landlord via RentZentro';
    } else {
      // msg.sender_type === 'tenant' -> notify landlord
      toEmail = landlordRow.email;
      toName = landlordRow.name || landlordRow.email;
      fromDisplay =
        tenantRow.name || 'Your tenant via RentZentro';
    }

    if (!toEmail) {
      return NextResponse.json({ ok: true }); // nothing to send
    }

    // 4) Build email content
    const snippet =
      typeof msg.body === 'string'
        ? msg.body.length > 160
          ? msg.body.slice(0, 157) + '...'
          : msg.body
        : '';

    const subject = 'New message on RentZentro';
    const text = `Hi ${toName},

You have a new message on RentZentro.

Message:
"${snippet}"

Log in to your RentZentro portal to view and reply.

– RentZentro
`;

    const html = `<p>Hi ${toName},</p>
<p>You have a new message on <strong>RentZentro</strong>.</p>
<p style="margin: 12px 0; padding: 8px 12px; border-radius: 8px; background: #020617; color: #e5e7eb; border: 1px solid #1f2937; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;">
  ${snippet || '(no message body)'}
</p>
<p>Log in to your RentZentro portal to view and reply.</p>
<p style="color:#9ca3af;">– RentZentro</p>`;

    // 5) Send via Resend
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not set; skipping email send.');
      return NextResponse.json({ ok: true });
    }

    await resend.emails.send({
      from: `${fromDisplay} <${FROM_EMAIL}>`,
      to: [toEmail],
      subject,
      text,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Messages notify handler error:', err);
    return NextResponse.json(
      { error: 'Internal error sending notification' },
      { status: 500 }
    );
  }
}
