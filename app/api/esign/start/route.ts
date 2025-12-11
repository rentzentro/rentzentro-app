// app/api/esign/start/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../supabaseAdminClient';

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
      return NextResponse.json(
        { error: 'Missing landlordUserId.' },
        { status: 400 }
      );
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
      console.warn(
        '[esign/start] landlord email lookup error (continuing anyway):',
        landlordError
      );
    } else if (landlordRow) {
      landlordEmail = (landlordRow as any).email ?? null;
    }

    // 4) Insert envelope row (this "uses" one credit)
    const { data: envelope, error: insertError } = await supabaseAdmin
      .from('esign_envelopes')
      .insert({
        landlord_user_id: landlordUserId,
        landlord_email: landlordEmail,
        document_title: documentTitle,
        signer_name: signerName,
        signer_email: signerEmail,
        amount_cents: 0,
        status: 'pending', // later you can update to "sent", "completed", etc.
        esign_provider: 'dropbox_sign', // stub for now
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

    // TODO: integrate Dropbox Sign / other provider here and update
    // esign_request_id + esign_signing_url on the envelope row.

    return NextResponse.json(
      {
        envelopeId: envelope.id,
        remainingCredits: totalPurchased - (usedCount + 1),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[esign/start] unexpected error:', err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unexpected error while starting the e-sign request.',
      },
      { status: 500 }
    );
  }
}
