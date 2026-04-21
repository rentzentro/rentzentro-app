import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resend } from '../../lib/resend';
import { getDirection, buildRecipients, buildMessageEmail } from './messageEmailFlow';

const FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL ||
  'RentZentro <notifications@rentzentro.com>';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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

type TeamMemberRow = {
  id: number;
  owner_user_id: string;
  member_user_id: string | null;
  member_email: string;
  status: string | null;
};

export async function POST(req: Request) {
  // If Supabase admin is misconfigured, log + no-op so we don't break UI
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error(
      'message-email: Supabase admin credentials are not configured.'
    );
    return NextResponse.json({ ok: true });
  }

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
      console.error('message-email: error loading message:', msgError);
      return NextResponse.json({ ok: true }); // don't break UI
    }

    if (!msg) {
      console.error('message-email: message not found for id:', messageId);
      return NextResponse.json({ ok: true });
    }

    const message = msg as MessageRecord;

    if (!message.body || !message.sender_type) {
      console.error(
        'message-email: missing body or sender_type for message:',
        message
      );
      return NextResponse.json({ ok: true });
    }

    // 2) Determine direction based on sender_type
    const direction = getDirection(message.sender_type);
    if (!direction) {
      console.error('message-email: unknown sender_type:', message);
      return NextResponse.json({ ok: true });
    }

    // 3) Load landlord + tenant rows
    let landlordRow: LandlordRow | null = null;
    let tenantRow: TenantRow | null = null;

    // Landlord by landlord_id
    if (message.landlord_id != null) {
      const { data: lRow, error: lErr } = await supabaseAdmin
        .from('landlords')
        .select('id, user_id, name, email')
        .eq('id', message.landlord_id)
        .maybeSingle();

      if (lErr) {
        console.error('message-email: landlord load error (by id):', lErr);
      } else if (lRow) {
        landlordRow = lRow as LandlordRow;
      }
    }

    // Fallback landlord by landlord_user_id
    if (!landlordRow && message.landlord_user_id) {
      const { data: lRow2, error: lErr2 } = await supabaseAdmin
        .from('landlords')
        .select('id, user_id, name, email')
        .eq('user_id', message.landlord_user_id)
        .maybeSingle();

      if (lErr2) {
        console.error(
          'message-email: landlord load error (by user_id):',
          lErr2
        );
      } else if (lRow2) {
        landlordRow = lRow2 as LandlordRow;
      }
    }

    // Tenant by tenant_id
    if (message.tenant_id != null) {
      const { data: tRow, error: tErr } = await supabaseAdmin
        .from('tenants')
        .select('id, user_id, name, email')
        .eq('id', message.tenant_id)
        .maybeSingle();

      if (tErr) {
        console.error('message-email: tenant load error (by id):', tErr);
      } else if (tRow) {
        tenantRow = tRow as TenantRow;
      }
    }

    // Fallback tenant by tenant_user_id
    if (!tenantRow && message.tenant_user_id) {
      const { data: tRow2, error: tErr2 } = await supabaseAdmin
        .from('tenants')
        .select('id, user_id, name, email')
        .eq('user_id', message.tenant_user_id)
        .maybeSingle();

      if (tErr2) {
        console.error(
          'message-email: tenant load error (by user_id):',
          tErr2
        );
      } else if (tRow2) {
        tenantRow = tRow2 as TenantRow;
      }
    }

    if (!landlordRow || !tenantRow) {
      console.error(
        'message-email: missing landlord or tenant row:',
        landlordRow,
        tenantRow
      );
      return NextResponse.json({ ok: true }); // skip email, do not error
    }

    const landlordName = landlordRow.name || landlordRow.email;
    const landlordEmail = landlordRow.email;
    const tenantName = tenantRow.name || tenantRow.email;
    const tenantEmail = tenantRow.email;
    const messageBody = message.body || '';

    if (!landlordEmail || !tenantEmail) {
      console.error(
        'message-email: missing landlordEmail or tenantEmail:',
        landlordEmail,
        tenantEmail
      );
      return NextResponse.json({ ok: true });
    }

    // 4) If tenant → landlord, also load active team members for this landlord
    const teamEmails: string[] = [];

    if (direction === 'tenant_to_landlord') {
      try {
        const { data: teamRows, error: teamError } = await supabaseAdmin
          .from('landlord_team_members')
          .select('member_email, status, owner_user_id')
          .eq('owner_user_id', landlordRow.user_id)
          .eq('status', 'active');

        if (teamError) {
          console.error(
            'message-email: team member load error:',
            teamError
          );
        } else if (teamRows && teamRows.length > 0) {
          for (const row of teamRows as TeamMemberRow[]) {
            if (row.member_email) {
              teamEmails.push(row.member_email);
            }
          }
        }
      } catch (teamErr) {
        console.error(
          'message-email: team member lookup threw:',
          teamErr
        );
      }
    }

    const recipients = buildRecipients({
      direction,
      landlordEmail,
      tenantEmail,
      teamEmails,
    });

    if (recipients.length === 0) {
      console.error('message-email: no recipients resolved.');
      return NextResponse.json({ ok: true });
    }

    // 5) Build email content
    const { subject, html, text } = buildMessageEmail({
      direction,
      landlordName,
      tenantName,
      messageBody,
    });

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipients,
        subject,
        html,
        text,
      });
    } catch (sendErr) {
      console.error('message-email: error sending email via Resend:', sendErr);
      // still return ok so UI doesn't show "failed to send message"
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('message-email: unexpected error:', err);
    // never crash the UI – message has already been stored
    return NextResponse.json({ ok: true });
  }
}
