// app/api/tenant-invite/route.ts
import { NextResponse } from 'next/server';
import { resend } from '../../lib/resend';
import { sendTenantInvite } from './tenantInviteFlow';

const RENTZENTRO_FROM_EMAIL =
  process.env.RENTZENTRO_FROM_EMAIL ||
  'RentZentro <notifications@rentzentro.com>';

const RENTZENTRO_REPLY_TO =
  process.env.RENTZENTRO_REPLY_TO || 'rentzentro@gmail.com';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const {
    tenantEmail,
    tenantName,
    propertyName,
    unitLabel,
    landlordName,
  } = body as {
    tenantEmail: string;
    tenantName?: string;
    propertyName?: string;
    unitLabel?: string;
    landlordName?: string;
  };

  const result = await sendTenantInvite({
    resend,
    fromEmail: RENTZENTRO_FROM_EMAIL,
    replyTo: RENTZENTRO_REPLY_TO,
    tenantEmail,
    tenantName,
    propertyName,
    unitLabel,
    landlordName,
  });

  if (result.status === 200) {
    console.log('Tenant invite sent:', result.body.result);
  } else if (result.status >= 500) {
    console.error('Tenant invite error:', result.body.error);
  }

  return NextResponse.json(
    result.status === 200 ? { ok: true } : result.body,
    { status: result.status }
  );
}
