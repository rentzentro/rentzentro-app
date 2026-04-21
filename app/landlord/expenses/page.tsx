'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type LandlordRow = {
  id: number;
  name: string | null;
  email: string;
  user_id: string | null;
};

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
};

type ExpenseRow = {
  id: string;
  landlord_id: number | null;
  property_id: number | null;
  amount: number;
  category: string | null;
  description: string | null;
  expense_date: string;
  created_at: string | null;
};

const EXPENSE_CATEGORIES = [
  'Repairs',
  'Maintenance',
  'Utilities',
  'Mortgage',
  'Insurance',
  'Taxes',
  'HOA',
  'Supplies',
  'Other',
];

const formatCurrency = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? '-'
    : value.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const getMonthInputValue = (date = new Date()) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${y}-${m}`;
};

const propertyLabel = (property: PropertyRow | undefined) => {
  if (!property) return 'Unassigned property';

  const name = property.name?.trim() || 'Unnamed property';
  const unit = property.unit_label?.trim();

  return unit ? `${name} • ${unit}` : name;
};

export default function LandlordExpensesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);

  const [selectedMonth, setSelectedMonth] = useState(getMonthInputValue());

  const [propertyId, setPropertyId] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const propertyMap = useMemo(() => {
    const map = new Map<number, PropertyRow>();
    properties.forEach((p) => map.set(p.id, p));
    return map;
  }, [properties]);

  const loadPage = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const user = authData.user;
      const email = user?.email;

      if (!user || !email) {
        throw new Error('Unable to load your landlord account. Please log in again.');
      }

      let landlordRow: LandlordRow | null = null;

      const { data: byUserId, error: byUserIdError } = await supabase
        .from('landlords')
        .select('id, name, email, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (byUserIdError) throw byUserIdError;

      if (byUserId) {
        landlordRow = byUserId as LandlordRow;
      } else {
        const { data: byEmail, error: byEmailError } = await supabase
          .from('landlords')
          .select('id, name, email, user_id')
          .eq('email', email)
          .maybeSingle();

        if (byEmailError) throw byEmailError;
        if (byEmail) landlordRow = byEmail as LandlordRow;
      }

      if (!landlordRow) {
        throw new Error('Landlord record not found for this account.');
      }

      setLandlord(landlordRow);

      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('id, name, unit_label')
        .order('created_at', { ascending: false });

      if (propertyError) throw propertyError;
      setProperties((propertyData || []) as PropertyRow[]);

      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .select('*')
        .eq('landlord_id', landlordRow.id)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (expenseError) throw expenseError;
      setExpenses((expenseData || []) as ExpenseRow[]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  const filteredExpenses = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (!year || !month) return expenses;

    return expenses.filter((expense) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expense.expense_date);
      if (!match) return false;

      return Number(match[1]) === year && Number(match[2]) === month;
    });
  }, [expenses, selectedMonth]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  }, [filteredExpenses]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();

    filteredExpenses.forEach((expense) => {
      const key = expense.category?.trim() || 'Other';
      map.set(key, (map.get(key) || 0) + (expense.amount || 0));
    });

    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const propertyTotals = useMemo(() => {
    const map = new Map<number | 'unassigned', number>();

    filteredExpenses.forEach((expense) => {
      const key = expense.property_id ?? 'unassigned';
      map.set(key, (map.get(key) || 0) + (expense.amount || 0));
    });

    return Array.from(map.entries())
      .map(([key, total]) => ({
        key,
        total,
        property:
          key === 'unassigned' ? undefined : propertyMap.get(Number(key)),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredExpenses, propertyMap]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!landlord) {
      setError('Unable to save expense because the landlord account is not loaded.');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid expense amount.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        landlord_id: landlord.id,
        property_id: propertyId ? Number(propertyId) : null,
        amount: Number(amount),
        category: category || 'Other',
        description: description.trim() || null,
        expense_date: expenseDate,
      };

      const { error: insertError } = await supabase.from('expenses').insert([payload]);
      if (insertError) throw insertError;

      setPropertyId('');
      setAmount('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setDescription('');
      setExpenseDate(new Date().toISOString().slice(0, 10));

      await loadPage();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExpenseReport = () => {
    if (filteredExpenses.length === 0) {
      setError('There are no expenses in this report yet to export.');
      return;
    }

    const escapeCsvCell = (value: string | number | null | undefined) => {
      if (value == null) return '';
      const stringValue = String(value);
      const escapedValue = stringValue.replace(/"/g, '""');
      return /[",\n]/.test(stringValue) ? `"${escapedValue}"` : escapedValue;
    };

    const header = [
      'Expense Date',
      'Property',
      'Category',
      'Description',
      'Amount (USD)',
      'Created At',
    ];

    const rows = filteredExpenses.map((expense) => {
      const linkedProperty = expense.property_id
        ? propertyMap.get(expense.property_id)
        : undefined;

      return [
        expense.expense_date,
        propertyLabel(linkedProperty),
        expense.category || 'Other',
        expense.description || '',
        Number(expense.amount || 0).toFixed(2),
        expense.created_at || '',
      ];
    });

    const csvString = [header, ...rows]
      .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
      .join('\n');

    const fileName = `expense-report-${selectedMonth || getMonthInputValue()}.csv`;
    const csvBlob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(csvBlob);

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.setAttribute('download', fileName);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  };

  if (loading && !landlord) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading expenses…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Expenses</span>
            </div>
            <h1 className="text-xl font-semibold mt-1 text-slate-50">
              Expenses
            </h1>
            <p className="text-[13px] text-slate-400">
              Track property expenses and keep a clean monthly picture of where your money is going.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={handleExportExpenseReport}
              className="text-xs px-3 py-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
            >
              Export report (Excel/CSV)
            </button>
            <Link
              href="/landlord"
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-100">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-950/70 shadow-sm">
            <div className="border-b border-slate-800 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Add expense
              </p>
              <p className="mt-1 text-sm text-slate-200">
                Log repairs, utilities, insurance, and other property costs.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Property
                  </label>
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
                  >
                    <option value="">Unassigned / general expense</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {propertyLabel(property)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
                  >
                    {EXPENSE_CATEGORIES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500/70"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium text-slate-400">
                    Expense date
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  Notes
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Optional details about this expense"
                  className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500/70 resize-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving…' : 'Add expense'}
                </button>

                <p className="text-[11px] text-slate-500">
                  Keep entries clean and categorized so monthly reporting stays useful.
                </p>
              </div>
            </form>
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Monthly snapshot
                  </p>
                  <p className="mt-1 text-sm text-slate-200">
                    Expense totals for the selected month.
                  </p>
                </div>

                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-emerald-500/70"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Total expenses
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-rose-300">
                    {formatCurrency(totalExpenses)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {filteredExpenses.length} expense
                    {filteredExpenses.length === 1 ? '' : 's'} in this month
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Top category
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-50">
                    {categoryTotals[0]?.label || 'No expenses yet'}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {categoryTotals[0]
                      ? formatCurrency(categoryTotals[0].total)
                      : 'Add expenses to see category totals'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                By category
              </p>
              <div className="mt-4 space-y-2">
                {categoryTotals.length === 0 ? (
                  <p className="text-sm text-slate-500">No expenses logged for this month yet.</p>
                ) : (
                  categoryTotals.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2.5"
                    >
                      <span className="text-sm text-slate-200">{item.label}</span>
                      <span className="text-sm font-semibold text-slate-50">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                By property
              </p>
              <div className="mt-4 space-y-2">
                {propertyTotals.length === 0 ? (
                  <p className="text-sm text-slate-500">No property expense totals available yet.</p>
                ) : (
                  propertyTotals.map((item) => (
                    <div
                      key={String(item.key)}
                      className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2.5"
                    >
                      <div className="min-w-0 pr-3">
                        <p className="truncate text-sm text-slate-200">
                          {propertyLabel(item.property)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-50">
                        {formatCurrency(item.total)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-slate-800 bg-slate-950/70 shadow-sm">
          <div className="border-b border-slate-800 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Expense report
            </p>
            <p className="mt-1 text-sm text-slate-200">
              Full report for the selected month. Export to CSV for Excel anytime.
            </p>
          </div>

          <div className="p-5 space-y-3">
            {filteredExpenses.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-center">
                <p className="text-sm font-medium text-slate-200">No expenses for this month yet.</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Add your first expense above to start building a clean monthly record.
                </p>
              </div>
            ) : (
              filteredExpenses.map((expense) => {
                const linkedProperty = expense.property_id
                  ? propertyMap.get(expense.property_id)
                  : undefined;

                return (
                  <div
                    key={expense.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200">
                            {expense.category || 'Other'}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatDate(expense.expense_date)}
                          </span>
                        </div>

                        <p className="mt-2 text-sm font-medium text-slate-100">
                          {propertyLabel(linkedProperty)}
                        </p>

                        {expense.description && (
                          <p className="mt-1 text-[12px] text-slate-400">
                            {expense.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        <p className="text-sm font-semibold text-rose-300">
                          {formatCurrency(expense.amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
