'use client';

import { useEffect, useState, type FormEvent } from 'react';
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
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string | null;
  member_email: string | null;
  invite_email: string | null;
  role: string | null; // 'manager' | 'viewer'
  status: string | null; // 'pending' | 'active' | 'removed'
};

// ---------- Component ----------

export default function LandlordTeamPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'viewer'>('manager');
  const [savingInvite, setSavingInvite] = useState(false);

  // ---------- Load landlord + team ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        // 1) Auth user
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user?.email) {
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;

        // 2) Landlord row with user_id
        let { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, email, name, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord by user_id:', landlordError);
          throw new Error('Unable to load landlord account.');
        }

        if (!landlordRow) {
          // Fallback by email (older rows)
          const byEmail = await supabase
            .from('landlords')
            .select('id, email, name, user_id')
            .eq('email', user.email)
            .maybeSingle();

          if (byEmail.error) {
            console.error('Error loading landlord by email:', byEmail.error);
            throw new Error('Unable to load landlord account.');
          }

          landlordRow = byEmail.data;
        }

        if (!landlordRow || !landlordRow.user_id) {
          throw new Error(
            'Landlord account not found or missing user ID. Please contact support.'
          );
        }

        const landlordTyped = landlordRow as LandlordRow;
        setLandlord(landlordTyped);

        // 3) Team members for this landlord
        const ownerUuid = landlordTyped.user_id;
        const { data: tmRows, error: tmError } = await supabase
          .from('landlord_team_members')
          .select(
            'id, owner_user_id, member_user_id, invited_at, accepted_at, created_at, member_email, invite_email, role, status'
          )
          .eq('owner_user_id', ownerUuid)
          .order('created_at', { ascending: false });

        if (tmError) {
          console.error('Error loading team members:', tmError);
          throw new Error('Failed to load team members.');
        }

        setTeamMembers((tmRows || []) as TeamMemberRow[]);
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

  const activeMembers = teamMembers.filter(
    (t) => (t.status || '').toLowerCase() === 'active'
  );
  const pendingInvites = teamMembers.filter(
    (t) => (t.status || '').toLowerCase() === 'pending'
  );

  // ---------- Actions ----------

  const handleBack = () => {
    router.push('/landlord');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const handleInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!landlord || !landlord.user_id) return;

    setError(null);
    setSuccess(null);
    setSavingInvite(true);

    try {
      const email = inviteEmail.trim();
      if (!email) {
        throw new Error('Teammate email is required.');
      }

      // 1) Insert pending invite in Supabase
      const { data, error: insertError } = await supabase
        .from('landlord_team_members')
        .insert({
          owner_user_id: landlord.user_id,
          invite_email: email,
          role: inviteRole,
          status: 'pending',
        })
        .select(
          'id, owner_user_id, member_user_id, invited_at, accepted_at, created_at, member_email, invite_email, role, status'
        )
        .single();

      if (insertError) {
        console.error('Error inserting team invite:', insertError);
        throw new Error(insertError.message || 'Failed to create team invite.');
      }

      setTeamMembers((prev) => [data as TeamMemberRow, ...prev]);

      // 2) Send email via API route (Resend)
      const res = await fetch('/api/landlord-team-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteEmail: email,
          landlordName: landlord.name || landlord.email,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || json?.error) {
        console.error('Team invite email error:', json);
        setSuccess(
          'Invite saved, but there was an issue sending the email. Ask your teammate to log in with that email, or try again later.'
        );
      } else {
        setSuccess(
          'Team invite sent! Your teammate will get an email with next steps.'
        );
      }

      setInviteEmail('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send team invite.');
    } finally {
      setSavingInvite(false);
    }
  };

  // Optional: revoke pending invite
  const handleRevokeInvite = async (id: number) => {
    if (!confirm('Cancel this invite?')) return;
    setError(null);
    setSuccess(null);

    try {
      const { error: delError } = await supabase
        .from('landlord_team_members')
        .delete()
        .eq('id', id);

      if (delError) {
        console.error('Error revoking invite:', delError);
        throw new Error(delError.message || 'Failed to revoke invite.');
      }

      setTeamMembers((prev) => prev.filter((t) => t.id !== id));
      setSuccess('Invite revoked.');
    } catch (err: any) {
      setError(err?.message || 'Unable to revoke invite.');
    }
  };

  // ---------- Render ----------

  if (loading && !landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Loading RentZentro team access…
        </p>
      </main>
    );
  }

  if (!landlord) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not load your landlord account. Please sign in again.'}
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
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
              Signed in as{' '}
              <span className="font-medium text-slate-200">
                {landlord.name || 'RentZentro'}
              </span>{' '}
              • {landlord.email}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={handleBack}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
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

        {/* Invite card */}
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
            onSubmit={handleInviteSubmit}
            className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] text-xs items-center"
          >
            <div className="space-y-1">
              <label className="block text-slate-300">
                Teammate email<span className="text-red-400"> *</span>
              </label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="name@example.com"
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
                <option value="viewer">
                  Viewer – read-only access (future)
                </option>
              </select>
            </div>

            <div className="mt-5 md:mt-0 flex items-end">
              <button
                type="submit"
                disabled={savingInvite}
                className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {savingInvite ? 'Sending…' : 'Send invite'}
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
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Active team members
          </p>
          <p className="text-sm text-slate-200">
            People who can currently access your landlord account.
          </p>

          {activeMembers.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              You don&apos;t have any active team members yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              {activeMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-slate-50">
                      {m.member_email || m.invite_email}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Role:{' '}
                      <span className="text-slate-200">
                        {m.role || 'manager'}
                      </span>
                    </p>
                    {m.accepted_at && (
                      <p className="text-[11px] text-slate-500">
                        Joined:{' '}
                        {new Date(m.accepted_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pending invites */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Pending invites
          </p>
          <p className="text-sm text-slate-200">
            People you&apos;ve invited who haven&apos;t logged in yet.
          </p>

          {pendingInvites.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              You don&apos;t have any pending invites.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              {pendingInvites.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-slate-50">
                      {m.invite_email}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Role:{' '}
                      <span className="text-slate-200">
                        {m.role || 'manager'}
                      </span>
                    </p>
                    {m.invited_at && (
                      <p className="text-[11px] text-slate-500">
                        Invited:{' '}
                        {new Date(m.invited_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvite(m.id)}
                    className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-100 hover:bg-rose-500/20"
                  >
                    Cancel invite
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
