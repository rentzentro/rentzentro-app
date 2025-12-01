// app/api/messages/notify/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const RESEND_API_KEY = process.env.RESEND_API_KEY as string;

// This should be notifications@rentzentro.com in your env
const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL || 'notifications@rentzentro.com';

const resend = new Resend(RESEND_API_KEY);

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      messageId?: string;
    };

    const { messageId } = body;

    if (!messageId) {
      console.error('[messages/notify] Missing messageId in body', body);
      return NextResponse.json(
        { error: 'Missing messageId' },
        { status: 400 }
      );
    }

    console.log('[messages/notify] Incoming request', { messageId });

    // 1) Load message
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .select(
        `
        id,
        created_at,
        body,
        sender_type,
        landlord_id,
        tenant_id
      `
      )
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) {
      console.error('[messages/notify] Error loading message', messageError);
      return NextResponse.json(
        { error: 'Failed to load message' },
        { status: 500 }
      );
    }

    if (!message) {
      console.error('[messages/notify] No message found for id', messageId);
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    console.log('[messages/notify] Loaded message', message);

    // 2) Load landlord (we always need this)
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, name, email')
      .eq('id', message.landlord_id)
      .maybeSingle();

    if (landlordError) {
      console.error('[messages/notify] Error loading landlord', landlordError);
      return NextResponse.json(
        { error: 'Failed to load landlord' },
        { status: 500 }
      );
    }

    if (!landlord || !landlord.email) {
      console.error('[messages/notify] Landlord missing email', {
        landlord,
        landlord_id: message.landlord_id,
      });
      return NextResponse.json(
        { error: 'Landlord has no email' },
        { status: 400 }
      );
    }

    console.log('[messages/notify] Landlord row', landlord);

    // 3) Decide who we are emailing based on sender_type
    let toEmail: string | null = null;
    let toName: string | null = null;
    let replyToEmail: string | undefined;
    let subject: string;
    let intro: string;

    // We will also load tenant (we need it in both branches for reply-to, etc.)
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, email')
      .eq('id', message.tenant_id)
      .maybeSingle();

    if (tenantError) {
      console.error('[messages/notify] Error loading tenant', tenantError);
      // Not fatal for landlord-only notifications, but we bail for safety
      return NextResponse.json(
        { error: 'Failed to load tenant' },
        { status: 500 }
      );
    }

    // ---------- sender: landlord → notify tenant ----------
    if (message.sender_type === 'landlord') {
      if (!tenant || !tenant.email) {
        console.error('[messages/notify] Tenant missing email for notify', {
          tenant,
          tenant_id: message.tenant_id,
        });
        return NextResponse.json(
          { error: 'Tenant has no email' },
          { status: 400 }
        );
      }

      toEmail = tenant.email;
      toName = tenant.name || tenant.email;
      replyToEmail = landlord.email || undefined;

      subject = 'New message from your landlord on RentZentro';
      intro = `You have a new message from your landlord${
        landlord.name ? `, ${landlord.name}` : ''
      } on RentZentro.`;
    } else {
      // ---------- sender: tenant → notify landlord ----------
      toEmail = landlord.email;
      toName = landlord.name || landlord.email;
      replyToEmail = tenant?.email || undefined;

      subject = 'New message from your tenant on RentZentro';
      intro = `You have a new message from your tenant${
        tenant?.name ? `, ${tenant.name}` : ''
      } on RentZentro.`;
    }

    if (!toEmail) {
      console.error('[messages/notify] No recipient email resolved');
      return NextResponse.json(
        { error: 'No recipient email' },
        { status: 400 }
      );
    }

    // 4) Build email content
    const snippet = (message.body || '').slice(0, 280);

    const text = [
      intro,
      '',
      'Message:',
      message.body || '(no message body)',
      '',
      'Log in to your RentZentro portal to reply:',
      'https://www.rentzentro.com',
    ].join('\n');

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#e5e7eb; background-color:#020617; padding:24px;">
        <div style="max-width:560px; margin:0 auto; background-color:#020617; border-radius:18px; border:1px solid #1e293b; padding:20px;">
          <p style="font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#9ca3af; margin:0 0 8px;">
            RentZentro notification
          </p>
          <h1 style="font-size:18px; margin:0 0 8px; color:#f9fafb;">
            ${subject}
          </h1>
          <p style="margin:0 0 16px; color:#d1d5db;">${intro}</p>

          <div style="margin:16px 0; padding:14px 16px; border-radius:14px; background:#020617; border:1px solid #1e293b;">
            <p style="margin:0 0 6px; font-size:12px; color:#9ca3af;">Latest message:</p>
            <p style="margin:0; white-space:pre-wrap; color:#e5e7eb;">
              ${snippet || '(no message body)'}
            </p>
          </div>

          <p style="margin:16px 0 4px; font-size:13px; color:#d1d5db;">
            Log in to your RentZentro portal to view the full conversation and reply:
          </p>
          <p style="margin:0 0 16px;">
            <a href="https://www.rentzentro.com" style="display:inline-block; background-color:#22c55e; color:#020617; padding:8px 16px; border-radius:999px; font-weight:600; font-size:13px; text-decoration:none;">
              Open RentZentro
            </a>
          </p>

          <p style="margin:12px 0 0; font-size:11px; color:#6b7280;">
            You’re receiving this email because messaging is enabled for your RentZentro account.
          </p>
        </div>
      </div>
    `;

    // 5) Send via Resend
    const sendResult = await resend.emails.send({
      from: `RentZentro <${FROM_EMAIL}>`,
      to: [toEmail],
      subject,
      text,
      html,
      // OK if undefined – Resend ignores it when not set
      reply_to: replyToEmail,
    } as any);

    console.log('[messages/notify] Resend send result', sendResult);

    if ((sendResult as any).error) {
      console.error(
        '[messages/notify] Resend error',
        (sendResult as any).error
      );
      return NextResponse.json(
        { error: 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[messages/notify] Unexpected error', err);
    return NextResponse.json(
      { error: 'Internal error sending notify email' },
      { status: 500 }
    );
  }
}
