'use client';

import { useState } from 'react';

export default function RentRemindersTestPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runJob = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/rent-reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // if your route expects a body, put it here – right now we send empty
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        setResult(
          `Error ${res.status}: ${data?.error || 'Unexpected error from API'}`
        );
        return;
      }

      setResult(
        data?.message
          ? `Success: ${data.message}`
          : 'Success: rent-reminders job ran without error.'
      );
    } catch (err: any) {
      console.error(err);
      setResult(err?.message || 'Network or unexpected error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl space-y-4">
        <h1 className="text-lg font-semibold text-slate-50">
          Rent reminder job test
        </h1>
        <p className="text-xs text-slate-400">
          Click the button below to call <code>/api/rent-reminders</code> with a
          POST request and see the result.
        </p>

        <button
          type="button"
          onClick={runJob}
          disabled={loading}
          className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Running job…' : 'Run rent reminder job now'}
        </button>

        {result && (
          <div className="mt-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-xs text-slate-200">
            {result}
          </div>
        )}
      </div>
    </main>
  );
}
