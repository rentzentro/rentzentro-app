'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;
  user_id: string | null;
};

type TeamMemberRow = {
  id: number;
  owner_user_id: string;
  member_user_id: string | null;
  member_email: string;
  invite_email: string;
  role: string | null;
  status: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
};

// ---------- Helpers ----------

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// ---------- Component ----------

export default function LandlordTeamAccessPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('manager');
  const [savingInvite, setSavingInvite] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // for revoke / cancel actions
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // ---------- Load landlord + current team ----------

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
        const email = user.email!;

        // 1) Landlord by user_id
        let { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, email, name, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord by user_id:', landlordError);
          throw new Error('Unable to load landlord account.');
        }

        // 2) Fallback by email (older rows)
        if (!landlordRow) {
          const byEmail = await supabase
            .from('landlords')
            .select('id, email, name, user_id')
            .eq('email', email)
            .maybeSingle();

          if (byEmail.error) {
            console.error('Error loading landlord by email:', byEmail.error);
            throw new Error('Unable to load landlord account.');
          }

          landlordRow = byEmail.data;
        }

        if (!landlordRow) {
          throw new Error('Landlord account not found.');
        }

        const landlordTyped = landlordRow as LandlordRow;
        setLandlord(landlordTyped);

        const ownerUuid = landlordTyped.user_id || authData.user.id;

        // 3) Load team members for this owner
        const { data: teamRows, error: teamError } = await supabase
          .from('landlord_team_members')
          .select(
            'id, owner_user_id, member_user_id, member_email, invite_email, role, status, invited_at, accepted_at, created_at'
          )
          .eq('owner_user_id', ownerUuid)
          .order('created_at', { ascending: true });

        if (teamError) {
          console.error('Error loading team rows:', teamError);
          throw new Error('Unable to load team member list.');
        }

        setTeamMembers((teamRows || []) as TeamMemberRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load RentZentro team access. Please try again.'
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
    if (!landlord) return;

    const trimmedEmail = inviteEmail.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter an email address to invite.');
      setSuccess(null);
      return;
    }

    setSavingInvite(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Not signed in.');
      }

      const ownerUuid = landlord.user_id || authData.user.id;

      // 1) Save invite in landlord_team_members.
      //    member_email is required, so for pending we mirror invite_email.
      const { data: insertRow, error: insertError } = await supabase
        .from('landlord_team_members')
        .insert({
          owner_user_id: ownerUuid,
          member_user_id: null,
          member_email: trimmedEmail,
          invite_email: trimmedEmail,
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
        throw new Error(insertError.message || 'Failed to save invite.');
      }

      const newInvite = insertRow as TeamMemberRow;

      // Update local list
      setTeamMembers((prev) => [...prev, newInvite]);
      setInviteEmail('');

      // 2) Try to send email via API.
      let emailSent = false;
      const payload = {
        inviteId: newInvite.id,
        inviteEmail: trimmedEmail,
        role: inviteRole,
        ownerEmail: landlord.email,
        ownerName: landlord.name ?? landlord.email,
      };

      try {
        // Preferred path
        const res1 = await fetch('/api/landlord-team-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res1.ok) {
          emailSent = true;
        } else {
          // Fallback path
          const res2 = await fetch('/api/landlord/team-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res2.ok) {
            emailSent = true;
          }
        }
      } catch (apiErr) {
        console.error('Error calling invite email API:', apiErr);
      }

      if (emailSent) {
        setSuccess(
          `Invite sent to ${trimmedEmail}. They can log in with that email to access your account.`
        );
      } else {
        setSuccess(
          `Invite saved, but there was an issue sending the email. Ask your teammate to sign up or log in as a landlord using ${trimmedEmail}, and RentZentro will automatically link them to your account.`
        );
      }
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong while creating the invite. Please try again.'
      );
    } finally {
      setSavingInvite(false);
    }
  };

  // Revoke access for an active team member
  const handleRevokeAccess = async (memberId: number) => {
    if (!landlord) return;
    const confirmRevoke = window.confirm(
      'Remove this team member’s access? They will no longer be able to view your account.'
    );
    if (!confirmRevoke) return;

    setUpdatingId(memberId);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('landlord_team_members')
        .update({ status: 'removed' })
        .eq('id', memberId);

      if (updateError) {
        console.error('Error revoking team member:', updateError);
        throw new Error('Failed to revoke access. Please try again.');
      }

      // Update local list
      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, status: 'removed' } : m
        )
      );

      setSuccess('Team member access revoked.');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong while revoking access. Please try again.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Cancel a pending invite
  const handleCancelInvite = async (memberId: number) => {
    if (!landlord) return;
    const confirmCancel = window.confirm(
      'Cancel this invite? The link in their email will no longer work.'
    );
    if (!confirmCancel) return;

    setUpdatingId(memberId);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await supabase
        .from('landlord_team_members')
        .update({ status: 'removed' })
        .eq('id', memberId);

      if (updateError) {
        console.error('Error cancelling invite:', updateError);
        throw new Error('Failed to cancel invite. Please try again.');
      }

      setTeamMembers((prev) =>
        prev.map((m) =>
          m.id === memberId ? { ...m, status: 'removed' } : m
        )
      );

      setSuccess('Invite cancelled.');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong while cancelling the invite. Please try again.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const activeMembers = teamMembers.filter(
    (m) => (m.status || '').toLowerCase() === 'active'
  );
  const pendingInvites = teamMembers.filter(
    (m) => (m.status || '').toLowerCase() === 'pending'
  );

  // ---------- UI ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading team access…</p>
      </main>
    );
  }

  if (!landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not find a landlord profile for this account. Please contact support.'}
          </p>
          <button
            onClick={handleSignOut}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header / breadcrumb */}
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
              Signed in as{' '}
              <span className="font-medium text-slate-200">
                {landlord.name || 'RentZentro'} · {landlord.email}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link
              href="/landlord"
              className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-4 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Alerts */}
        {(error || success) && (
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
                They’ll see your properties and tenants when they log in with
                this email.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleInvite}
            className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_auto] text-xs"
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
              <p className="text-[11px] text-slate-500">
                After you create an invite, ask your teammate to sign up or sign
                in as a landlord using the same email. When they log in,
                RentZentro will automatically link them to your account.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-300">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="manager">Manager — full access</option>
                <option value="viewer">Viewer — read-only</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={savingInvite}
                className="w-full md:w-auto rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingInvite ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </form>
        </section>

        {/* Active team members */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Active team members
            </p>
            <p className="mt-1 text-sm text-slate-200">
              People who can currently access your landlord account.
            </p>
          </div>

          {activeMembers.length === 0 ? (
            <p className="text-xs text-slate-500">
              You don&apos;t have any active team members yet.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {activeMembers.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-slate-50">
                      {m.member_email}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Role:{' '}
                      <span className="text-slate-200">
                        {m.role === 'viewer'
                          ? 'Viewer — read-only'
                          : 'Manager — full access'}
                      </span>
                    </p>
                    {m.accepted_at && (
                      <p className="text-[11px] text-slate-500">
                        Joined {formatDate(m.accepted_at)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-emerald-300">
                      Active
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRevokeAccess(m.id)}
                      disabled={updatingId === m.id}
                      className="text-[11px] px-3 py-1 rounded-full border border-rose-500/70 text-rose-200 bg-rose-950/30 hover:bg-rose-900/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {updatingId === m.id ? 'Revoking…' : 'Revoke access'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending invites */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Pending invites
            </p>
            <p className="mt-1 text-sm text-slate-200">
              People you&apos;ve invited who haven&apos;t logged in yet.
            </p>
          </div>

          {pendingInvites.length === 0 ? (
            <p className="text-xs text-slate-500">
              You don&apos;t have any pending invites.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {pendingInvites.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-slate-50">
                      {m.invite_email}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Role:{' '}
                      <span className="text-slate-200">
                        {m.role === 'viewer'
                          ? 'Viewer — read-only'
                          : 'Manager — full access'}
                      </span>
                    </p>
                    {m.invited_at && (
                      <p className="text-[11px] text-slate-500">
                        Invited {formatDate(m.invited_at)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] text-amber-300">
                      Waiting to log in
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCancelInvite(m.id)}
                      disabled={updatingId === m.id}
                      className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {updatingId === m.id ? 'Cancelling…' : 'Cancel invite'}
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
