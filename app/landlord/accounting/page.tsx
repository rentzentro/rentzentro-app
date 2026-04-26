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
  const [resultWorkflow, setResultWorkflow] = useState<any | null>(null);
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
      setResultWorkflow(body);
    } catch (err: any) {
      setError(err?.message || 'Unable to run accounting workflow.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatUsdFromCents = (cents?: number) => {
    if (typeof cents !== 'number' || Number.isNaN(cents)) return '-';
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    });
  };

  const downloadJournalCsv = () => {
    const workflow = resultWorkflow;
    const journal = workflow?.journalEntry;
    const lines: any[] = Array.isArray(journal?.lines) ? journal.lines : [];

    if (!journal || !lines.length) return;

    const escape = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const rows = [
      [
        'journalId',
        'occurredOn',
        'description',
        'reference',
        'accountCode',
        'debit',
        'credit',
        'memo',
      ],
      ...lines.map((line) => [
        journal.journalId || '',
        journal.occurredOn || '',
        journal.description || '',
        journal.reference || '',
        line.accountCode || '',
        formatUsdFromCents(line.debitCents || 0),
        formatUsdFromCents(line.creditCents || 0),
        line.memo || '',
      ]),
    ]
      .map((row) => row.map(escape).join(','))
      .join('\n');

    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${journal.journalId || 'journal-entry'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyAccountantSummary = async () => {
    const workflow = resultWorkflow;
    const journal = workflow?.journalEntry;
    if (!workflow || !journal) return;

    const lines: any[] = Array.isArray(journal.lines) ? journal.lines : [];
    const detailLines = lines
      .map(
        (line) =>
          `- ${line.accountCode}: Dr ${formatUsdFromCents(line.debitCents || 0)} | Cr ${formatUsdFromCents(
            line.creditCents || 0
          )}`
      )
      .join('\n');

    const summary = [
      `Workflow: ${workflow.workflow || '-'}`,
      `Reference: ${journal.reference || '-'}`,
      `Date: ${journal.occurredOn || '-'}`,
      `Total Debits: ${formatUsdFromCents(journal.totals?.debitCents || 0)}`,
      `Total Credits: ${formatUsdFromCents(journal.totals?.creditCents || 0)}`,
      'Journal lines:',
      detailLines,
    ].join('\n');

    await navigator.clipboard.writeText(summary);
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Accounting Workflows</h1>
              <p className="mt-2 text-sm text-slate-300">
                Generate accounting-grade invoice and payment journal payloads for your books.
              </p>
            </div>
            <Link href="/landlord" className="rz-btn-nav rz-btn-nav-block">
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
            <button type="submit" disabled={submitting || loading || !landlord} className="rz-btn-primary">
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
            <button type="submit" disabled={submitting || loading || !landlord} className="rz-btn-primary">
              {submitting ? 'Running...' : 'Run payment workflow'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="text-lg font-semibold">Workflow output</h2>
          <p className="text-sm text-slate-400 mt-1">
            Use the buttons below to download a CSV journal entry or copy a plain-English summary for your accountant.
          </p>

          {resultWorkflow?.journalEntry ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded border border-slate-700 bg-slate-950 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Workflow</p>
                  <p className="mt-1 text-sm font-semibold">{resultWorkflow.workflow || '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-950 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Reference</p>
                  <p className="mt-1 text-sm font-semibold">{resultWorkflow.journalEntry.reference || '-'}</p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-950 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Debits</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatUsdFromCents(resultWorkflow.journalEntry.totals?.debitCents)}
                  </p>
                </div>
                <div className="rounded border border-slate-700 bg-slate-950 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Credits</p>
                  <p className="mt-1 text-sm font-semibold">
                    {formatUsdFromCents(resultWorkflow.journalEntry.totals?.creditCents)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={downloadJournalCsv}
                  className="rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950"
                >
                  Download journal CSV
                </button>
                <button
                  type="button"
                  onClick={copyAccountantSummary}
                  className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100"
                >
                  Copy accountant summary
                </button>
              </div>

              <div className="overflow-x-auto rounded border border-slate-800">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-950 text-slate-300">
                    <tr>
                      <th className="px-3 py-2 text-left">Account</th>
                      <th className="px-3 py-2 text-left">Debit</th>
                      <th className="px-3 py-2 text-left">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(resultWorkflow.journalEntry.lines || []).map((line: any, idx: number) => (
                      <tr key={`${line.accountCode}-${idx}`} className="border-t border-slate-800">
                        <td className="px-3 py-2">{line.accountCode || '-'}</td>
                        <td className="px-3 py-2">{formatUsdFromCents(line.debitCents || 0)}</td>
                        <td className="px-3 py-2">{formatUsdFromCents(line.creditCents || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <details className="rounded border border-slate-800 bg-slate-950 p-3">
                <summary className="cursor-pointer text-xs text-slate-300">View raw JSON</summary>
                <pre className="mt-3 overflow-x-auto text-xs text-emerald-200">{resultJson}</pre>
              </details>
            </div>
          ) : (
            <pre className="mt-3 overflow-x-auto rounded bg-slate-950 border border-slate-800 p-4 text-xs text-emerald-200 min-h-[140px]">
              Run a workflow to generate a downloadable journal entry.
            </pre>
          )}
        </section>
      </div>
    </main>
  );
}
