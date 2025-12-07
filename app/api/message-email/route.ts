import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resendApiKey =
  process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN;

const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL ||
  'RentZentro <notifications@rentzentro.com>';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type Direction = 'tenant_to_landlord' | 'landlord_or_team_to_tenant';

type MessageRecord = {
  id: string;
  landlord_id: number | null;
  landlord_user_id: string | null;
  tenant_id: number | null;
  tenant_user_id: string | null;
  body: string | null;
  sender_type: 'tenant' | 'landlord' | 'team' | string | null;
};

type LandlordRow = {
  id: number;
  user_id: string;
  name: string | null;
  email: string;
};

type TenantRow = {
  id: number;
  user_id: string | null;
  name: string | null;
  email: string;
};

export async function POST(req: Request) {
  if (!resendApiKey) {
    console.error('RESEND_API_KEY is not configured.');
    return NextResponse.json(
      { error: 'Email is not configured.' },
      { status: 500 }
    );
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Supabase admin credentials are not configured.');
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { status: 500 }
    );
  }

  const resend = new Resend(resendApiKey);

  try {
    const body = (await req.json()) as { messageId?: string };

    const { messageId } = body || {};
    if (!messageId) {
      return NextResponse.json(
        { error: 'Missing messageId in request body.' },
        { status: 400 }
      );
    }

    // 1) Load the message
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .select(
        'id, landlord_id, landlord_user_id, tenant_id, tenant_user_id, body, sender_type'
      )
      .eq('id', messageId)
      .maybeSingle();

    if (msgError) {
      console.error('Error loading message for email:', msgError);
      return NextResponse.json(
        { error: 'Unable to load message.' },
        { status: 500 }
      );
    }

    if (!msg) {
      return NextResponse.json(
        { error: 'Message not found.' },
        { status: 404 }
      );
    }

    const message = msg as MessageRecord;

    if (!message.body || !message.sender_type) {
      console.error('Message missing body or sender_type for email:', message);
      return NextResponse.json(
        { error: 'Message not eligible for email notification.' },
        { status: 400 }
      );
    }

    // 2) Determine direction based on sender_type
    let direction: Direction;
    if (message.sender_type === 'tenant') {
      direction = 'tenant_to_landlord';
    } else if (
      message.sender_type === 'landlord' ||
      message.sender_type === 'team'
    ) {
      direction = 'landlord_or_team_to_tenant';
    } else {
      console.error('Unknown sender_type for message email:', message);
      return NextResponse.json({ ok: true }); // Do not crash UI
    }

    // 3) Load landlord + tenant rows
    let landlordRow: LandlordRow | null = null;
    let tenantRow: TenantRow | null = null;

    // Landlord
    if (message.landlord_id != null) {
      const { data: lRow, error: lErr } = await supabaseAdmin
        .from('landlords')
        .select('id, user_id, name, email')
        .eq('id', message.landlord_id)
        .maybeSingle();

      if (lErr) {
        console.error('Error loading landlord for message email:', lErr);
      } else if (lRow) {
        landlordRow = lRow as LandlordRow;
      }
    }

    if (!landlordRow && message.landlord_user_id) {
      const { data: lRow2, error: lErr2 } = await supabaseAdmin
        .from('landlords')
        .select('id, user_id, name, email')
        .eq('user_id', message.landlord_user_id)
        .maybeSingle();

      if (lErr2) {
        console.error(
          'Error loading landlord by user_id for message email:',
          lErr2
        );
      } else if (lRow2) {
        landlordRow = lRow2 as LandlordRow;
      }
    }

    // Tenant
    if (message.tenant_id != null) {
      const { data: tRow, error: tErr } = await supabaseAdmin
        .from('tenants')
        .select('id, user_id, name, email')
        .eq('id', message.tenant_id)
        .maybeSingle();

      if (tErr) {
        console.error('Error loading tenant for message email:', tErr);
      } else if (tRow) {
        tenantRow = tRow as TenantRow;
      }
    }

    if (!tenantRow && message.tenant_user_id) {
      const { data: tRow2, error: tErr2 } = await supabaseAdmin
        .from('tenants')
        .select('id, user_id, name, email')
        .eq('user_id', message.tenant_user_id)
        .maybeSingle();

      if (tErr2) {
        console.error(
          'Error loading tenant by user_id for message email:',
          tErr2
        );
      } else if (tRow2) {
        tenantRow = tRow2 as TenantRow;
      }
    }

    if (!landlordRow || !tenantRow) {
      console.error(
        'Missing landlord or tenant row for message email:',
        landlordRow,
        tenantRow
      );
      return NextResponse.json({ ok: true }); // Don’t break UI; just skip email
    }

    const landlordName = landlordRow.name || landlordRow.email;
    const landlordEmail = landlordRow.email;
    const tenantName = tenantRow.name || tenantRow.email;
    const tenantEmail = tenantRow.email;
    const messageBody = message.body || '';

    if (!landlordEmail || !tenantEmail) {
      console.error(
        'Missing landlordEmail or tenantEmail for message email:',
        landlordEmail,
        tenantEmail
      );
      return NextResponse.json({ ok: true });
    }

    // 4) Build email content
    let to: string;
    let subject: string;
    let introLine: string;

    if (direction === 'tenant_to_landlord') {
      to = landlordEmail;
      subject = `New message from ${tenantName} in RentZentro`;
      introLine = `${tenantName} sent you a new message in your RentZentro portal.`;
    } else {
      to = tenantEmail;
      subject = `New message from your landlord in RentZentro`;
      introLine = `${landlordName} sent you a new message in your RentZentro portal.`;
    }

    const preview =
      messageBody.length > 180
        ? messageBody.slice(0, 177).trimEnd() + '…'
        : messageBody;

    const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
        <p>${introLine}</p>
        <p style="margin-top: 16px; margin-bottom: 4px; font-weight: 600;">Message preview:</p>
        <blockquote style="margin: 0; padding: 8px 12px; border-left: 3px solid #10b981; background:#f1f5f9;">
          ${preview.replace(/\n/g, '<br/>')}
        </blockquote>
        <p style="margin-top: 16px;">
          To reply, log in to your RentZentro portal.
        </p>
        <p style="margin-top: 24px; font-size: 12px; color:#64748b;">
          This notification was sent by RentZentro so you don’t miss important messages about your rentals.
        </p>
      </div>
    `;

    const text = `${introLine}\n\nMessage preview:\n\n${messageBody}\n\nTo reply, log in to your RentZentro portal.`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error sending message email:', err);
    return NextResponse.json(
      { error: 'Failed to send email.' },
      { status: 500 }
    );
  }
}
