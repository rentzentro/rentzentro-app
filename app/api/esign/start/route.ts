// app/api/esign/start/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../supabaseAdminClient';

function getBasicAuthHeader(apiKey: string) {
  // Dropbox Sign: Basic Auth with API key as username and blank password (note the trailing ":")
  const token = Buffer.from(`${apiKey}:`).toString('base64');
  return `Basic ${token}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      landlordUserId,
      documentId,
      documentTitle,
      signerName,
      signerEmail,
    } = body as {
      landlordUserId?: string;
      documentId?: number;
      documentTitle?: string;
      signerName?: string;
      signerEmail?: string;
    };

    if (!landlordUserId) {
      return NextResponse.json({ error: 'Missing landlordUserId.' }, { status: 400 });
    }

    if (!documentId || !documentTitle) {
      return NextResponse.json(
        { error: 'documentId and documentTitle are required.' },
        { status: 400 }
      );
    }

    if (!signerName || !signerEmail) {
      return NextResponse.json(
        { error: 'Signer name and signer email are required.' },
        { status: 400 }
      );
    }

    const DROPBOX_SIGN_API_KEY = process.env.DROPBOX_SIGN_API_KEY || '';
    if (!DROPBOX_SIGN_API_KEY) {
      return NextResponse.json(
        { error: 'Dropbox Sign API key missing. Set DROPBOX_SIGN_API_KEY in env vars.' },
        { status: 500 }
      );
    }

    const testMode =
      (process.env.DROPBOX_SIGN_TEST_MODE || '').toLowerCase() === '1' ||
      (process.env.DROPBOX_SIGN_TEST_MODE || '').toLowerCase() === 'true';

    // 0) Load the document row so we have the file_url
    const { data: docRow, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, title, file_url')
      .eq('id', documentId)
      .maybeSingle();

    if (docError || !docRow) {
      return NextResponse.json(
        { error: 'Document not found.' },
        { status: 400 }
      );
    }

    const fileUrl = (docRow as any).file_url as string | null;
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Document has no file URL.' },
        { status: 400 }
      );
    }

    // 1) Check how many signatures were purchased
    const { data: purchaseRows, error: purchaseError } = await supabaseAdmin
      .from('esign_purchases')
      .select('signatures')
      .eq('landlord_user_id', landlordUserId);

    if (purchaseError) {
      console.error('[esign/start] purchase lookup error:', purchaseError);
      return NextResponse.json(
        { error: 'Unable to verify e-sign credits for this account.' },
        { status: 500 }
      );
    }

    const totalPurchased = (purchaseRows || []).reduce(
      (sum, row: any) => sum + (row.signatures ?? 0),
      0
    );

    // 2) Check how many envelopes already exist (1 envelope = 1 credit used)
    const { data: envelopeRows, error: envelopeError } = await supabaseAdmin
      .from('esign_envelopes')
      .select('id')
      .eq('landlord_user_id', landlordUserId);

    if (envelopeError) {
      console.error('[esign/start] envelope lookup error:', envelopeError);
      return NextResponse.json(
        { error: 'Unable to verify used e-sign credits.' },
        { status: 500 }
      );
    }

    const usedCount = (envelopeRows || []).length;
    if (totalPurchased <= usedCount) {
      return NextResponse.json(
        {
          error:
            'You have no remaining e-sign credits. Purchase more signatures to send another request.',
        },
        { status: 400 }
      );
    }

    // 3) Optional: lookup landlord email for convenience
    let landlordEmail: string | null = null;
    const { data: landlordRow, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('email')
      .eq('user_id', landlordUserId)
      .maybeSingle();

    if (landlordError) {
      console.warn('[esign/start] landlord email lookup error (continuing anyway):', landlordError);
    } else if (landlordRow) {
      landlordEmail = (landlordRow as any).email ?? null;
    }

    // 4) Insert envelope row FIRST (uses one credit)
    const { data: envelope, error: insertError } = await supabaseAdmin
      .from('esign_envelopes')
      .insert({
        landlord_user_id: landlordUserId,
        landlord_email: landlordEmail,
        document_title: documentTitle,
        signer_name: signerName,
        signer_email: signerEmail,
        amount_cents: 0,
        status: 'pending',
        esign_provider: 'dropbox_sign',
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[esign/start] envelope insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create e-sign envelope.' },
        { status: 500 }
      );
    }

    // 5) Send signature request via Dropbox Sign
    // API: POST https://api.hellosign.com/v3/signature_request/send
    // Uses multipart/form-data fields like file_url[0], signers[0][email_address], etc. :contentReference[oaicite:2]{index=2}
    const form = new FormData();
    if (testMode) form.append('test_mode', '1');

    form.append('title', `RentZentro: ${documentTitle}`);
    form.append('subject', `Please e-sign: ${documentTitle}`);
    form.append(
      'message',
      `Hi ${signerName},\n\nPlease review and e-sign this document.\n\nThanks,\nRentZentro`
    );

    // Document via public URL
    form.append('file_url[0]', fileUrl);

    // Single signer
    form.append('signers[0][name]', signerName);
    form.append('signers[0][email_address]', signerEmail);
    form.append('signers[0][order]', '0');

    const dsRes = await fetch('https://api.hellosign.com/v3/signature_request/send', {
      method: 'POST',
      headers: {
        Authorization: getBasicAuthHeader(DROPBOX_SIGN_API_KEY),
      },
      body: form as any,
    });

    const dsText = await dsRes.text();
    if (!dsRes.ok) {
      console.error('[esign/start] Dropbox Sign send failed:', dsRes.status, dsText);

      // Mark envelope as failed so we can see it in Supabase
      await supabaseAdmin
        .from('esign_envelopes')
        .update({ status: 'failed' })
        .eq('id', envelope.id);

      return NextResponse.json(
        { error: `Dropbox Sign send failed (${dsRes.status}). Check server logs.` },
        { status: 500 }
      );
    }

    let dsJson: any = null;
    try {
      dsJson = JSON.parse(dsText);
    } catch {
      dsJson = null;
    }

    const signatureRequestId =
      dsJson?.signature_request?.signature_request_id ||
      dsJson?.signature_request_id ||
      null;

    // 6) Update envelope with request id + status
    await supabaseAdmin
      .from('esign_envelopes')
      .update({
        status: 'sent',
        esign_request_id: signatureRequestId,
      })
      .eq('id', envelope.id);

    return NextResponse.json(
      {
        envelopeId: envelope.id,
        remainingCredits: totalPurchased - (usedCount + 1),
        signatureRequestId,
        testMode,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[esign/start] unexpected error:', err);
    return NextResponse.json(
      {
        error: err?.message || 'Unexpected error while starting the e-sign request.',
      },
      { status: 500 }
    );
  }
}
