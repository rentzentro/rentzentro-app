'use client';

import { useState } from 'react';

export default function StripeTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 50, // $50 test payment
          description: 'Test rent payment',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create checkout session.');
      }

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Redirect to Stripe Checkout
      } else {
        throw new Error('No checkout URL returned from server.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong starting payment.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
        <h1 className="text-lg font-semibold">Stripe test payment</h1>
        <p className="text-sm text-slate-400">
          This will open a Stripe Checkout page in <span className="font-semibold">test mode</span> for a
          <span className="font-semibold text-emerald-300"> $50</span> payment.
        </p>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-500/40 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? 'Redirecting to Stripe…' : 'Pay $50 in test mode'}
        </button>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          On the Stripe page, use test card{' '}
          <code className="bg-slate-800 px-1 py-[1px] rounded">
            4242 4242 4242 4242
          </code>
          , any future expiry date, any CVC, and any ZIP.
        </p>
      </div>
    </main>
  );
}
