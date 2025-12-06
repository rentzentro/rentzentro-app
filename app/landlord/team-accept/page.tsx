'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type InviteStatus = 'checking' | 'ready' | 'linking' | 'done' | 'error';

type TeamInviteRow = {
  id: number;
  owner_user_id: string;
  member_user_id: string | null;
  invite_email: string;
  member_email: string;
  status: string | null;
};

export default function LandlordTeamAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inviteId, setInviteId] = useState<number | null>(null);
  const [invite, setInvite] = useState<TeamInviteRow | null>(null);

  const [status, setStatus] = useState<InviteStatus>('checking');
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  // ---------- Load invite from URL ----------

  useEffect(() => {
    const idParam = searchParams.get('invite');
    if (!idParam) {
      setError('This team invite link is missing an invite ID.');
      setStatus('error');
      return;
    }

    const numericId = Number(idParam);
    if (!Number.isFinite(numericId)) {
      setError('This team invite link is invalid.');
      setStatus('error');
      return;
    }

    setInviteId(numericId);

    const loadInvite = async () => {
      try {
        const { data, error: inviteError } = await supabase
          .from('landlord_team_members')
          .select(
            'id, owner_user_id, member_user_id, invite_email, member_email, status'
          )
          .eq('id', numericId)
          .maybeSingle();

        if (inviteError || !data) {
          console.error('Error loading invite row:', inviteError);
          setError('This invite could not be found. It may have been revoked.');
          setStatus('error');
          return;
        }

        const row = data as TeamInviteRow;

        const st = (row.status || '').toLowerCase();
        if (st === 'removed') {
          setError('This team invite has been revoked by the owner.');
          setStatus('error');
          return;
        }

        setInvite(row);
        setEmail((row.invite_email || row.member_email || '').toLowerCase());
        setStatus('ready');
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'There was a problem loading this invite. Please try the link again.'
        );
        setStatus('error');
      }
    };

    loadInvite();
  }, [searchParams]);

  // ---------- Core linking logic (NO landlord lookup) ----------

  const linkInviteAndRedirect = async (row: TeamInviteRow) => {
    setStatus('linking');
    setError(null);

    // 1) Get current auth user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error('Auth error while accepting invite:', authError);
      throw new Error('Please log in again and then reopen this invite link.');
    }

    const user = authData.user;
    const userEmail = (user.email || '').toLowerCase();
    const inviteEmail = (row.invite_email || row.member_email || '').toLowerCase();

    if (!userEmail || inviteEmail !== userEmail) {
      throw new Error(
        'This invite was sent to a different email. Please log in using the email that received the invite.'
      );
    }

    // 2) Attach member_user_id + accepted_at + status = active
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('landlord_team_members')
      .update({
        member_user_id: user.id,
        member_email: userEmail,
        accepted_at: nowIso,
        status: 'active',
      })
      .eq('id', row.id);

    if (updateError) {
      console.error('Error updating invite row:', updateError);
      throw new Error(
        'Failed to attach this invite to your account. Please try again.'
      );
    }

    // 3) We’re done — don’t try to read the owner landlord (RLS blocks that).
    setStatus('done');
    router.push('/landlord');
  };

  // ---------- Auto-accept if already logged in ----------

  useEffect(() => {
    const tryAuto = async () => {
      if (!invite || autoTried || status !== 'ready') return;
      setAutoTried(true);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return; // not logged in → show form

        await linkInviteAndRedirect(invite);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to accept this invite.');
        setStatus('error');
      }
    };

    tryAuto();
  }, [invite, autoTried, status]);

  // ---------- Login / signup + accept ----------

  const handleAuthAndAccept = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteId || !invite) return;

    setSubmitting(true);
    setError(null);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password;

      if (!trimmedEmail || !trimmedPassword) {
        throw new Error('Please enter both email and password.');
        }

      // 1) Try sign-in first
      const signInRes = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInRes.error) {
        const msg = signInRes.error.message.toLowerCase();

        // If it's "invalid credentials", create account instead
        if (msg.includes('invalid login credentials') || msg.includes('invalid login')) {
          const signUpRes = await supabase.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword,
          });
          if (signUpRes.error) {
            throw signUpRes.error;
          }
        } else {
          throw signInRes.error;
        }
      }

      // 2) Now that we're authenticated, link invite → team member
      await linkInviteAndRedirect(invite);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong signing you in. Please double-check your email and password.'
      );
      setStatus('ready');
    } finally {
      setSubmitting(false);
    }
  };

  const goHome = () => {
    router.push('/');
  };

  // ---------- UI ----------

  if (status === 'checking') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading team invite…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        {/* Header */}
        <header className="space-y-1">
          <button
            type="button"
            onClick={goHome}
            className="text-[11px] text-slate-500 hover:text-emerald-300"
          >
            ← Back to RentZentro
          </button>
          <h1 className="text-xl font-semibold text-slate-50 mt-1">
            Accept team invite
          </h1>
          <p className="text-sm text-slate-400">
            You&apos;ve been invited to help manage rentals in RentZentro. Create a
            login or sign in with the email that received this invite.
          </p>
        </header>

        {/* Error / success banner */}
        {(error || status === 'done') && (
          <div
            className={`rounded-2xl border px-4 py-2 text-sm ${
              status === 'done'
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/60 bg-red-500/10 text-red-200'
            }`}
          >
            {status === 'done'
              ? 'Invite accepted! Redirecting you to the landlord portal…'
              : error}
          </div>
        )}

        {/* Auth + accept form (hide once done) */}
        {status !== 'done' && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Step 1: Sign in or create login
              </p>
              <p className="mt-1 text-sm text-slate-200">
                Use the <span className="font-semibold">same email</span> this
                invite was sent to. We&apos;ll automatically link your account to
                this team.
              </p>
            </div>

            <form onSubmit={handleAuthAndAccept} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-300">
                  Email used for this invite
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-300">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Create a password or use your existing one"
                  autoComplete="current-password"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  If you already have a RentZentro login with this email, we&apos;ll
                  sign you in. Otherwise, we&apos;ll create a new login for you.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || !inviteId || !invite}
                className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Connecting your account…' : 'Continue & accept invite'}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
