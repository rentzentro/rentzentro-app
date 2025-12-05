'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type LandlordRow = {
  id: number;
  email: string;
  user_id: string | null;
};

type TeamMemberRow = {
  id: number;
  owner_user_id: string;
  member_user_id: string | null;
  member_email: string | null;
  invite_email: string | null;
  role: string | null;
  status: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
};

// ---------- Helpers ----------

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

// ---------- Component ----------

export default function LandlordTeamPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);

  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('manager');
  const [sendingInvite, setSendingInvite] = useState(false);

  // Updating members
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // ---------- Load landlord + team ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user?.email) {
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;

        // Only the main landlord account should manage team members
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, email, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord for team page:', landlordError);
          throw new Error('Unable to load landlord account.');
        }

        if (!landlordRow) {
          throw new Error(
            'Only the main landlord account can manage team members.'
          );
        }

        const ownerUuid = (landlordRow.user_id as string | null) ?? user.id;

        setLandlord(landlordRow as LandlordRow);
        setOwnerUserId(ownerUuid);

        // Load team members for this owner
        const { data: teamRows, error: teamError } = await supabase
          .from('landlord_team_members')
          .select(
            'id, owner_user_id, member_user_id, member_email, invite_email, role, status, invited_at, accepted_at, created_at'
          )
          .eq('owner_user_id', ownerUuid)
          .order('created_at', { ascending: true });

        if (teamError) {
          console.error('Error loading team members:', teamError);
          throw new Error('Unable to load team members.');
        }

        setTeamMembers((teamRows || []) as TeamMemberRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load your team settings. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // ---------- Actions ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!ownerUserId) return;

    setSendingInvite(true);
    setError(null);
    setSuccess(null);

    try {
      const email = inviteEmail.trim().toLowerCase();
      if (!email) throw new Error('Invite email is required.');

      // Prevent duplicate active / pending invites for same email
      const existing = teamMembers.find(
        (m) =>
          (m.invite_email?.toLowerCase() === email ||
            m.member_email?.toLowerCase() === email) &&
          m.status !== 'removed'
      );
      if (existing) {
        throw new Error(
          'This email is already on your team or has a pending invite.'
        );
      }

      const { data, error: insertError } = await supabase
        .from('landlord_team_members')
        .insert({
          owner_user_id: ownerUserId,
          member_user_id: null,
          member_email: null,
          invite_email: email,
          role: inviteRole,
          status: 'pending',
          invited_at: new Date().toISOString(),
        })
        .select(
          'id, owner_user_id, member_user_id, member_email, invite_email, role, status, invited_at, accepted_at, created_at'
        )
        .single();

      if (insertError) {
        console.error('Error inserting team invite:', insertError);
        throw new Error(insertError.message || 'Failed to send invite.');
      }

      setTeamMembers((prev) => [...prev, data as TeamMemberRow]);
      setInviteEmail('');
      setInviteRole('manager');

      // NOTE: Email sending can be added later via an API route.
      setSuccess(
        'Team invite created. Ask your teammate to sign up or sign in with this email to access your account.'
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to send team invite.');
    } finally {
      setSendingInvite(false);
    }
  };

  const updateMember = async (
    id: number,
    updates: Partial<Pick<TeamMemberRow, 'role' | 'status'>>
  ) => {
    setUpdatingId(id);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: updateError } = await supabase
        .from('landlord_team_members')
        .update(updates)
        .eq('id', id)
        .select(
          'id, owner_user_id, member_user_id, member_email, invite_email, role, status, invited_at, accepted_at, created_at'
        )
        .single();

      if (updateError) {
        console.error('Error updating team member:', updateError);
        throw new Error(updateError.message || 'Failed to update team member.');
      }

      setTeamMembers((prev) =>
        prev.map((m) => (m.id === id ? (data as TeamMemberRow) : m))
      );

      if (updates.status === 'removed') {
        setSuccess('Team member removed.');
      } else if (updates.role) {
        setSuccess('Team member role updated.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update team member.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleChangeRole = (id: number, newRole: string) => {
    updateMember(id, { role: newRole });
  };

  const handleRemove = (id: number) => {
    if (
      !window.confirm(
        'Remove this team member? They will no longer be able to access your account.'
      )
    ) {
      return;
    }
    updateMember(id, { status: 'removed' });
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading team settings…</p>
      </main>
    );
  }

  if (!landlord || !ownerUserId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not find a landlord profile for this account. Team settings are only available to the main landlord.'}
          </p>
          <button
            onClick={() => router.push('/landlord/login')}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  const activeMembers = teamMembers.filter((m) => m.status === 'active');
  const pendingMembers = teamMembers.filter((m) => m.status === 'pending');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Header */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Team access</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              RentZentro team access
            </h1>
            <p className="text-[13px] text-slate-400">
              Invite teammates to help manage properties, tenants, and
              maintenance while keeping your account secure.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Signed in as <span className="text-slate-200">{landlord.email}</span>.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => router.push('/landlord')}
              className="w-full sm:w-auto rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800 text-center"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full sm:w-auto rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-100 hover:bg-slate-800 text-center"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Alerts */}
        {(success || error) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              success
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/60 bg-red-500/10 text-red-200'
            }`}
          >
            {success || error}
          </div>
        )}

        {/* Invite form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Invite a teammate
              </p>
              <p className="mt-1 text-sm text-slate-200">
                Send an invite to someone who helps you manage rent collection.
                They&apos;ll see your properties and tenants when they log in
                with this email.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleInvite}
            className="grid gap-3 md:grid-cols-[2fr_minmax(0,1fr)_auto] text-xs"
          >
            <div className="space-y-1">
              <label className="block text-slate-300">
                Teammate email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="name@example.com"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300">Role</label>
              <select
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as 'manager' | 'viewer')
                }
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="manager">Manager – full access</option>
                <option value="viewer">Viewer – read only</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={sendingInvite}
                className="w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendingInvite ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>

          <p className="text-[11px] text-slate-500">
            After you create an invite, ask your teammate to sign up or sign in
            as a landlord using the same email. When they log in, RentZentro
            will automatically link them to your account.
          </p>
        </section>

        {/* Active members */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Active team members
              </p>
              <p className="mt-1 text-sm text-slate-200">
                People who can currently access your landlord account.
              </p>
            </div>
          </div>

          {activeMembers.length === 0 ? (
            <p className="text-xs text-slate-500 mt-2">
              You don&apos;t have any active team members yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              {activeMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-50 truncate">
                      {m.member_email || m.invite_email || 'Unknown member'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Role:{' '}
                      <span className="text-slate-100">
                        {m.role || 'manager'}
                      </span>
                    </p>
                    {m.accepted_at && (
                      <p className="text-[11px] text-slate-500">
                        Joined {formatDateTime(m.accepted_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <select
                      value={m.role || 'manager'}
                      onChange={(e) => handleChangeRole(m.id, e.target.value)}
                      disabled={updatingId === m.id}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="manager">Manager – full access</option>
                      <option value="viewer">Viewer – read only</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      disabled={updatingId === m.id}
                      className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-100 hover:bg-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {updatingId === m.id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending invites */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Pending invites
              </p>
              <p className="mt-1 text-sm text-slate-200">
                People you&apos;ve invited who haven&apos;t logged in yet.
              </p>
            </div>
          </div>

          {pendingMembers.length === 0 ? (
            <p className="text-xs text-slate-500 mt-2">
              You don&apos;t have any pending invites.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              {pendingMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-50 truncate">
                      {m.invite_email || m.member_email || 'Unknown'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Role:{' '}
                      <span className="text-slate-100">
                        {m.role || 'manager'}
                      </span>
                    </p>
                    {m.invited_at && (
                      <p className="text-[11px] text-slate-500">
                        Invited {formatDateTime(m.invited_at)}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1">
                      Ask them to sign up or sign in as a landlord with this
                      email. Their account will link automatically.
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      disabled={updatingId === m.id}
                      className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {updatingId === m.id ? 'Updating…' : 'Cancel invite'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
