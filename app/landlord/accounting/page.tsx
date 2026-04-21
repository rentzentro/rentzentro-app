'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type LandlordRow = {
  id: number;
  user_id: string | null;
  email: string;
};

const todayInput = () => new Date().toISOString().slice(0, 10);

export default function LandlordAccountingPage() {
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [invoiceId, setInvoiceId] = useState('inv_demo_1001');
  const [invoiceDate, setInvoiceDate] = useState(todayInput());
  const [dueDate, setDueDate] = useState(todayInput());
  const [rentAmount, setRentAmount] = useState('1800');
  const [feeAmount, setFeeAmount] = useState('0');
  const [unitLabel, setUnitLabel] = useState('Property · Unit');

  const [paymentId, setPaymentId] = useState('pay_demo_1001');
  const [paymentDate, setPaymentDate] = useState(todayInput());
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [receivedAmount, setReceivedAmount] = useState('1800');
  const [processorFeeAmount, setProcessorFeeAmount] = useState('0');

  useEffect(() => {
    const loadLandlord = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          throw new Error('Please log in again to access accounting workflows.');
        }

        const user = authData.user;

        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, user_id, email')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) throw landlordError;

        if (!landlordRow && user.email) {
          const { data: byEmail, error: byEmailError } = await supabase
            .from('landlords')
            .select('id, user_id, email')
            .eq('email', user.email)
            .maybeSingle();

          if (byEmailError) throw byEmailError;
          if (byEmail) {
            setLandlord(byEmail as LandlordRow);
            return;
          }
        }

        if (!landlordRow) {
          throw new Error('Landlord record not found for this account.');
        }

        setLandlord(landlordRow as LandlordRow);
      } catch (err: any) {
        setError(err?.message || 'Unable to load landlord account.');
      } finally {
        setLoading(false);
      }
    };

    loadLandlord();
  }, []);

  const callWorkflow = async (payload: Record<string, unknown>) => {
    if (!landlord) {
      setError('Landlord account is not loaded yet.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error('Missing auth session. Please log in again.');
      }

      const res = await fetch('/api/accounting/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...payload, landlordId: landlord.id }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || 'Unable to run accounting workflow.');
      }

      setResultJson(JSON.stringify(body, null, 2));
    } catch (err: any) {
      setError(err?.message || 'Unable to run accounting workflow.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitInvoice = async (e: FormEvent) => {
    e.preventDefault();
    await callWorkflow({
      action: 'issue_invoice',
      invoiceId,
      occurredOn: invoiceDate,
      dueOn: dueDate,
      rentAmount: Number(rentAmount),
      feeAmount: Number(feeAmount),
      unitLabel,
    });
  };

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    await callWorkflow({
      action: 'record_payment',
      paymentId,
      invoiceId,
      occurredOn: paymentDate,
      method: paymentMethod,
      receivedAmount: Number(receivedAmount),
      processorFeeAmount: Number(processorFeeAmount),
    });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Accounting Workflows</h1>
              <p className="mt-2 text-sm text-slate-300">
                Generate accounting-grade invoice and payment journal payloads for your books.
              </p>
            </div>
            <Link href="/landlord" className="text-sm text-emerald-300 hover:text-emerald-200">
              Back to dashboard
            </Link>
          </div>
        </header>

        {loading ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
            Loading your landlord profile...
          </section>
        ) : null}

        {error ? (
          <section className="rounded-2xl border border-rose-700/60 bg-rose-950/40 p-4 text-sm text-rose-100">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <form onSubmit={submitInvoice} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <h2 className="text-lg font-semibold">Issue rent invoice</h2>
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} placeholder="Invoice ID" />
            <input type="date" className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            <input type="date" className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="Rent amount" />
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="Fee amount" />
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="Unit label" />
            <button type="submit" disabled={submitting || loading || !landlord} className="rounded bg-emerald-500 px-4 py-2 text-slate-950 font-semibold disabled:opacity-50">
              {submitting ? 'Running...' : 'Run invoice workflow'}
            </button>
          </form>

          <form onSubmit={submitPayment} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <h2 className="text-lg font-semibold">Record rent payment</h2>
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="Payment ID" />
            <input type="date" className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Method" />
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} placeholder="Received amount" />
            <input className="w-full rounded bg-slate-950 border border-slate-700 px-3 py-2" value={processorFeeAmount} onChange={(e) => setProcessorFeeAmount(e.target.value)} placeholder="Processor fee amount" />
            <button type="submit" disabled={submitting || loading || !landlord} className="rounded bg-emerald-500 px-4 py-2 text-slate-950 font-semibold disabled:opacity-50">
              {submitting ? 'Running...' : 'Run payment workflow'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Workflow output</h2>
          <p className="text-sm text-slate-400 mt-1">
            Copy this payload into your downstream ledger posting integration.
          </p>
          <pre className="mt-3 overflow-x-auto rounded bg-slate-950 border border-slate-800 p-4 text-xs text-emerald-200 min-h-[220px]">
            {resultJson || 'Run a workflow to preview the accounting payload here.'}
          </pre>
        </section>
      </div>
    </main>
  );
}
