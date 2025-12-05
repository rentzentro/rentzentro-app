// app/team/accept/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type TeamInviteRow = {
  id: number;
  landlord_id: number;
  email: string;
  name: string | null;
  role: string | null;
  invite_token: string | null;
  accepted_at: string | null;
};

export default function TeamAcceptPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<TeamInviteRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setError(
        'This team invite link is missing a token. Please ask your landlord to resend the invite.'
      );
      setLoading(false);
      return;
    }

    const loadInvite = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select(
            'id, landlord_id, email, name, role, invite_token, accepted_at'
          )
          .eq('invite_token', token)
          .maybeSingle();

        if (error) {
          console.error('Error loading team invite:', error);
          throw new Error('Unable to load this team invite.');
        }

        if (!data) {
          throw new Error(
            'This team invite could not be found. It may have been revoked or already used.'
          );
        }

        if (data.accepted_at) {
          throw new Error(
            'This team invite has already been used. Try signing in with this email on the landlord login page.'
          );
        }

        setInvite(data as TeamInviteRow);
      } catch (err: any) {
        setError(err?.message || 'Failed to load team invite.');
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;

    setError(null);

    if (!password || password.length < 8) {
      setError('Please choose a password at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      // Create auth user for this teammate
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: invite.email,
          password,
        });

      if (signUpError) {
        console.error('Team signup error:', signUpError);
        throw new Error(
          signUpError.message ||
            'Could not create your account. If you already signed up, try logging in instead.'
        );
      }

      const user = signUpData.user;
      if (!user) {
        throw new Error(
          'Account created, but we could not complete the link. Please try logging in, or ask your landlord to resend the invite.'
        );
      }

      // Link this auth user to the team_members row
      const { error: updateError } = await supabase
        .from('team_members')
        .update({
          user_id: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      if (updateError) {
        console.error('Error updating team_members after signup:', updateError);
        throw new Error(
          'Your account was created, but we could not finish connecting it. Please contact your landlord or RentZentro support.'
        );
      }

      // Send them to the landlord dashboard (as a team member)
      router.push('/landlord');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong creating your account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Loading your team invite…
        </p>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'This team invite is not valid. Please ask your landlord to resend it.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-md rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
        <div>
          <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wide">
            RentZentro team invite
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-50">
            Create your team login
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            You&apos;ve been invited to help manage properties and tenants in
            RentZentro with the email:
          </p>
          <p className="mt-1 text-xs font-medium text-slate-100">
            {invite.email}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="block text-slate-300">
              Password (at least 8 characters)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-slate-300">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating your account…' : 'Create account & continue'}
          </button>
        </form>

        <p className="mt-2 text-[11px] text-slate-500">
          Already created a password with this email? Try signing in from the
          landlord login page instead.
        </p>
      </div>
    </main>
  );
}
