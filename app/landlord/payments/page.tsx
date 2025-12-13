// app/landlord/payments/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

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

type TenantRow = {
  id: number;
  owner_id: string | null;
  name: string | null;
  email: string;
};

type PropertyRow = {
  id: number;
  owner_id: string | null;
  name: string | null;
  unit_label: string | null;
};

type TeamMemberRow = {
  owner_user_id: string;
  member_user_id: string | null;
  status: string | null;
};

// ---------- Helpers ----------

// Show a friendly DATE ONLY, ignoring timezone shifts.
// Works even if we get a full ISO timestamp.
const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '—';
  try {
    const datePart = iso.slice(0, 10); // "YYYY-MM-DD"
    const [y, m, d] = datePart.split('-').map((x) => Number(x));
    if (!y || !m || !d) return datePart;

    const dt = new Date(y, m - 1, d);
    if (Number.isNaN(dt.getTime())) return datePart;

    return dt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const formatAmount = (amount: number | null) => {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toFixed(2)}`;
};

// Local "today" for <input type="date"> (no UTC shift)
const todayInputDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Normalize to `YYYY-MM-DD` for <input type="date">
const toDateInputValue = (iso: string | null | undefined): string => {
  if (!iso) return '';
  return iso.slice(0, 10);
};

// Determine if this looks like an ACH-style payment (so we can show the delay note)
const isAchLikeMethod = (method: string | null | undefined) => {
  const m = (method || '').toLowerCase().trim();
  if (!m) return false;

  // Common patterns you may store over time
  if (m.startsWith('ach')) return true;
  if (m.includes('us_bank')) return true;
  if (m.includes('bank')) return true;
  if (m.includes('ach_transfer')) return true;

  return false;
};

// Friendly method label for display
const formatMethodLabel = (method: string | null | undefined) => {
  const m = (method || '').toLowerCase().trim();
  if (!m) return '—';

  if (isAchLikeMethod(m)) return 'Bank transfer (ACH)';
  if (m.startsWith('card')) return m.includes('autopay') ? 'Card (autopay)' : 'Card';
  if (m.includes('stripe')) return 'Online (Stripe)';

  // Fallback: show whatever you stored
  return method || '—';
};

// Identify payments that were logged automatically via the tenant portal / Stripe
// These should be VIEW-ONLY: not editable and not deletable.
const isPortalLoggedPayment = (payment: Payment): boolean => {
  const method = (payment.method || '').toLowerCase().trim();

  if (!method) return false;

  // Anything that's clearly "card" or "ach" based (Stripe Checkout or autopay)
  if (method.startsWith('card')) return true; // "card", "card_autopay", etc.
  if (method.startsWith('ach')) return true; // "ach", "ach_autopay", etc.

  // Catch other Stripe-ish online labels you might store
  if (method.includes('stripe')) return true;
  if (method.includes('us_bank')) return true; // ACH-like

  return false;
};

// ---------- Component ----------

export default function LandlordPaymentsPage() {
  const router = useRouter();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual payment form
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formTenantId, setFormTenantId] = useState<number | ''>('');
  const [formPropertyId, setFormPropertyId] = useState<number | ''>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formPaidOn, setFormPaidOn] = useState<string>(todayInputDate());
  const [formMethod, setFormMethod] = useState<string>('Cash');
  const [formNote, setFormNote] = useState<string>('');
  const [formMessage, setFormMessage] = useState<string | null>(null);

  // Edit payment state
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editTenantId, setEditTenantId] = useState<number | ''>('');
  const [editPropertyId, setEditPropertyId] = useState<number | ''>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editPaidOn, setEditPaidOn] = useState<string>('');
  const [editMethod, setEditMethod] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete payment state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ---------- Load data for this landlord / team owner ----------

  useEffect(() => {
    const loadPayments = async () => {
      setLoading(true);
      setError(null);
      setFormMessage(null);

      try {
        // 1) Auth
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user) {
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;

        // We need the "acting owner" user_id (real landlord OR team owner)
        let ownerUuid: string | null = null;

        // a) Try landlord row by user_id
        const { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord by user_id:', landlordError);
          throw new Error('Unable to load landlord account.');
        }

        if (landlordRow && (landlordRow as any).user_id) {
          ownerUuid = (landlordRow as any).user_id as string;
        } else {
          // b) Not a landlord -> check if they are an active team member
          const { data: teamRow, error: teamError } = await supabase
            .from('landlord_team_members')
            .select('owner_user_id, member_user_id, status')
            .eq('member_user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (teamError) {
            console.error('Error loading team membership:', teamError);
            throw new Error(
              'Unable to load team membership for this account.'
            );
          }

          if (teamRow) {
            ownerUuid = (teamRow as TeamMemberRow).owner_user_id;
          } else {
            // c) Last fallback — older landlord rows by email
            if (!user.email) {
              throw new Error('Landlord account could not be found.');
            }

            const {
              data: landlordByEmail,
              error: landlordByEmailError,
            } = await supabase
              .from('landlords')
              .select('user_id')
              .eq('email', user.email)
              .maybeSingle();

            if (landlordByEmailError) {
              console.error(
                'Error loading landlord by email:',
                landlordByEmailError
              );
              throw new Error('Unable to load landlord account.');
            }

            if (landlordByEmail && (landlordByEmail as any).user_id) {
              ownerUuid = (landlordByEmail as any).user_id as string;
            } else {
              throw new Error(
                'Landlord account could not be found for this login.'
              );
            }
          }
        }

        if (!ownerUuid) {
          throw new Error('Unable to determine landlord for this account.');
        }

        // 2) Load properties + tenants for this landlord / team owner
        const [propRes, tenantRes, payRes] = await Promise.all([
          supabase
            .from('properties')
            .select('id, owner_id, name, unit_label')
            .eq('owner_id', ownerUuid)
            .order('created_at', { ascending: false }),
          supabase
            .from('tenants')
            .select('id, owner_id, name, email')
            .eq('owner_id', ownerUuid)
            .order('created_at', { ascending: false }),
          // Payments: RLS should already restrict to this landlord owner_id
          supabase
            .from('payments')
            .select('*')
            .order('paid_on', { ascending: false })
            .limit(100),
        ]);

        if (propRes.error) {
          console.error('Error loading properties:', propRes.error);
          throw propRes.error;
        }
        if (tenantRes.error) {
          console.error('Error loading tenants:', tenantRes.error);
          throw tenantRes.error;
        }
        if (payRes.error) {
          console.error('Error loading payments:', payRes.error);
          throw payRes.error;
        }

        setProperties((propRes.data || []) as PropertyRow[]);
        setTenants((tenantRes.data || []) as TenantRow[]);
        setPayments((payRes.data || []) as Payment[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Unable to load payments for this account right now.'
        );
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, [router]);

  // ---------- Derived ----------

  const totalCollected = payments.reduce((sum, p) => {
    if (!p.amount) return sum;
    return sum + p.amount;
  }, 0);

  const tenantById = new Map<number, TenantRow>();
  tenants.forEach((t) => tenantById.set(t.id, t));

  const propertyById = new Map<number, PropertyRow>();
  properties.forEach((p) => propertyById.set(p.id, p));

  // ---------- Manual form helpers ----------

  const resetForm = () => {
    setFormTenantId('');
    setFormPropertyId('');
    setFormAmount('');
    setFormPaidOn(todayInputDate());
    setFormMethod('Cash');
    setFormNote('');
    setFormMessage(null);
  };

  const handleCreatePayment = async (e: FormEvent) => {
    e.preventDefault();

    setCreating(true);
    setFormMessage(null);
    setError(null);

    try {
      const amountNum = Number(formAmount);
      if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid payment amount greater than 0.');
      }

      if (!formTenantId && !formPropertyId) {
        throw new Error(
          'Please select at least a tenant or a property to link this payment to.'
        );
      }

      // For a DATE-driven field we can safely pass the YYYY-MM-DD
      // string and let Postgres store it without timezone surprises.
      const paidOnValue = formPaidOn || todayInputDate();

      const payload = {
        tenant_id: formTenantId === '' ? null : formTenantId,
        property_id: formPropertyId === '' ? null : formPropertyId,
        amount: amountNum,
        paid_on: paidOnValue,
        method: formMethod.trim() || 'Manual',
        note: formNote.trim() || null,
      };

      const { data, error: insertError } = await supabase
        .from('payments')
        .insert(payload)
        .select('*')
        .single();

      if (insertError) {
        console.error('Error inserting manual payment:', insertError);
        throw new Error(insertError.message || 'Failed to save payment.');
      }

      setPayments((prev) => [data as Payment, ...prev]);
      resetForm();
      setShowForm(false);
      setFormMessage('Manual payment recorded.');
      // Note: due date & tenant status are handled by the DB trigger / logic
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to record payment.');
    } finally {
      setCreating(false);
    }
  };

  // ---------- Edit payment helpers ----------

  const startEditPayment = (p: Payment) => {
    // Block editing for portal/online payments
    if (isPortalLoggedPayment(p)) {
      setError(
        'Payments made through the tenant portal (card/ACH/autopay) are view-only and cannot be edited. ' +
          'If something needs to be adjusted, add a separate manual payment instead.'
      );
      setFormMessage(null);
      return;
    }

    setEditingPayment(p);
    setEditTenantId(p.tenant_id ?? '');
    setEditPropertyId(p.property_id ?? '');
    setEditAmount(p.amount != null ? String(p.amount) : '');
    setEditPaidOn(toDateInputValue(p.paid_on || p.created_at));
    setEditMethod(p.method || '');
    setEditNote(p.note || '');
    setError(null);
    setFormMessage(null);
  };

  const cancelEditPayment = () => {
    setEditingPayment(null);
    setEditTenantId('');
    setEditPropertyId('');
    setEditAmount('');
    setEditPaidOn('');
    setEditMethod('');
    setEditNote('');
    setSavingEdit(false);
  };

  const handleUpdatePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    // Hard block in handler as well, just in case
    if (isPortalLoggedPayment(editingPayment)) {
      setError(
        'Online portal payments cannot be edited. Adjust records with a separate manual payment if needed.'
      );
      setSavingEdit(false);
      return;
    }

    setSavingEdit(true);
    setError(null);
    setFormMessage(null);

    try {
      const amountNum = Number(editAmount);
      if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid payment amount greater than 0.');
      }

      const paidOnValue = editPaidOn || todayInputDate();

      const payload = {
        tenant_id: editTenantId === '' ? null : editTenantId,
        property_id: editPropertyId === '' ? null : editPropertyId,
        amount: amountNum,
        paid_on: paidOnValue,
        method: editMethod.trim() || null,
        note: editNote.trim() || null,
      };

      const { data, error: updateError } = await supabase
        .from('payments')
        .update(payload)
        .eq('id', editingPayment.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating payment:', updateError);
        throw new Error(updateError.message || 'Failed to update payment.');
      }

      setPayments((prev) =>
        prev.map((p) => (p.id === editingPayment.id ? (data as Payment) : p))
      );
      cancelEditPayment();
      setFormMessage('Payment updated.');
      // Rent status / due date continue to be determined by your existing logic
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to update payment.');
      setSavingEdit(false);
    }
  };

  // ---------- Delete payment helpers ----------

  const handleDeletePayment = async (payment: Payment) => {
    // Block deleting for portal/online payments
    if (isPortalLoggedPayment(payment)) {
      setError(
        'Payments made through the tenant portal (card/ACH/autopay) are view-only and cannot be deleted. ' +
          'If there was an error, reconcile it in your bank and add a manual adjustment payment instead.'
      );
      setFormMessage(null);
      return;
    }

    const confirmed = window.confirm(
      'Delete this payment? If this payment was marking the most recent period as paid, the tenant may show as past due again.'
    );
    if (!confirmed) return;

    setError(null);
    setFormMessage(null);
    setDeletingId(payment.id);

    try {
      const { error: delError } = await supabase
        .from('payments')
        .delete()
        .eq('id', payment.id);

      if (delError) {
        console.error('Error deleting payment:', delError);
        throw new Error(delError.message || 'Failed to delete payment.');
      }

      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      setFormMessage(
        'Payment deleted. If this was the payment keeping this period current, the unit will show as past due again based on your existing rent logic.'
      );
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete payment.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBackToDashboard = () => {
    router.push('/landlord');
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  // ---------- Render ----------

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        {/* Top bar */}
        <div className="flex flex-col gap-3 items-start justify-between mb-6 md:flex-row md:items-center">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-[0.18em]">
              LANDLORD PORTAL
            </p>
            <h1 className="text-xl md:text-2xl font-semibold text-slate-50">
              Payments
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              View tenant payments and record offline payments (cash, check,
              money order, etc.).
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch justify-end">
            <button
              onClick={handleBackToDashboard}
              className="flex-1 md:flex-none text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
            >
              ← Back to dashboard
            </button>
            <button
              onClick={handleLogOut}
              className="flex-1 md:flex-none text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Payment timing note (ACH delay) */}
        <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-[12px] text-slate-300">
          <p className="font-semibold text-slate-100">Payment timing note</p>
          <p className="mt-1 text-slate-400">
            <span className="text-slate-200 font-medium">Card</span> payments usually confirm quickly.
            <span className="mx-1">•</span>
            <span className="text-slate-200 font-medium">Bank transfer (ACH)</span> payments can take{' '}
            <span className="text-slate-200 font-medium">1–5 business days</span> to fully clear.
            During that time, the tenant may show as “paid” on their side while the payout is still processing.
          </p>
        </div>

        {/* Global errors / messages */}
        {(error || formMessage) && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-2 text-sm ${
              error
                ? 'border-rose-500/60 bg-rose-950/40 text-rose-100'
                : 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100'
            }`}
          >
            {error || formMessage}
          </div>
        )}

        {/* Layout: manual form + list */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
          {/* Manual payment form card */}
          <section className="rounded-2xl bg-slate-950 border border-slate-800 p-4 md:p-5 shadow-lg shadow-black/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Manual payment
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  Record an offline payment
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Use this when a tenant pays outside Stripe (cash, check,
                  money order, Zelle, etc.) so your records stay accurate.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
                className="hidden md:inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-800"
              >
                {showForm ? 'Hide form' : 'Show form'}
              </button>
            </div>

            {showForm && (
              <form
                onSubmit={handleCreatePayment}
                className="mt-3 space-y-3 text-xs"
              >
                <div className="space-y-1">
                  <label className="block text-slate-300">
                    Amount <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="e.g. 1500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-300">
                    Paid on <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formPaidOn}
                    onChange={(e) => setFormPaidOn(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-300">
                      Tenant (optional)
                    </label>
                    <select
                      value={formTenantId === '' ? '' : String(formTenantId)}
                      onChange={(e) =>
                        setFormTenantId(
                          e.target.value ? Number(e.target.value) : ''
                        )
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Select tenant…</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name || t.email}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Recommended: link the payment to the tenant.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-300">
                      Property (optional)
                    </label>
                    <select
                      value={
                        formPropertyId === '' ? '' : String(formPropertyId)
                      }
                      onChange={(e) =>
                        setFormPropertyId(
                          e.target.value ? Number(e.target.value) : ''
                        )
                      }
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Select property…</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || 'Property'}
                          {p.unit_label ? ` · ${p.unit_label}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-slate-500">
                      You can link to both a tenant and a unit, or just one.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-300">Method</label>
                    <select
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Check">Check</option>
                      <option value="Money Order">Money Order</option>
                      <option value="Bank Transfer / Zelle">
                        Bank Transfer / Zelle
                      </option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-300">Note</label>
                    <input
                      type="text"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Optional (e.g. Check #1024)"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setShowForm(false);
                    }}
                    className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Saving…' : 'Save manual payment'}
                  </button>
                </div>
              </form>
            )}

            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 w-full rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20 md:hidden"
              >
                + Add manual payment
              </button>
            )}

            <p className="mt-3 text-[11px] text-slate-500">
              Manual payments are for record-keeping only and won&apos;t move
              money. Always confirm funds in your bank account.
            </p>
          </section>

          {/* Payments list */}
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
                  Once tenants start paying online — or you record offline
                  payments — they&apos;ll show up here automatically.
                </p>
                <p className="mt-3 text-[11px] text-slate-500">
                  Tip: Use the manual payment form to log cash/check payments.
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
                    Total recorded:{' '}
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
                        <th className="text-left py-2 px-3">Tenant</th>
                        <th className="text-left py-2 px-3">Property</th>
                        <th className="text-left py-2 px-3 hidden sm:table-cell">
                          Method
                        </th>
                        <th className="text-left py-2 px-3 hidden md:table-cell">
                          Note
                        </th>
                        <th className="text-left py-2 px-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => {
                        const t =
                          p.tenant_id != null
                            ? tenantById.get(p.tenant_id)
                            : null;
                        const prop =
                          p.property_id != null
                            ? propertyById.get(p.property_id)
                            : null;

                        const tenantLabel = t
                          ? t.name || t.email
                          : p.tenant_id ?? '—';
                        const propertyLabelText = prop
                          ? `${prop.name || 'Property'}${
                              prop.unit_label ? ` · ${prop.unit_label}` : ''
                            }`
                          : p.property_id ?? '—';

                        const isDeleting = deletingId === p.id;
                        const portalPayment = isPortalLoggedPayment(p);
                        const isAch = isAchLikeMethod(p.method);

                        return (
                          <tr
                            key={p.id}
                            className="border-b border-slate-900/60 last:border-b-0 hover:bg-slate-900/60"
                          >
                            <td className="py-2 pr-3 pl-4 align-top text-slate-300">
                              {formatDate(p.paid_on || p.created_at)}
                            </td>
                            <td className="py-2 px-3 align-top text-emerald-300 font-medium">
                              {formatAmount(p.amount)}
                            </td>
                            <td className="py-2 px-3 align-top text-slate-300">
                              {tenantLabel}
                            </td>
                            <td className="py-2 px-3 align-top text-slate-300">
                              {propertyLabelText}
                            </td>
                            <td className="py-2 px-3 align-top text-slate-300 hidden sm:table-cell">
                              {formatMethodLabel(p.method)}
                              {portalPayment && isAch && (
                                <span className="block mt-0.5 text-[10px] text-slate-500">
                                  Clearing: 1–5 business days
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 align-top text-slate-400 max-w-xs hidden md:table-cell">
                              {p.note || '—'}
                            </td>
                            <td className="py-2 px-3 align-top">
                              {portalPayment ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-200">
                                  {isAch
                                    ? 'Portal payment (ACH) · view only'
                                    : 'Portal payment · view only'}
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditPayment(p)}
                                    className="rounded-full border border-sky-500/70 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-200 hover:bg-sky-500/20"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePayment(p)}
                                    disabled={isDeleting}
                                    className="rounded-full border border-rose-500/70 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {isDeleting ? 'Deleting…' : 'Delete'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Edit payment form */}
                {editingPayment && (
                  <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                          Edit payment
                        </p>
                        <p className="mt-1 text-sm text-slate-50">
                          Payment #{editingPayment.id}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={cancelEditPayment}
                        className="text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        Close
                      </button>
                    </div>

                    <form
                      onSubmit={handleUpdatePayment}
                      className="grid gap-3 md:grid-cols-2"
                    >
                      <div className="space-y-1 md:col-span-1">
                        <label className="block text-slate-300">
                          Amount <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-1">
                        <label className="block text-slate-300">
                          Paid on <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={editPaidOn}
                          onChange={(e) => setEditPaidOn(e.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-1">
                        <label className="block text-slate-300">Tenant</label>
                        <select
                          value={editTenantId === '' ? '' : String(editTenantId)}
                          onChange={(e) =>
                            setEditTenantId(
                              e.target.value ? Number(e.target.value) : ''
                            )
                          }
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">Not linked</option>
                          {tenants.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name || t.email}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-1">
                        <label className="block text-slate-300">Property</label>
                        <select
                          value={
                            editPropertyId === '' ? '' : String(editPropertyId)
                          }
                          onChange={(e) =>
                            setEditPropertyId(
                              e.target.value ? Number(e.target.value) : ''
                            )
                          }
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="">Not linked</option>
                          {properties.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name || 'Property'}
                              {p.unit_label ? ` · ${p.unit_label}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-1">
                        <label className="block text-slate-300">Method</label>
                        <input
                          type="text"
                          value={editMethod}
                          onChange={(e) => setEditMethod(e.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          placeholder="e.g. Cash, Check"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-1">
                        <label className="block text-slate-300">Note</label>
                        <input
                          type="text"
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          placeholder="Optional"
                        />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={cancelEditPayment}
                          className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingEdit}
                          className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {savingEdit ? 'Saving changes…' : 'Save changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Small hint */}
        <p className="mt-4 text-[11px] text-slate-500">
          Payment information in RentZentro is for record-keeping only. Always
          confirm funds in your bank account before handing over keys or
          issuing refunds.
        </p>
      </div>
    </main>
  );
}
