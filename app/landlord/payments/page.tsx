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

  // ---------- Helpers ----------

  const formatDateTime = (iso: string | null | undefined) => {
    if (!iso) return '—';

    try {
      // Handle both "YYYY-MM-DD" and full ISO timestamps
      const match =
        /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(iso);

      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]); // 1–12
        const day = Number(match[3]);
        const hour = match[4] ? Number(match[4]) : 0;
        const minute = match[5] ? Number(match[5]) : 0;
        const second = match[6] ? Number(match[6]) : 0;

        if (!year || !month || !day) return '—';

        // Construct as a local date/time so we don't cross days due to timezone offsets
        const d = new Date(year, month - 1, day, hour, minute, second);
        return d.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      }

      // Fallback for anything else that still parses
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '—';
    return `$${amount.toFixed(2)}`;
  };

  const totalCollected = payments.reduce((sum, p) => {
    if (!p.amount) return sum;
    return sum + p.amount;
  }, 0);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
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
              View and track all tenant payments in one place.
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
        <section className="rounded-2xl bg-slate-950 border border-slate-800 p-4 md:p-5 shadow-lg shadow-black/40">
          {loading && (
            <p className="text-sm text-slate-400">Loading payments…</p>
          )}

          {error && !loading && (
            <p className="text-sm text-rose-300">{error}</p>
          )}

          {!loading && !error && payments.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/70 px-6 py-10 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
                <span className="text-lg">💳</span>
              </div>
              <h2 className="text-sm font-medium text-slate-50">
                No payments recorded yet
              </h2>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                Once tenants start paying online, their payments will show up
                here automatically.
              </p>
              <p className="mt-3 text-[11px] text-slate-500">
                Tip: Make sure your tenants have been invited and can log in to
                their tenant portal.
              </p>
            </div>
          )}

          {!loading && !error && payments.length > 0 && (
            <>
              {/* Summary row */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400/90" />
                  <span>
                    {payments.length} payment
                    {payments.length === 1 ? '' : 's'} recorded
                  </span>
                </div>
                <div className="text-slate-300">
                  Total collected:{' '}
                  <span className="font-semibold text-emerald-300">
                    {formatAmount(totalCollected)}
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                <table className="min-w-full text-xs md:text-sm text-slate-200">
                  <thead className="bg-slate-900/70">
                    <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="text-left py-2 pr-3 pl-4">Date</th>
                      <th className="text-left py-2 px-3">Amount</th>
                      <th className="text-left py-2 px-3">Tenant ID</th>
                      <th className="text-left py-2 px-3">Property ID</th>
                      <th className="text-left py-2 px-3 hidden sm:table-cell">
                        Method
                      </th>
                      <th className="text-left py-2 px-3 hidden md:table-cell">
                        Note
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-slate-900/60 last:border-b-0 hover:bg-slate-900/60"
                      >
                        <td className="py-2 pr-3 pl-4 align-top text-slate-300">
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
                        <td className="py-2 px-3 align-top text-slate-300 hidden sm:table-cell">
                          {p.method || '—'}
                        </td>
                        <td className="py-2 px-3 align-top text-slate-400 max-w-xs hidden md:table-cell">
                          {p.note || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        {/* Small hint */}
        <p className="mt-4 text-[11px] text-slate-500">
          Payment information is for record-keeping only. Always confirm funds
          in your bank account before handing over keys or issuing refunds.
        </p>
      </div>
    </main>
  );
}
