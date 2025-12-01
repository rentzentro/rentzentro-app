import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL || 'notifications@rentzentro.com';

// Supabase admin client (service role)
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Resend client (it’s OK if API key is empty – we’ll guard later)
const resend = new Resend(RESEND_API_KEY);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messageId } = body || {};

    console.log('[messages/notify] Incoming request with body:', body);

    if (!messageId) {
      console.error('[messages/notify] Missing messageId in request body');
      return NextResponse.json(
        { error: 'messageId is required' },
        { status: 400 }
      );
    }

    if (!RESEND_API_KEY) {
      console.error(
        '[messages/notify] RESEND_API_KEY is not set. Skipping email send.'
      );
      return NextResponse.json({ ok: true });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error(
        '[messages/notify] Supabase env vars missing. Skipping email send.'
      );
      return NextResponse.json({ ok: true });
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
      console.error('[messages/notify] Message lookup error:', msgError);
      return NextResponse.json(
        { error: 'Failed to load message' },
        { status: 500 }
      );
    }

    if (!msg) {
      console.error('[messages/notify] Message not found for id:', messageId);
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    console.log('[messages/notify] Loaded message:', msg);

    // 2) Load landlord + tenant rows
    const [
      { data: landlordRow, error: landlordError },
      { data: tenantRow, error: tenantError },
    ] = await Promise.all([
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

    if (landlordError) {
      console.error('[messages/notify] Landlord lookup error:', landlordError);
    }
    if (tenantError) {
      console.error('[messages/notify] Tenant lookup error:', tenantError);
    }

    if (!landlordRow || !tenantRow) {
      console.error('[messages/notify] Missing landlord or tenant row:', {
        landlordRow,
        tenantRow,
      });
      return NextResponse.json({ ok: true });
    }

    console.log('[messages/notify] Landlord row:', landlordRow);
    console.log('[messages/notify] Tenant row:', tenantRow);

    // 3) Decide who gets the email
    const senderTypeRaw = msg.sender_type as string | null;
    const senderType =
      senderTypeRaw && senderTypeRaw.toLowerCase() === 'landlord'
        ? 'landlord'
        : 'tenant';

    let toEmail: string | null = null;
    let toName = '';
    let replyToEmail: string | null = null;
    let senderName = '';

    if (senderType === 'landlord') {
      // Landlord sent -> notify tenant
      toEmail = tenantRow.email;
      toName = tenantRow.name || tenantRow.email;
      replyToEmail = landlordRow.email;
      senderName = landlordRow.name || landlordRow.email;
    } else {
      // Tenant sent -> notify landlord
      toEmail = landlordRow.email;
      toName = landlordRow.name || landlordRow.email;
      replyToEmail = tenantRow.email;
      senderName = tenantRow.name || tenantRow.email;
    }

    console.log('[messages/notify] Computed routing:', {
      senderType,
      toEmail,
      toName,
      replyToEmail,
      senderName,
    });

    if (!toEmail) {
      console.error(
        '[messages/notify] No destination email for message id:',
        messageId
      );
      return NextResponse.json({ ok: true });
    }

    // 4) Build email content
    const snippet =
      typeof msg.body === 'string'
        ? msg.body.length > 260
          ? msg.body.slice(0, 257) + '...'
          : msg.body
        : '';

    const subject = 'New message on RentZentro';

    const text = `Hi ${toName},

You have a new message from ${senderName} on RentZentro.

Message:
"${snippet}"

Log in to your RentZentro portal to view and reply.

– RentZentro
`;

    const html = `<p>Hi ${toName},</p>
<p>You have a new message from <strong>${senderName}</strong> on <strong>RentZentro</strong>.</p>
<p style="margin: 12px 0; padding: 8px 12px; border-radius: 8px; background: #020617; color: #e5e7eb; border: 1px solid #1f2937; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;">
  ${snippet || '(no message body)'}
</p>
<p>Log in to your RentZentro portal to view and reply.</p>
<p style="color:#9ca3af;">– RentZentro</p>`;

    console.log('[messages/notify] Sending email via Resend from:', FROM_EMAIL);

    // 5) Send via Resend – ALWAYS from your verified RentZentro email
    const sendResult = (await resend.emails.send({
      from: `RentZentro <${FROM_EMAIL}>`,
      to: [toEmail],
      subject,
      text,
      html,
      replyTo: replyToEmail || undefined,
    })) as any;

    console.log('[messages/notify] Resend send result:', sendResult);

    if (sendResult?.error) {
      console.error('[messages/notify] Resend send error:', sendResult.error);
      return NextResponse.json(
        { error: 'Failed to send email notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[messages/notify] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal error sending notification' },
      { status: 500 }
    );
  }
}
