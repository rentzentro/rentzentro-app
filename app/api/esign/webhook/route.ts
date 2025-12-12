// app/api/esign/webhook/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '../../../supabaseAdminClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CALLBACK_TOKEN = process.env.DROPBOX_SIGN_CALLBACK_TOKEN || '';

function verifyDropboxSignature(rawBody: string, headerValue: string | null) {
  // Dropbox Sign sends header like: "sha256=abcdef..."
  // If you didn't set a callback token, we skip verification (ok for dev).
  if (!CALLBACK_TOKEN) return true;
  if (!headerValue) return false;

  const provided = headerValue.replace(/^sha256=/i, '').trim();
  const computed = crypto
    .createHmac('sha256', CALLBACK_TOKEN)
    .update(rawBody, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(provided, 'hex'),
    Buffer.from(computed, 'hex')
  );
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // Dropbox Sign header is commonly `X-HelloSign-Signature`
    const sig =
      req.headers.get('x-hellosign-signature') ||
      req.headers.get('X-HelloSign-Signature');

    if (!verifyDropboxSignature(rawBody, sig)) {
      console.error('[esign/webhook] Signature verification failed.');
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
    }

    let payload: any = null;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error('[esign/webhook] Invalid JSON payload');
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    // Dropbox Sign wraps events like { event: { event_type, event_time }, signature_request: {...} }
    const eventType =
      payload?.event?.event_type ||
      payload?.event_type ||
      payload?.type ||
      '';

    const signatureRequestId =
      payload?.signature_request?.signature_request_id ||
      payload?.signature_request_id ||
      null;

    if (!signatureRequestId) {
      // Some events may not include it; acknowledge anyway
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const eventLower = String(eventType).toLowerCase();

    let newStatus: string | null = null;

    // Common Dropbox Sign event types you’ll see:
    // - signature_request_sent
    // - signature_request_signed
    // - signature_request_all_signed
    // - signature_request_declined
    // - signature_request_canceled
    if (eventLower.includes('declin')) newStatus = 'declined';
    else if (eventLower.includes('cancel')) newStatus = 'cancelled';
    else if (eventLower.includes('all_signed') || eventLower.includes('signed'))
      newStatus = 'completed';
    else if (eventLower.includes('sent')) newStatus = 'sent';

    if (!newStatus) {
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const update: any = { status: newStatus };

    if (newStatus === 'completed') {
      update.signed_at = new Date().toISOString();
    }

    const { error } = await supabaseAdmin
      .from('esign_envelopes')
      .update(update)
      .eq('esign_request_id', signatureRequestId);

    if (error) {
      console.error('[esign/webhook] DB update error:', error);
      // still acknowledge so Dropbox Sign doesn't keep retrying forever
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[esign/webhook] unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Webhook handler error.' },
      { status: 500 }
    );
  }
}
