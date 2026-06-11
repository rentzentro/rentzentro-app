// app/api/owner/activation-outreach-email/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../supabaseAdminClient';
import { enforceOwnerApiAccess } from '../../../lib/ownerApiAuth';
import { getRateLimitClientIp, takeRateLimitToken } from '../../../lib/requestRateLimiter';
import { isResendConfigured, resend } from '../../../lib/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LandlordRow = {
  id: number;
  user_id: string | null;
  name: string | null;
  email: string | null;
};

type OutreachSenderKey = 'support' | 'bradley';

type OutreachInsertResult = {
  trackingWarning: string | null;
  sentAt: string;
  nextFollowUpAt: string;
};

const ACTIVATION_OUTREACH_FOLLOW_UP_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const OUTREACH_SENDERS: Record<
  OutreachSenderKey,
  { from: string; replyTo: string; label: string }
> = {
  support: {
    from: 'RentZentro Support <support@rentzentro.com>',
    replyTo: 'support@rentzentro.com',
    label: 'RentZentro Support',
  },
  bradley: {
    from: 'Bradley at RentZentro <bradley@rentzentro.com>',
    replyTo: 'bradley@rentzentro.com',
    label: 'Bradley at RentZentro',
  },
};

const buildOutreachEmail = ({
  landlord,
  missingProperty,
  missingTenant,
}: {
  landlord: LandlordRow;
  missingProperty: boolean;
  missingTenant: boolean;
}) => {
  const missingSteps = [
    missingProperty ? 'property' : null,
    missingTenant ? 'tenant' : null,
  ].filter(Boolean);
  const greeting = landlord.name ? `Hi ${landlord.name},` : 'Hi there,';
  const missingText = missingSteps.join(' or ');
  const subject = 'Can I help you finish setting up RentZentro?';
  const text = `${greeting}\n\nI noticed you signed up for RentZentro but have not added a ${missingText} yet. Do you need any help getting your account set up?\n\nI can walk you through adding your first property, inviting a tenant, or answering any questions.\n\nBest,\nRentZentro Team`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a;">
      <p>${greeting}</p>
      <p>
        I noticed you signed up for RentZentro but have not added a ${missingText} yet.
        Do you need any help getting your account set up?
      </p>
      <p>
        I can walk you through adding your first property, inviting a tenant, or answering any questions.
      </p>
      <p>Best,<br/>RentZentro Team</p>
    </div>
  `;

  return { subject, text, html };
};


const isMissingActivationOutreachTableError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');

  return (
    code === '42P01' ||
    message.includes('owner_activation_outreach_events') ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  );
};

const getResendMessageId = (result: any): string | null => {
  const id = result?.data?.id || result?.id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
};

const recordActivationOutreachEvent = async ({
  landlord,
  recipientEmail,
  senderKey,
  senderLabel,
  resendMessageId,
  missingProperty,
  missingTenant,
}: {
  landlord: LandlordRow;
  recipientEmail: string;
  senderKey: OutreachSenderKey;
  senderLabel: string;
  resendMessageId: string | null;
  missingProperty: boolean;
  missingTenant: boolean;
}): Promise<OutreachInsertResult> => {
  const sentAt = new Date().toISOString();
  const nextFollowUpAt = new Date(
    new Date(sentAt).getTime() + ACTIVATION_OUTREACH_FOLLOW_UP_DAYS * MS_PER_DAY
  ).toISOString();

  const result = await supabaseAdmin.from('owner_activation_outreach_events').insert({
    landlord_id: landlord.id,
    landlord_user_id: landlord.user_id,
    recipient_email: recipientEmail,
    sender_key: senderKey,
    sender_label: senderLabel,
    resend_message_id: resendMessageId,
    missing_property: missingProperty,
    missing_tenant: missingTenant,
    sent_at: sentAt,
  });

  if (result.error) {
    if (isMissingActivationOutreachTableError(result.error)) {
      const trackingWarning =
        'Email sent, but follow-up tracking is not available until the owner_activation_outreach_events table is migrated.';
      console.warn(`[owner activation outreach email] ${trackingWarning}`);
      return { trackingWarning, sentAt, nextFollowUpAt };
    }

    const trackingWarning =
      'Email sent, but follow-up tracking could not be saved. Please check the owner_activation_outreach_events table.';
    console.error('[owner activation outreach email] tracking insert failed:', result.error);
    return { trackingWarning, sentAt, nextFollowUpAt };
  }

  return { trackingWarning: null, sentAt, nextFollowUpAt };
};

const countRowsForOwner = async (table: 'properties' | 'tenants', ownerId: string) => {
  const result = await supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);

  if (result.error) throw result.error;

  return result.count || 0;
};

export async function POST(req: Request) {
  const ip = getRateLimitClientIp(req);
  const rate = takeRateLimitToken({
    key: `owner-activation-outreach-email:${ip}`,
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, error: 'Rate limit exceeded for activation outreach emails.' },
      { status: 429 }
    );
  }

  const auth = await enforceOwnerApiAccess({ req, supabaseAdmin });
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  if (!isResendConfigured()) {
    return NextResponse.json(
      { ok: false, error: 'Email service is not configured.' },
      { status: 503 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const landlordId = Number(body?.landlordId);
    const senderKey: OutreachSenderKey =
      body?.sender === 'bradley' ? 'bradley' : 'support';

    if (!Number.isInteger(landlordId) || landlordId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'A valid landlordId is required.' },
        { status: 400 }
      );
    }

    const landlordRes = await supabaseAdmin
      .from('landlords')
      .select('id, user_id, name, email')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordRes.error) throw landlordRes.error;

    const landlord = landlordRes.data as LandlordRow | null;
    const email = String(landlord?.email || '').trim().toLowerCase();

    if (!landlord || !email) {
      return NextResponse.json(
        { ok: false, error: 'Landlord email was not found.' },
        { status: 404 }
      );
    }

    if (!landlord.user_id) {
      return NextResponse.json(
        { ok: false, error: 'Landlord is not linked to a user account.' },
        { status: 400 }
      );
    }

    const [propertyCount, tenantCount] = await Promise.all([
      countRowsForOwner('properties', landlord.user_id),
      countRowsForOwner('tenants', landlord.user_id),
    ]);

    const missingProperty = propertyCount === 0;
    const missingTenant = tenantCount === 0;

    if (!missingProperty && !missingTenant) {
      return NextResponse.json(
        { ok: false, error: 'This landlord already has a property and tenant.' },
        { status: 409 }
      );
    }

    const sender = OUTREACH_SENDERS[senderKey];
    const message = buildOutreachEmail({ landlord, missingProperty, missingTenant });

    const result = await resend.emails.send({
      from: sender.from,
      to: email,
      replyTo: sender.replyTo,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    const outreach = await recordActivationOutreachEvent({
      landlord,
      recipientEmail: email,
      senderKey,
      senderLabel: sender.label,
      resendMessageId: getResendMessageId(result),
      missingProperty,
      missingTenant,
    });

    return NextResponse.json(
      {
        ok: true,
        data: result,
        sender: senderKey,
        senderLabel: sender.label,
        outreach: {
          sentAt: outreach.sentAt,
          nextFollowUpAt: outreach.nextFollowUpAt,
          followUpCooldownDays: ACTIVATION_OUTREACH_FOLLOW_UP_DAYS,
          trackingWarning: outreach.trackingWarning,
        },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[owner activation outreach email] error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Unable to send activation outreach email.' },
      { status: 500 }
    );
  }
}
