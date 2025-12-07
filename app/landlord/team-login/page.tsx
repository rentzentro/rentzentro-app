'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type TeamMemberRow = {
  id: string;
  owner_user_id: string;
  member_user_id: string | null;
  member_email: string;
  invite_email: string;
  role: string | null;
  status: string | null;
  accepted_at: string | null;
};

export default function LandlordTeamLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    searchParams.get('redirect') || '/landlord/team';

  // If a user is already logged in *and* is on a team, send them straight in
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          setCheckingSession(false);
          return;
        }

        const user = authData.user;

        const { data: teamRows, error: teamError } =
          await supabase
            .from('landlord_team_members')
            .select(
              'id, owner_user_id, member_user_id, member_email, invite_email, role, status, accepted_at'
            )
            .eq('member_user_id', user.id)
            .eq('status', 'active');

        if (teamError) {
          console.error('Error checking existing team membership:', teamError);
          setCheckingSession(false);
          return;
        }

        if (teamRows && teamRows.length > 0) {
          router.replace(redirectTo);
          return;
        }

        // Logged in but not on a team → let them see an error when they try login
        setCheckingSession(false);
      } catch (err) {
        console.error('Error during session check:', err);
        setCheckingSession(false);
      }
    };

    checkExistingSession();
  }, [router, redirectTo]);

  const goHome = () => {
    router.push('/');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);

    try {
      // 1) Sign in with Supabase
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        });

      if (signInError || !signInData.user) {
        throw new Error(
          signInError?.message ||
            'Invalid login. Please double-check your email and password.'
        );
      }

      const user = signInData.user;

      // 2) Confirm this user is an active team member
      const { data: teamRows, error: teamError } =
        await supabase
          .from('landlord_team_members')
          .select(
            'id, owner_user_id, member_user_id, member_email, invite_email, role, status, accepted_at'
          )
          .eq('member_user_id', user.id)
          .eq('status', 'active');

      if (teamError) {
        console.error('Error loading team membership:', teamError);
        throw new Error(
          'Unable to confirm team access right now. Please try again.'
        );
      }

      if (!teamRows || teamRows.length === 0) {
        throw new Error(
          'This account is not linked to a RentZentro team. Make sure you accepted an invite with this email.'
        );
      }

      // 3) All good → route to team dashboard
      router.replace(redirectTo);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong signing you in. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Checking your RentZentro team access…
        </p>
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
          <h1 className="mt-1 text-xl font-semibold text-slate-50">
            Team member login
          </h1>
          <p className="text-sm text-slate-400">
            Sign in with the email that received your RentZentro team invite.
          </p>
        </header>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="block text-slate-300">
                Email used for your invite
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
                placeholder="The password you created when accepting the invite"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing you in…' : 'Sign in to your team'}
            </button>
          </form>

          <p className="text-[11px] text-slate-500">
            First time here? Open the invite email from RentZentro and click the
            acceptance link to create your login. After that, you can always
            come back here to sign in.
          </p>
        </section>
      </div>
    </main>
  );
}
