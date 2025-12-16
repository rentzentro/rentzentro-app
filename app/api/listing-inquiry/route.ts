// app/api/listing-inquiry/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

type Body = {
  listingId: number;
  listingSlug?: string | null;
  listingTitle?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

async function sendResendEmail(args: {
  to: string[];
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // don’t hard-fail if not configured

  const from =
    process.env.RESEND_FROM_EMAIL ||
    'RentZentro <info@rentzentro.com>';

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: args.to,
      subject: args.subject,
      html: args.html,
    }),
  }).catch(() => {
    // ignore email failure; inquiry is still saved
  });
}

// Best-effort: try to fetch team member emails from common table names.
// If your actual table names differ, this will safely fall back to landlord only.
async function tryGetTeamEmails(landlordId: number): Promise<string[]> {
  const candidates: string[] = [];

  // 1) team_members (common)
  try {
    const { data } = await supabaseAdmin
      .from('team_members')
      .select('email, status, landlord_id')
      .eq('landlord_id', landlordId);

    (data || []).forEach((row: any) => {
      const em = (row?.email || '').toString().trim();
      const st = (row?.status || '').toString().toLowerCase();
      if (em && isEmail(em) && (!st || st === 'active' || st === 'accepted')) {
        candidates.push(em);
      }
    });
  } catch {
    // ignore
  }

  // 2) landlord_team_members (another common)
  try {
    const { data } = await supabaseAdmin
      .from('landlord_team_members')
      .select('email, status, landlord_id')
      .eq('landlord_id', landlordId);

    (data || []).forEach((row: any) => {
      const em = (row?.email || '').toString().trim();
      const st = (row?.status || '').toString().toLowerCase();
      if (em && isEmail(em) && (!st || st === 'active' || st === 'accepted')) {
        candidates.push(em);
      }
    });
  } catch {
    // ignore
  }

  // de-dupe
  return Array.from(new Set(candidates));
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const listingId = Number(body.listingId);
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const phone = (body.phone || '').toString().trim() || null;
    const message = (body.message || '').trim();

    if (!listingId || Number.isNaN(listingId)) {
      return NextResponse.json({ error: 'Invalid listingId' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!email || !isEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (!message || message.length < 5) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Find listing (and landlord owner) — adjust column names if needed
    const { data: listing, error: lErr } = await supabaseAdmin
      .from('listings')
      .select('id, slug, title, landlord_id, contact_email')
      .eq('id', listingId)
      .maybeSingle();

    if (lErr) {
      return NextResponse.json({ error: 'Failed to load listing' }, { status: 500 });
    }
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const landlordId = (listing as any).landlord_id as number | null;
    const listingSlug = (body.listingSlug || (listing as any).slug || '').toString();
    const listingTitle = (body.listingTitle || (listing as any).title || '').toString();

    // Save inquiry
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null;

    const { error: insErr } = await supabaseAdmin.from('listing_inquiries').insert({
      listing_id: listingId,
      listing_slug: listingSlug || null,
      listing_title: listingTitle || null,
      name,
      email,
      phone,
      message,
      ip,
    });

    if (insErr) {
      return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 });
    }

    // Recipients: landlord + team members (best-effort)
    const recipients: string[] = [];

    // Try landlord email from landlords table if landlord_id exists
    if (landlordId) {
      try {
        const { data: landlordRow } = await supabaseAdmin
          .from('landlords')
          .select('email')
          .eq('id', landlordId)
          .maybeSingle();

        const le = (landlordRow as any)?.email?.toString()?.trim();
        if (le && isEmail(le)) recipients.push(le);
      } catch {
        // ignore
      }

      const team = await tryGetTeamEmails(landlordId);
      team.forEach((t) => recipients.push(t));
    }

    // Fall back to contact_email on listing (if present)
    const contactEmail = (listing as any)?.contact_email?.toString()?.trim();
    if (contactEmail && isEmail(contactEmail)) recipients.push(contactEmail);

    const to = Array.from(new Set(recipients)).filter(Boolean);

    // Email (only if we have recipients)
    if (to.length > 0) {
      const subject = `New listing inquiry: ${listingTitle || 'Listing'}${listingSlug ? ` (${listingSlug})` : ''}`;

      const safe = (v: string) =>
        v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      const html = `
        <div style="font-family: ui-sans-serif, system-ui; line-height: 1.4;">
          <h2 style="margin: 0 0 10px;">New Inquiry</h2>
          <p style="margin: 0 0 6px;"><strong>Listing:</strong> ${safe(listingTitle || 'Listing')}</p>
          ${listingSlug ? `<p style="margin: 0 0 6px;"><strong>Slug:</strong> ${safe(listingSlug)}</p>` : ''}
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 14px 0;" />
          <p style="margin: 0 0 6px;"><strong>Name:</strong> ${safe(name)}</p>
          <p style="margin: 0 0 6px;"><strong>Email:</strong> ${safe(email)}</p>
          ${phone ? `<p style="margin: 0 0 6px;"><strong>Phone:</strong> ${safe(phone)}</p>` : ''}
          <p style="margin: 10px 0 0;"><strong>Message:</strong></p>
          <div style="white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 10px;">${safe(message)}</div>
          <p style="margin: 14px 0 0; font-size: 12px; color: #6b7280;">
            Sent from RentZentro public listings (one-way inquiry).
          </p>
        </div>
      `;

      await sendResendEmail({ to, subject, html });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
