'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type Payment = {
  id: number;
  tenant_id: number | null;
  property_id: number | null;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
  created_at?: string | null;
};

export default function LandlordPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPayments = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('paid_on', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error loading payments:', error);
        setError('Unable to load payments right now.');
      } else {
        setPayments(data || []);
      }

      setLoading(false);
    };

    loadPayments();
  }, []);

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return `$${amount.toFixed(2)}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">
              LANDLORD PORTAL
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-50">
              Payments
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Payments recorded from tenant card checkouts (via Stripe webhooks).
            </p>
          </div>

          <Link
            href="/landlord"
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Card container */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 md:p-5">
          {loading && (
            <p className="text-sm text-slate-400">Loading payments…</p>
          )}

          {error && !loading && (
            <p className="text-sm text-rose-300">{error}</p>
          )}

          {!loading && !error && payments.length === 0 && (
            <p className="text-sm text-slate-400">
              No payments recorded yet. Once tenants complete card payments,
              they&apos;ll appear here.
            </p>
          )}

          {!loading && !error && payments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm text-slate-200">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="text-left py-2 pr-3">Date</th>
                    <th className="text-left py-2 px-3">Amount</th>
                    <th className="text-left py-2 px-3">Tenant ID</th>
                    <th className="text-left py-2 px-3">Property ID</th>
                    <th className="text-left py-2 px-3">Method</th>
                    <th className="text-left py-2 px-3">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-900/60 last:border-b-0"
                    >
                      <td className="py-2 pr-3 align-top text-slate-300">
                        {formatDateTime(p.paid_on || p.created_at)}
                      </td>
                      <td className="py-2 px-3 align-top text-emerald-300 font-medium">
                        {formatAmount(p.amount)}
                      </td>
                      <td className="py-2 px-3 align-top text-slate-300">
                        {p.tenant_id ?? '—'}
                      </td>
                      <td className="py-2 px-3 align-top text-slate-300">
                        {p.property_id ?? '—'}
                      </td>
                      <td className="py-2 px-3 align-top text-slate-300">
                        {p.method || '—'}
                      </td>
                      <td className="py-2 px-3 align-top text-slate-400 max-w-xs">
                        {p.note || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Small hint */}
        <p className="mt-4 text-[11px] text-slate-500">
          If you completed Stripe test checkouts today and don&apos;t see them
          here, double-check your webhook configuration and Supabase{' '}
          <code className="bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
            payments
          </code>{' '}
          table.
        </p>
      </div>
    </div>
  );
}
