// app/lib/getOwnerContext.ts
import { SupabaseClient } from '@supabase/supabase-js';

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  user_id: string | null;
};

export type OwnerContext =
  | {
      mode: 'landlord';
      ownerUserId: string;
      landlord: LandlordRow;
    }
  | {
      mode: 'team';
      ownerUserId: string;
      landlord: LandlordRow;
      teamMemberId: number;
    };

export async function getOwnerContext(
  supabase: SupabaseClient
): Promise<OwnerContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error('Not authenticated.');
  }

  const user = authData.user;
  const email = user.email ?? '';
  const authUserId = user.id;

  // 1) Try: this user IS the landlord
  let { data: landlordRow, error: landlordError } = await supabase
    .from('landlords')
    .select('id, email, name, user_id')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (landlordError) {
    console.error('getOwnerContext landlord by user_id error:', landlordError);
    throw new Error('Unable to load landlord account.');
  }

  if (!landlordRow && email) {
    // Fallback by email for older landlord rows
    const byEmail = await supabase
      .from('landlords')
      .select('id, email, name, user_id')
      .eq('email', email)
      .maybeSingle();

    if (byEmail.error) {
      console.error('getOwnerContext landlord by email error:', byEmail.error);
      throw new Error('Unable to load landlord account.');
    }

    landlordRow = byEmail.data as LandlordRow | null;
  }

  if (landlordRow && landlordRow.user_id) {
    return {
      mode: 'landlord',
      ownerUserId: landlordRow.user_id,
      landlord: landlordRow as LandlordRow,
    };
  }

  // 2) Otherwise, see if they are a TEAM MEMBER
  const { data: teamRow, error: teamError } = await supabase
    .from('landlord_team_members')
    .select(
      'id, owner_user_id, invite_email, member_user_id, status, accepted_at'
    )
    .or(
      `member_user_id.eq.${authUserId}${
        email ? `,invite_email.eq.${email}` : ''
      }`
    )
    .neq('status', 'removed')
    .maybeSingle();

  if (teamError) {
    console.error('getOwnerContext team error:', teamError);
    throw new Error('Unable to load team membership.');
  }

  if (!teamRow) {
    throw new Error(
      'Landlord account not found. You are not a landlord or accepted team member.'
    );
  }

  // Auto-link member_user_id + accepted_at on first login
  if (!teamRow.member_user_id) {
    const { data: updated, error: linkError } = await supabase
      .from('landlord_team_members')
      .update({
        member_user_id: authUserId,
        accepted_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', teamRow.id)
      .select('id, owner_user_id')
      .maybeSingle();

    if (linkError) {
      console.error('getOwnerContext auto-link error:', linkError);
    } else if (updated) {
      (teamRow as any).member_user_id = authUserId;
      (teamRow as any).status = 'active';
    }
  }

  const ownerUserId = teamRow.owner_user_id as string;

  const { data: ownerLandlord, error: ownerError } = await supabase
    .from('landlords')
    .select('id, email, name, user_id')
    .eq('user_id', ownerUserId)
    .maybeSingle();

  if (ownerError || !ownerLandlord) {
    console.error('getOwnerContext owner landlord error:', ownerError);
    throw new Error(
      'Could not load the landlord account you are a team member of.'
    );
  }

  return {
    mode: 'team',
    ownerUserId,
    landlord: ownerLandlord as LandlordRow,
    teamMemberId: teamRow.id as number,
  };
}
