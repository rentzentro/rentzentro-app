'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!password || !confirm) {
      setError('Please enter and confirm your new password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password should be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      setMessage('Your password has been updated successfully.');
      setTimeout(() => {
        router.push('/'); // send them to homepage; they can log in again
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Unexpected error updating your password. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-50 mb-1">
          Update your password
        </h1>
        <p className="text-xs text-slate-400 mb-4">
          Enter a new password for your RentZentro account.
        </p>

        {error && (
          <div className="mb-3 rounded-xl bg-rose-950/40 border border-rose-500/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 px-3 py-2 text-xs text-emerald-100">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Save new password'}
          </button>
        </form>

        <p className="mt-3 text-[11px] text-slate-500">
          This page is used after you click the password reset link from your
          email.
        </p>
      </div>
    </div>
  );
}
