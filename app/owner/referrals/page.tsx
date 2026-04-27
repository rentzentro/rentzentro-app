'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const OWNER_API_TOKEN = process.env.NEXT_PUBLIC_OWNER_API_TOKEN || '';

type RewardRow = {
  id: string;
  status: string | null;
  reward_amount_cents: number | null;
  referrer_landlord_id: number;
  referred_landlord_id: number;
  eligible_at: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
};

const formatCurrency = (cents: number | null | undefined) =>
  `$${((Number(cents) || 0) / 100).toFixed(2)}`;

export default function OwnerReferralRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingRewardId, setProcessingRewardId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const pendingCount = useMemo(
    () => rewards.filter((reward) => String(reward.status || '').toLowerCase() === 'pending').length,
    [rewards]
  );

  const loadRewards = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/owner/referrals/rewards?limit=250', {
        cache: 'no-store',
        headers: OWNER_API_TOKEN ? { 'x-owner-api-key': OWNER_API_TOKEN } : undefined,
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load referral rewards.');
      }

      setRewards((data?.rewards || []) as RewardRow[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load referral rewards.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRewards();
  }, []);


  const handleExportApproved = async () => {
    setExporting(true);
    setError(null);

    try {
      const res = await fetch('/api/owner/referrals/rewards/export?status=approved', {
        headers: OWNER_API_TOKEN ? { 'x-owner-api-key': OWNER_API_TOKEN } : undefined,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to export approved rewards.');
      }

      const csv = await res.text();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'referral-rewards-approved.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || 'Failed to export approved rewards.');
    } finally {
      setExporting(false);
    }
  };

  const applyAction = async (rewardId: string, action: 'approve' | 'mark_paid' | 'void') => {
    setProcessingRewardId(rewardId);
    setError(null);

    try {
      const res = await fetch('/api/owner/referrals/rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(OWNER_API_TOKEN ? { 'x-owner-api-key': OWNER_API_TOKEN } : {}),
        },
        body: JSON.stringify({
          rewardId,
          action,
          processedBy: 'owner-dashboard',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update referral reward.');
      }

      await loadRewards();
    } catch (err: any) {
      setError(err?.message || 'Failed to update referral reward.');
    } finally {
      setProcessingRewardId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/owner/dashboard" className="hover:text-emerald-400">
                Owner
              </Link>
              <span>/</span>
              <span className="text-slate-300">Referrals</span>
            </div>
            <h1 className="mt-1 text-lg font-semibold text-slate-50">Referral rewards queue</h1>
            <p className="text-[11px] text-slate-400">
              Review pending rewards, approve conversions, and mark payouts as paid.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportApproved}
              disabled={exporting}
              className="rz-btn-nav text-xs disabled:opacity-50"
            >
              {exporting ? 'Exporting…' : 'Export approved CSV'}
            </button>
            <div className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-medium text-emerald-100">
              Pending rewards: {pendingCount}
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          {loading ? (
            <p className="text-sm text-slate-400">Loading referral rewards…</p>
          ) : rewards.length === 0 ? (
            <p className="text-sm text-slate-400">No referral rewards found yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="text-left py-2 pr-4">Reward</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2 pr-4">Amount</th>
                    <th className="text-left py-2 pr-4">Referrer</th>
                    <th className="text-left py-2 pr-4">Referred</th>
                    <th className="text-left py-2 pr-4">Eligible</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map((reward) => {
                    const status = String(reward.status || '').toLowerCase();
                    const isPending = status === 'pending';
                    const isApproved = status === 'approved';
                    const isProcessing = processingRewardId === reward.id;

                    return (
                      <tr key={reward.id} className="border-b border-slate-900/70 align-top">
                        <td className="py-2 pr-4 text-slate-300">{reward.id.slice(0, 8)}…</td>
                        <td className="py-2 pr-4 text-slate-200">{status || 'unknown'}</td>
                        <td className="py-2 pr-4 text-slate-200">{formatCurrency(reward.reward_amount_cents)}</td>
                        <td className="py-2 pr-4 text-slate-300">#{reward.referrer_landlord_id}</td>
                        <td className="py-2 pr-4 text-slate-300">#{reward.referred_landlord_id}</td>
                        <td className="py-2 pr-4 text-slate-400">
                          {reward.eligible_at ? new Date(reward.eligible_at).toLocaleString() : '—'}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => applyAction(reward.id, 'approve')}
                              disabled={!isPending || isProcessing}
                              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-100 disabled:opacity-40"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => applyAction(reward.id, 'mark_paid')}
                              disabled={!isApproved || isProcessing}
                              className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-[11px] text-blue-100 disabled:opacity-40"
                            >
                              Mark paid
                            </button>
                            <button
                              type="button"
                              onClick={() => applyAction(reward.id, 'void')}
                              disabled={status === 'paid' || status === 'void' || isProcessing}
                              className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] text-amber-100 disabled:opacity-40"
                            >
                              Void
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
