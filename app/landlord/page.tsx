'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabaseClient';

// ---------- Types ----------

type LandlordRow = {
  id: number;
  email: string;
  name: string | null;

  // Stripe-ish informational fields (NOT used for gating)
  subscription_status: string | null;
  subscription_current_period_end: string | null;

  // Supabase truth fields (USED for gating)
  subscription_active: boolean | null;
  trial_active: boolean | null;
  trial_end: string | null;

  user_id: string | null;
};

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
  next_due_date: string | null;
};

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  property_id: number | null;
  monthly_rent: number | null;
  status: string | null;
};

type PaymentRow = {
  id: number;
  tenant_id: number | null;
  property_id: number | null;
  amount: number | null;
  paid_on: string | null;
  method: string | null;
  note: string | null;
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

type MaintenanceRow = {
  id: number;
  status: string | null;
};

type TeamMembershipRow = {
  id: string;
  owner_user_id: string;
  role: string | null;
  status: string | null;
};

// ---------- Helpers ----------

const formatCurrency = (v: number | null | undefined) =>
  v == null || isNaN(v)
    ? '-'
    : v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });

// Safe date formatter that avoids timezone shifts for plain YYYY-MM-DD values
const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!year || !month || !day) return '-';

    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';

  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

// Parse YYYY-MM-DD safely as a local date (no timezone shift)
const parseDateOnlySafe = (value: string | null | undefined): Date | null => {
  if (!value) return null;

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!y || !mo || !d) return null;
    return new Date(y, mo - 1, d);
  }

  const dt = new Date(value);
  if (isNaN(dt.getTime())) return null;

  // Normalize to date-only for comparisons
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const todayDateOnly = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Parse due dates for comparisons, also guarding against timezone shifts
const parseDueDate = (value: string | null | undefined) => {
  if (!value) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// Friendly method label (so ACH delays are obvious)
const formatMethodLabel = (method: string | null | undefined) => {
  const m = (method || '').toLowerCase();

  if (!m) return 'Method not specified';
  if (m.includes('ach') || m.includes('bank') || m.includes('us_bank')) {
    return 'Bank transfer (ACH)';
  }
  if (m.includes('card')) {
    return m.includes('autopay') ? 'Card (autopay)' : 'Card';
  }
  return method || 'Method not specified';
};

// ✅ Single source of truth access check (Supabase booleans)
const hasLandlordAccess = (l: LandlordRow | null): boolean => {
  if (!l) return false;

  // Primary: subscription_active boolean
  if (l.subscription_active === true) return true;

  // Secondary: promo trial window
  const end = parseDateOnlySafe(l.trial_end);
  const promoOk =
    l.trial_active === true &&
    !!end &&
    !Number.isNaN(end.getTime()) &&
    end >= todayDateOnly();

  return promoOk;
};

// ---------- Component ----------

export default function LandlordDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] =
    useState<MaintenanceRow[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Team member flags
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [ownerLookupFailed, setOwnerLookupFailed] = useState(false);

  // ---------- Load landlord + data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setOwnerLookupFailed(false);

      try {
        // 1) Get auth user
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData.user;
        const email = user?.email;
        if (!user || !email) {
          throw new Error(
            'Unable to load landlord account. Please log in again.'
          );
        }

        let landlordRow: LandlordRow | null = null;
        let actingAsTeamMember = false;
        let teamRoleLocal: string | null = null;

        // 2) Try normal landlord by user_id first
        const { data: landlordByUserId, error: landlordByUserIdError } =
          await supabase
            .from('landlords')
            .select(
              `
              id,
              email,
              name,
              subscription_status,
              subscription_current_period_end,
              subscription_active,
              trial_active,
              trial_end,
              user_id
            `
            )
            .eq('user_id', user.id)
            .maybeSingle();

        if (landlordByUserIdError) throw landlordByUserIdError;

        if (landlordByUserId) {
          landlordRow = landlordByUserId as LandlordRow;
        } else {
          // 3) Fallback: landlord by email (older rows)
          const { data: landlordByEmail, error: landlordByEmailError } =
            await supabase
              .from('landlords')
              .select(
                `
                id,
                email,
                name,
                subscription_status,
                subscription_current_period_end,
                subscription_active,
                trial_active,
                trial_end,
                user_id
              `
              )
              .eq('email', email)
              .maybeSingle();

          if (landlordByEmailError) throw landlordByEmailError;

          if (landlordByEmail) {
            landlordRow = landlordByEmail as LandlordRow;
          }
        }

        // 4) If still no landlord row → check for team membership
        if (!landlordRow) {
          const { data: teamRow, error: teamError } = await supabase
            .from('landlord_team_members')
            .select('id, owner_user_id, role, status')
            .eq('member_user_id', user.id)
            .eq('status', 'active')
            .maybeSingle();

          if (teamError) {
            console.error('Error loading team membership:', teamError);
            throw new Error('Unable to load team membership for this account.');
          }

          if (teamRow) {
            const tm = teamRow as TeamMembershipRow;
            actingAsTeamMember = true;
            teamRoleLocal = tm.role;

            // Look up the owner landlord row by owner_user_id (REQUIRED for access gating)
            const { data: ownerLandlordData, error: ownerLandlordError } =
              await supabase
                .from('landlords')
                .select(
                  `
                  id,
                  email,
                  name,
                  subscription_status,
                  subscription_current_period_end,
                  subscription_active,
                  trial_active,
                  trial_end,
                  user_id
                `
                )
                .eq('user_id', tm.owner_user_id)
                .maybeSingle();

            if (ownerLandlordError) {
              console.error(
                'Error loading owner landlord for team member:',
                ownerLandlordError
              );
              setOwnerLookupFailed(true);
            } else if (ownerLandlordData) {
              landlordRow = ownerLandlordData as LandlordRow;
            } else {
              setOwnerLookupFailed(true);
            }
          }
        }

        if (!landlordRow) {
          throw new Error(
            'Landlord record not found for this account. If you were invited as a teammate, ask the landlord to resend your invite.'
          );
        }

        setLandlord(landlordRow as LandlordRow);
        setIsTeamMember(actingAsTeamMember);
        setTeamRole(teamRoleLocal);

        // NOTE: We still load data here; UI below will gate rendering.
        const [propRes, tenantRes, paymentRes, expenseRes, maintRes] = await Promise.all([
          supabase
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('tenants')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('payments')
            .select('*')
            .order('paid_on', { ascending: false })
            .limit(500),
          supabase
            .from('expenses')
            .select('*')
            .eq('landlord_id', landlordRow.id)
            .order('expense_date', { ascending: false })
            .limit(1000),
          supabase
            .from('maintenance_requests')
            .select('id, status')
            .order('created_at', { ascending: false }),
        ]);

        if (propRes.error) throw propRes.error;
        if (tenantRes.error) throw tenantRes.error;
        if (paymentRes.error) throw paymentRes.error;
        if (expenseRes.error) throw expenseRes.error;
        if (maintRes.error) throw maintRes.error;

        setProperties((propRes.data || []) as PropertyRow[]);
        setTenants((tenantRes.data || []) as TenantRow[]);
        setPayments((paymentRes.data || []) as PaymentRow[]);
        setExpenses((expenseRes.data || []) as ExpenseRow[]);
        setMaintenanceRequests((maintRes.data || []) as MaintenanceRow[]);

        // Unread messages (for landlord + team)
        try {
          let unreadCount = 0;

          if (landlordRow.user_id) {
            const { data: msgRows, error: msgError } = await supabase
              .from('messages')
              .select('id')
              .eq('landlord_user_id', landlordRow.user_id)
              .eq('sender_type', 'tenant')
              .is('read_at', null);

            if (msgError) {
              console.error('Unread messages query error:', msgError);
            } else if (msgRows) {
              unreadCount = msgRows.length;
            }
          } else {
            const { data: msgRows, error: msgError } = await supabase
              .from('messages')
              .select('id')
              .eq('landlord_id', landlordRow.id)
              .eq('sender_type', 'tenant')
              .is('read_at', null);

            if (msgError) {
              console.error('Unread messages (fallback) query error:', msgError);
            } else if (msgRows) {
              unreadCount = msgRows.length;
            }
          }

          setUnreadMessagesCount(unreadCount);
        } catch (msgErr) {
          console.error('Unread messages query threw:', msgErr);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load landlord dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- Metrics & subscription / trial logic ----------

  const totalProperties = properties.length;

  const activeTenants = tenants.filter(
    (t) => t.status?.toLowerCase() === 'current'
  ).length;

  const monthlyRentRoll = properties.reduce(
    (sum, p) => sum + (p.monthly_rent || 0),
    0
  );

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const monthlyIncome = payments.reduce((sum, p) => {
    if (!p.amount || !p.paid_on) return sum;
    return p.paid_on.slice(0, 7) === currentMonthKey ? sum + p.amount : sum;
  }, 0);

  const monthlyExpenses = expenses.reduce((sum, e) => {
    if (!e.amount || !e.expense_date) return sum;
    return e.expense_date.slice(0, 7) === currentMonthKey ? sum + e.amount : sum;
  }, 0);

  const monthlyNet = monthlyIncome - monthlyExpenses;

  const propertyPerformance = properties.map((p) => {
    const income = payments.reduce((sum, pay) => {
      if (pay.property_id !== p.id || !pay.amount || !pay.paid_on) return sum;
      return pay.paid_on.slice(0, 7) === currentMonthKey ? sum + pay.amount : sum;
    }, 0);

    const expense = expenses.reduce((sum, exp) => {
      if (exp.property_id !== p.id || !exp.amount || !exp.expense_date) return sum;
      return exp.expense_date.slice(0, 7) === currentMonthKey ? sum + exp.amount : sum;
    }, 0);

    return {
      ...p,
      income,
      expense,
      net: income - expense,
    };
  });

  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sevenDaysFromNow = new Date(
    todayOnly.getFullYear(),
    todayOnly.getMonth(),
    todayOnly.getDate() + 7
  );

  const overdue = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return false;
    return due < todayOnly;
  });

  const upcoming7 = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return false;
    return due >= todayOnly && due <= sevenDaysFromNow;
  });

  const notDueYet = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return true;
    return due > sevenDaysFromNow;
  });

  const propertyById = new Map<number, PropertyRow>();
  properties.forEach((p) => propertyById.set(p.id, p));

  const tenantById = new Map<number, TenantRow>();
  tenants.forEach((t) => tenantById.set(t.id, t));

  const newMaintenanceCount = maintenanceRequests.filter(
    (m) => m.status?.toLowerCase() === 'new'
  ).length;
  const monthlyVolume = monthlyIncome + monthlyExpenses;
  const incomeSharePct = monthlyVolume > 0 ? (monthlyIncome / monthlyVolume) * 100 : 0;
  const expenseSharePct =
    monthlyVolume > 0 ? (monthlyExpenses / monthlyVolume) * 100 : 0;

  const performanceScale = Math.max(
    ...propertyPerformance.map((p) => Math.max(p.income, p.expense, Math.abs(p.net))),
    1
  );

  // ---------- Overdue amount helper (match tenant portal math) ----------

  const computeOverdueAmountForProperty = (p: PropertyRow): number | null => {
    const rent = p.monthly_rent;
    if (!rent || rent <= 0) return null;

    const firstUnpaidDue = parseDueDate(p.next_due_date);
    if (!firstUnpaidDue) return null;

    if (firstUnpaidDue >= todayOnly) {
      return rent;
    }

    let monthsBehind =
      (todayOnly.getFullYear() - firstUnpaidDue.getFullYear()) * 12 +
      (todayOnly.getMonth() - firstUnpaidDue.getMonth());

    if (todayOnly.getDate() >= firstUnpaidDue.getDate()) {
      monthsBehind += 1;
    }

    if (monthsBehind < 1) {
      monthsBehind = 1;
    }

    const baseDue = monthsBehind * rent;

    const paidToward = payments.reduce((sum, pay) => {
      if (pay.property_id !== p.id) return sum;
      if (!pay.amount || !pay.paid_on) return sum;

      const paidDate = parseDueDate(pay.paid_on);
      if (!paidDate) return sum;

      if (paidDate < firstUnpaidDue || paidDate > todayOnly) return sum;
      return sum + pay.amount;
    }, 0);

    const remaining = baseDue - paidToward;
    return remaining <= 0 ? 0 : remaining;
  };

  // ---------- Actions ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const goToSubscription = () => {
    router.push('/landlord/settings');
  };

  // ---------- UI ----------

  if (loading && !landlord) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading landlord dashboard…</p>
      </div>
    );
  }

  if (!landlord) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-red-500/60 p-5 space-y-3">
          <p className="text-sm text-red-200">
            {error ||
              'We could not find a landlord record for this account. Please contact support.'}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-1 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to landlord login
          </button>
        </div>
      </div>
    );
  }

  // Team member: if we cannot resolve the owner’s landlord row, we must block (no guessing)
  if (isTeamMember && ownerLookupFailed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-slate-900/80 border border-amber-500/60 p-6 shadow-xl space-y-4 text-center">
          <p className="text-xs text-amber-300 font-semibold uppercase tracking-wide">
            Team access pending
          </p>
          <h1 className="text-lg font-semibold text-slate-50">
            We couldn’t verify the landlord account
          </h1>
          <p className="text-sm text-slate-300">
            Your team membership is active, but RentZentro couldn’t locate the
            landlord account tied to your invite. Please ask the landlord to
            resend your invite or contact support.
          </p>

          <button
            onClick={handleSignOut}
            className="w-full rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  // ✅ MAIN ACCESS GATE: uses subscription_active + trial window ONLY
  const canAccess = hasLandlordAccess(landlord);

  if (!canAccess) {
    const isTrialConfigured = landlord.trial_active === true && !!landlord.trial_end;

    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-slate-900/80 border border-amber-500/60 p-6 shadow-xl space-y-4 text-center">
          <p className="text-xs text-amber-300 font-semibold uppercase tracking-wide">
            Access locked
          </p>

          <h1 className="text-lg font-semibold text-slate-50">
            Subscription required
          </h1>

          <p className="text-sm text-slate-300">
            Your landlord account is created, but your subscription isn&apos;t active
            {isTrialConfigured ? ' and your promo access has ended' : ''}.
            To access your dashboard, properties, tenants, and online rent collection,
            please activate the{' '}
            <span className="font-semibold text-emerald-300">
              RentZentro paid plan (starting at $19/mo)
            </span>
            .
          </p>

          <div className="space-y-2 text-[11px] text-slate-400 text-left rounded-2xl bg-slate-950/70 border border-slate-800 px-4 py-3">
            <p className="font-semibold text-slate-100 mb-1">
              Your account includes:
            </p>
            <ul className="space-y-1">
              <li>• Online rent payments via Stripe</li>
              <li>• Tenant and property management</li>
              <li>• Maintenance request tracking + email alerts</li>
              <li>• Document sharing with tenants</li>
              <li>• Listings + inquiries</li>
              <li>• Team members access</li>
            </ul>
          </div>

          <button
            onClick={goToSubscription}
            className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Go to account & billing
          </button>

          <button
            onClick={handleSignOut}
            className="w-full rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            Log out
          </button>
        </div>
      </main>
    );
  }

  // If we're here: landlord is allowed → show full dashboard
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/60 p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">
                Welcome back, {landlord.name || 'Landlord'} 👋
              </p>
              <h1 className="mt-1 text-2xl font-semibold">Portfolio Command Center</h1>
              <p className="mt-1 text-xs text-slate-400">
                {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} snapshot
              </p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
          {isTeamMember && (
            <p className="mt-3 text-xs text-emerald-300">
              Team mode: {teamRole === 'viewer' ? 'Viewer (read-only)' : 'Manager'}.
            </p>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/40 p-4 xl:sticky xl:top-6 xl:h-fit">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</p>
            <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1 text-xs">
              {[
                ['🏠', 'Properties', '/landlord/properties'],
                ['👥', 'Tenants', '/landlord/tenants'],
                ['💰', 'Expense report', '/landlord/expenses'],
                ['💳', 'Payments', '/landlord/payments'],
                ['🛠️', 'Maintenance', '/landlord/maintenance'],
                ['🔎', 'Maintenance directory', '/landlord/maintenance-directory'],
                ['💬', 'Messages', '/landlord/messages'],
                ['📄', 'Documents & e-sign', '/landlord/documents'],
                ['🧾', 'Templates', '/landlord/templates'],
                ['👤', 'Team access', '/landlord/team'],
                ['⚙️', 'Account & billing', '/landlord/settings'],
                ['📚', 'Accounting', '/landlord/accounting'],
                ['🏷️', 'Listings', '/landlord/listings'],
              ].map(([icon, label, href]) => (
                <Link
                  key={`${href}-${label}`}
                  href={href}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-slate-200 hover:border-indigo-400/60 hover:bg-slate-900"
                >
                  <span className="flex items-center gap-2">
                    <span>{icon}</span>
                    {label}
                  </span>
                  {(label === 'Messages' && unreadMessagesCount > 0) || (label === 'Maintenance' && newMaintenanceCount > 0) ? (
                    <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
                      {label === 'Messages' ? unreadMessagesCount : newMaintenanceCount}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </aside>

          <main className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-400">Monthly income</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-300">{formatCurrency(monthlyIncome)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-400">Monthly expenses</p>
                <p className="mt-2 text-3xl font-semibold text-rose-300">{formatCurrency(monthlyExpenses)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-400">Net profit</p>
                <p className={`mt-2 text-3xl font-semibold ${monthlyNet >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatCurrency(monthlyNet)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-xs text-slate-400">Active portfolio</p>
                <p className="mt-2 text-3xl font-semibold text-slate-100">{totalProperties}</p>
                <p className="text-xs text-slate-500">{activeTenants} active tenants</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Property performance</p>
                <div className="mt-3 space-y-3">
                  {propertyPerformance.slice(0, 6).map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <p className="font-medium text-slate-100">
                          {p.name || 'Untitled property'}{p.unit_label ? ` · ${p.unit_label}` : ''}
                        </p>
                        <p className={p.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatCurrency(p.net)}</p>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded bg-slate-800">
                        <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, (p.income / performanceScale) * 100)}%` }} />
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
                        <div className="h-full bg-rose-400" style={{ width: `${Math.min(100, (p.expense / performanceScale) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">Cash flow ratio</p>
                <div className="mt-4 flex items-center justify-center">
                  <div
                    className="flex h-40 w-40 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(#34d399 0 ${incomeSharePct}%, #f87171 ${incomeSharePct}% ${incomeSharePct + expenseSharePct}%, #1e293b ${incomeSharePct + expenseSharePct}% 100%)`,
                    }}
                  >
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-950 text-center text-xs text-slate-300">
                      {formatCurrency(monthlyIncome)}
                      <br />
                      collected
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs">
                  <p className="flex justify-between"><span className="text-slate-400">Income</span><span>{formatCurrency(monthlyIncome)}</span></p>
                  <p className="flex justify-between"><span className="text-slate-400">Expenses</span><span>{formatCurrency(monthlyExpenses)}</span></p>
                  <p className="flex justify-between"><span className="text-slate-400">Rent roll</span><span>{formatCurrency(monthlyRentRoll)}</span></p>
                </div>
              </section>
            </div>

            <section className="mb-6 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Rent status
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Overdue, upcoming, and future rent
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Tip: If a tenant pays by bank transfer (ACH), it may take 1–5 business days to clear.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/landlord/properties"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                Manage properties
              </Link>
              <Link
                href="/landlord/tenants"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                Manage tenants
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 text-xs">
            {/* Overdue */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-rose-200">Overdue</p>
                <span className="text-[11px] text-rose-200/80">
                  {overdue.length}
                </span>
              </div>
              {overdue.length === 0 ? (
                <p className="text-[11px] text-rose-100/70">
                  No units overdue right now.
                </p>
              ) : (
                <div className="space-y-2">
                  {overdue.map((p) => {
                    const amountDue = computeOverdueAmountForProperty(p);
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl bg-rose-950/40 border border-rose-500/40 px-2 py-1.5"
                      >
                        <p className="text-[11px] text-rose-50 font-medium">
                          {p.name || 'Property'}{' '}
                          {p.unit_label ? `· ${p.unit_label}` : ''}
                        </p>
                        <p className="text-[11px] text-rose-100/80">
                          Due {formatDate(p.next_due_date)} •{' '}
                          {formatCurrency(
                            amountDue != null ? amountDue : p.monthly_rent
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming 7 days */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-amber-200">Upcoming 7 days</p>
                <span className="text-[11px] text-amber-200/80">
                  {upcoming7.length}
                </span>
              </div>
              {upcoming7.length === 0 ? (
                <p className="text-[11px] text-amber-100/80">
                  No rent coming due in the next week.
                </p>
              ) : (
                <div className="space-y-2">
                  {upcoming7.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-amber-950/40 border border-amber-500/40 px-2 py-1.5"
                    >
                      <p className="text-[11px] text-amber-50 font-medium">
                        {p.name || 'Property'}{' '}
                        {p.unit_label ? `· ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-amber-100/90">
                        Due {formatDate(p.next_due_date)} •{' '}
                        {formatCurrency(p.monthly_rent)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Not due yet */}
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-emerald-200">Not due yet</p>
                <span className="text-[11px] text-emerald-200/80">
                  {notDueYet.length}
                </span>
              </div>
              {notDueYet.length === 0 ? (
                <p className="text-[11px] text-emerald-100/80">
                  No units in &quot;not due yet&quot; status.
                </p>
              ) : (
                <div className="space-y-2">
                  {notDueYet.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl bg-emerald-950/40 border border-emerald-500/40 px-2 py-1.5"
                    >
                      <p className="text-[11px] text-emerald-50 font-medium">
                        {p.name || 'Property'}{' '}
                        {p.unit_label ? `· ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-emerald-100/90">
                        {p.next_due_date
                          ? `Due ${formatDate(p.next_due_date)}`
                          : 'No due date set'}
                        {' • '}
                        {formatCurrency(p.monthly_rent)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Properties + Recent payments */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.3fr)]">
          {/* Left: Properties */}
          <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Properties
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  Units & rent
                </p>
              </div>
              <Link
                href="/landlord/properties"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                View all
              </Link>
            </div>

            {properties.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No properties yet. Add your first unit from the properties
                screen.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/70 text-xs"
                  >
                    <div>
                      <p className="font-medium text-slate-100">
                        {p.name || 'Untitled property'}
                        {p.unit_label ? ` · ${p.unit_label}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Rent:{' '}
                        <span className="text-slate-200">
                          {formatCurrency(p.monthly_rent)}
                        </span>
                        {' • '}
                        Status:{' '}
                        <span className="text-slate-200">
                          {p.status || 'Unknown'}
                        </span>
                      </p>
                      {p.next_due_date && (
                        <p className="text-[11px] text-slate-500">
                          Next due: {formatDate(p.next_due_date)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Right: Recent payments */}
          <section className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Recent payments
                </p>
                <p className="mt-1 text-sm font-medium text-slate-50">
                  Latest rent activity
                </p>
              </div>
              <Link
                href="/landlord/payments"
                className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
              >
                View all
              </Link>
            </div>

            {payments.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                No payments recorded yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {payments.map((p) => {
                  const t = p.tenant_id ? tenantById.get(p.tenant_id) : null;
                  const prop = p.property_id
                    ? propertyById.get(p.property_id)
                    : null;

                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/70 text-xs"
                    >
                      <div>
                        <p className="font-medium text-slate-100">
                          {formatCurrency(p.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(p.paid_on)}
                          {t && (
                            <>
                              {' • '}
                              <span>{t.name || t.email}</span>
                            </>
                          )}
                          {prop && (
                            <>
                              {' • '}
                              <span>
                                {prop.name}
                                {prop.unit_label
                                  ? ` · ${prop.unit_label}`
                                  : ''}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-400">
                          {formatMethodLabel(p.method)}
                        </p>
                        {p.note && (
                          <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-slate-500">
                            {p.note}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-3 text-[11px] text-slate-500">
              Payments show here after Stripe confirms them. Bank transfer (ACH) payments may take 1–5 business days to clear.
            </p>
          </section>
        </div>
          </main>
        </div>
      </div>
    </div>
  );
}
