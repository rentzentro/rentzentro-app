'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PayoutSettingsPage() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectStripe = async () => {
    setConnecting(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/connect-link', {
        method: 'POST',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message =
          data.error ||
          'Failed to create Stripe onboarding link. Check server logs.';
        throw new Error(message);
      }

      if (data.url) {
        window.location.href = data.url as string;
        return;
      }

      throw new Error('No onboarding URL returned from server.');
    } catch (err: any) {
      console.error('Error starting Stripe onboarding:', err);
      setError(err.message || 'Something went wrong starting onboarding.');
      setConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white px-4 py-10 flex flex-col items-center">
      {/* Back Button */}
      <div className="w-full max-w-4xl mb-6">
        <button
          onClick={() => window.history.back()}
          className="text-sm px-4 py-2 rounded-full border border-gray-600 hover:bg-gray-700 transition"
        >
          ← Back
        </button>
      </div>

      <div className="w-full max-w-4xl bg-[#0f172a] rounded-xl p-8 shadow-xl border border-gray-700">
        <h1 className="text-3xl font-bold mb-4">Payouts via Stripe</h1>

        <p className="text-gray-300 mb-6">
          Connect your Stripe account so rent payments can be paid out directly
          to your bank. Stripe handles bank details, identity checks, and
          payouts.
        </p>

        {/* Error box */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          onClick={handleConnectStripe}
          disabled={connecting}
          className={`px-6 py-3 rounded-lg text-lg font-semibold transition ${
            connecting
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-emerald-500 hover:bg-emerald-600'
          }`}
        >
          {connecting ? 'Starting…' : 'Connect payouts with Stripe'}
        </button>

        <p className="text-gray-500 text-xs mt-6">
          Note: This page currently assumes a single landlord record with ID 1.
          As you add multiple landlords, this will be extended to use each
          landlord’s own Stripe account.
        </p>
      </div>
    </div>
  );
}
