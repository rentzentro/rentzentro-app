// app/api/team-invite/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const RESEND_API_KEY = process.env.RESEND_API_KEY as string;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

const resend = new Resend(RESEND_API_KEY);

// Prefer NEXT_PUBLIC_APP_URL, then NEXT_PUBLIC_SITE_URL, then localhost
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      landlordId,
      teammateEmail,
      teammateName,
      role,
      landlordDisplayName,
    } = body as {
      landlordId: number;
      teammateEmail: string;
      teammateName?: string;
      role?: string;
      landlordDisplayName?: string;
    };

    if (!landlordId || !teammateEmail) {
      return NextResponse.json(
        { error: 'Missing landlordId or teammateEmail.' },
        { status: 400 }
      );
    }

    // Make sure landlord exists
    const { data: landlord, error: landlordError } = await supabaseAdmin
      .from('landlords')
      .select('id, email, name')
      .eq('id', landlordId)
      .maybeSingle();

    if (landlordError) {
      console.error('Error loading landlord in team invite:', landlordError);
      return NextResponse.json(
        { error: 'Unable to verify landlord account.' },
        { status: 500 }
      );
    }

    if (!landlord) {
      return NextResponse.json(
        { error: 'Landlord not found for this invite.' },
        { status: 404 }
      );
    }

    // Generate a random token for the invite
    const inviteToken = crypto.randomUUID().replace(/-/g, '');

    // Insert / update team_members row
    const { data: teamMember, error: teamError } = await supabaseAdmin
      .from('team_members')
      .upsert(
        {
          landlord_id: landlord.id,
          email: teammateEmail.toLowerCase().trim(),
          name: teammateName?.trim() || null,
          role: role || 'member',
          invite_token: inviteToken,
          invited_at: new Date().toISOString(),
          accepted_at: null,
        },
        {
          onConflict: 'landlord_id,email',
        }
      )
      .select('id, email, name, role, invite_token')
      .single();

    if (teamError) {
      console.error('Error upserting team member:', teamError);
      return NextResponse.json(
        { error: 'Failed to create team invite.' },
        { status: 500 }
      );
    }

    const displayLandlordName =
      landlordDisplayName || landlord.name || landlord.email;
    const displayTeammateName = teamMember.name || teammateEmail;

    const inviteUrl = `${APP_URL}/team/accept?token=${encodeURIComponent(
      inviteToken
    )}`;

    // Send invite email via Resend
    await resend.emails.send({
      from: 'RentZentro <support@rentzentro.com>',
      to: teammateEmail,
      subject: `${displayLandlordName} added you to RentZentro`,
      html: `
        <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size:14px; color:#0f172a;">
          <p>Hi ${displayTeammateName},</p>
          <p><strong>${displayLandlordName}</strong> has added you as a team member in RentZentro so you can help manage properties, tenants, and payments.</p>
          <p>To finish setting up your account, click the button below:</p>
          <p style="margin:20px 0;">
            <a href="${inviteUrl}"
               style="background-color:#10b981;color:#020617;text-decoration:none;padding:10px 18px;border-radius:999px;display:inline-block;font-weight:600;">
              Accept team invite
            </a>
          </p>
          <p>If the button doesn’t work, copy and paste this link into your browser:</p>
          <p style="word-break:break-all;"><a href="${inviteUrl}">${inviteUrl}</a></p>
          <p style="margin-top:24px;">If you weren’t expecting this, you can safely ignore this email.</p>
          <p style="margin-top:16px;color:#64748b;">— RentZentro</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Unexpected error in team-invite route:', err);
    return NextResponse.json(
      { error: err?.message || 'Unexpected error sending team invite.' },
      { status: 500 }
    );
  }
}
