'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type InviteStatus = 'checking' | 'ready' | 'linking' | 'done' | 'error';

export default function LandlordTeamAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [inviteId, setInviteId] = useState<string | null>(null);
  const [status, setStatus] = useState<InviteStatus>('checking');
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Read invite ID from URL
  useEffect(() => {
    const id = searchParams.get('invite');
    if (!id) {
      setError('This team invite link is missing an invite ID.');
      setStatus('error');
      return;
    }
    setInviteId(id);
    setStatus('ready');
  }, [searchParams]);

  // Core helper: load invite, verify email, attach user_id, mark active, redirect
  const linkInviteAndRedirect = async (idString: string) => {
    setStatus('linking');
    setError(null);

    const inviteIdNumber = Number(idString);
    if (!Number.isFinite(inviteIdNumber)) {
      throw new Error('This invite link is invalid.');
    }

    // 1) Get current auth user
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      console.error('Auth error while accepting invite:', authError);
      throw new Error('Please log in again and then reopen this invite link.');
    }

    const user = authData.user;

    // 2) Load invite row (NOTE: correct column names: invite_email, not email)
    const { data: inviteRow, error: inviteError } = await supabase
      .from('landlord_team_members')
      .select('id, invite_email, status')
      .eq('id', inviteIdNumber)
      .maybeSingle();

    if (inviteError || !inviteRow) {
      console.error('Error loading invite row:', inviteError);
      throw new Error('This invite could not be found. It may have been revoked.');
    }

    if (inviteRow.status && inviteRow.status === 'removed') {
      throw new Error('This invite has been revoked by the account owner.');
    }

    const inviteEmail = (inviteRow.invite_email || '').toLowerCase();
    const userEmail = (user.email || '').toLowerCase();

    if (inviteEmail && inviteEmail !== userEmail) {
      throw new Error(
        'This invite was sent to a different email. Please log in using the email that received the invite.'
      );
    }

    // 3) Attach member_user_id + member_email + accepted_at + status=active
    const { error: updateError } = await supabase
      .from('landlord_team_members')
      .update({
        member_user_id: user.id,
        member_email: user.email,
        accepted_at: new Date().toISOString(),
        status: 'active',
      })
      .eq('id', inviteIdNumber);

    if (updateError) {
      console.error('Error updating invite row:', updateError);
      throw new Error('Failed to attach this invite to your account. Please try again.');
    }

    setStatus('done');

    // 4) Send them into the landlord area (for now main dashboard)
    router.push('/landlord');
  };

  // If they open the link while already logged in, auto-accept
  useEffect(() => {
    const tryAutoLink = async () => {
      if (!inviteId) return;
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          // not logged in → show form
          return;
        }
        await linkInviteAndRedirect(inviteId);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Failed to accept this invite.');
        setStatus('error');
      }
    };

    if (status === 'ready' && inviteId) {
      void tryAutoLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, inviteId]);

  // Unified "login or sign up" handler for team members
  const handleAuthAndAccept = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteId) return;

    setSubmitting(true);
    setError(null);

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password;

      if (!trimmedEmail || !trimmedPassword) {
        throw new Error('Please enter both email and password.');
      }

      // First, try to sign in
      const signInRes = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInRes.error) {
        const msg = signInRes.error.message.toLowerCase();

        // If credentials are wrong / user not found → create account
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

      // At this point, user should be authenticated → link invite to user
      await linkInviteAndRedirect(inviteId);
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

        {/* Error / status */}
        {(error || status === 'done') && (
          <div
            className={`rounded-2xl border px-4 py-2 text-sm ${
              status === 'done'
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/60 bg-red-500/10 text-red-200'
            }`}
          >
            {status === 'done'
              ? 'Invite accepted! Redirecting you to your dashboard…'
              : error}
          </div>
        )}

        {/* Auth + accept form (only if not already auto-accepted) */}
        {status !== 'done' && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Step 1: Sign in or create login
              </p>
              <p className="mt-1 text-sm text-slate-200">
                Use the <span className="font-semibold">same email</span> this invite
                was sent to. We&apos;ll automatically link your account to this team.
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
                disabled={submitting || !inviteId}
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
