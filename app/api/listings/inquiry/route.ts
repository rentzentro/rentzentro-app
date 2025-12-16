// app/api/listings/inquiry/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const listingId = Number(body?.listingId);
    const listingTitle = String(body?.listingTitle || '').trim();
    const listingSlug = String(body?.listingSlug || '').trim();

    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim();
    const phone = body?.phone ? String(body?.phone || '').trim() : null;
    const message = String(body?.message || '').trim();

    if (!Number.isFinite(listingId)) {
      return NextResponse.json({ error: 'Invalid listingId.' }, { status: 400 });
    }
    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    if (!email || !isEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }
    if (!message || message.length < 5) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // Fetch listing + owner (published only)
    const { data: listing, error: lErr } = await supabaseAdmin
      .from('listings')
      .select('id, owner_id, title, slug, published, contact_email')
      .eq('id', listingId)
      .eq('published', true)
      .maybeSingle();

    if (lErr || !listing) {
      return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
    }

    const ownerId = (listing as any).owner_id as string | null;
    const title = (listing as any).title as string;
    const slug = (listing as any).slug as string;
    const contactEmail = (listing as any).contact_email as string | null;

    // Collect recipients (landlord + team)
    let toEmails: string[] = [];

    if (ownerId) {
      // Landlord email
      const { data: landlordRow } = await supabaseAdmin
        .from('landlords')
        .select('email')
        .eq('user_id', ownerId)
        .maybeSingle();

      const landlordEmail = (landlordRow as any)?.email as string | undefined;
      if (landlordEmail && isEmail(landlordEmail)) toEmails.push(landlordEmail);

      // Team emails (best-effort)
      try {
        const { data: teamRows } = await supabaseAdmin
          .from('team_members')
          .select('email')
          .eq('landlord_user_id', ownerId);

        for (const r of (teamRows || []) as any[]) {
          if (r?.email && isEmail(r.email)) toEmails.push(r.email);
        }
      } catch {
        // ignore if table doesn't exist
      }
    }

    // Fallback to listing contact email
    if (toEmails.length === 0 && contactEmail && isEmail(contactEmail)) {
      toEmails.push(contactEmail);
    }

    // Absolute last resort fallback (recommended)
    if (
      toEmails.length === 0 &&
      process.env.INQUIRY_FALLBACK_EMAIL &&
      isEmail(process.env.INQUIRY_FALLBACK_EMAIL)
    ) {
      toEmails.push(process.env.INQUIRY_FALLBACK_EMAIL);
    }

    // Dedup
    toEmails = Array.from(new Set(toEmails));

    if (toEmails.length === 0) {
      return NextResponse.json(
        { error: 'No recipient email is configured for this listing/landlord.' },
        { status: 400 }
      );
    }

    const listingUrl = `https://www.rentzentro.com/listings/${slug}`;

    // Optional: store inquiry (best-effort if table exists)
    try {
      await supabaseAdmin.from('listing_inquiries').insert({
        listing_id: listingId,
        listing_slug: listingSlug || slug,
        listing_title: listingTitle || title,
        sender_name: name,
        sender_email: email,
        sender_phone: phone,
        message,
        created_at: new Date().toISOString(),
      });
    } catch {
      // ignore (table may not exist yet)
    }

    // If Resend isn't configured, still return OK (so form doesn't feel broken)
    if (!resend) {
      return NextResponse.json(
        { ok: true, warning: 'RESEND_API_KEY missing — email was not sent.' },
        { status: 200 }
      );
    }

    const subject = `New inquiry: ${title}`;

    const safeMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height: 1.45;">
        <h2 style="margin:0 0 10px;">New rental inquiry</h2>
        <p style="margin:0 0 10px;">
          <strong>Listing:</strong> ${title}<br/>
          <strong>Link:</strong> <a href="${listingUrl}">${listingUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;" />
        <p style="margin:0 0 6px;"><strong>From:</strong> ${name}</p>
        <p style="margin:0 0 6px;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        ${phone ? `<p style="margin:0 0 6px;"><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>` : ''}
        <div style="margin-top:12px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;">
          <p style="margin:0;white-space:pre-line;">${safeMessage}</p>
        </div>
        <p style="margin-top:14px;color:#6b7280;font-size:12px;">
          Sent via RentZentro public listing inquiry form.
        </p>
      </div>
    `;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'RentZentro <info@rentzentro.com>',
      to: toEmails,
      replyTo: email,
      subject,
      html,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error('Inquiry route error:', e);
    return NextResponse.json({ error: e?.message || 'Server error.' }, { status: 500 });
  }
}
