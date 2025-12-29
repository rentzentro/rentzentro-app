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
        const [propRes, tenantRes, paymentRes, maintRes] = await Promise.all([
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
            .from('maintenance_requests')
            .select('id, status')
            .order('created_at', { ascending: false }),
        ]);

        if (propRes.error) throw propRes.error;
        if (tenantRes.error) throw tenantRes.error;
        if (paymentRes.error) throw paymentRes.error;
        if (maintRes.error) throw maintRes.error;

        setProperties((propRes.data || []) as PropertyRow[]);
        setTenants((tenantRes.data || []) as TenantRow[]);
        setPayments((paymentRes.data || []) as PaymentRow[]);
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
              $29.95/mo RentZentro Landlord Plan
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
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header / breadcrumb */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Dashboard</span>
            </div>
            <h1 className="text-xl font-semibold mt-1 text-slate-50">
              Landlord dashboard
            </h1>
            <p className="text-[13px] text-slate-400">
              Overview of your units, rent status, and recent payments.
            </p>
            {isTeamMember && (
              <p className="mt-1 text-[11px] text-emerald-300">
                You&apos;re logged in as a{' '}
                {teamRole === 'viewer'
                  ? 'viewer (read-only)'
                  : 'manager team member'}
                .
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-100">
            {error}
          </div>
        )}

        {/* ACH / Card info banner */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-[12px] text-slate-300">
          <p className="font-semibold text-slate-100">Payment timing note</p>
          <p className="mt-1 text-slate-400">
            <span className="text-slate-200 font-medium">Card</span> payments usually confirm quickly.
            <span className="mx-1">•</span>
            <span className="text-slate-200 font-medium">Bank transfer (ACH)</span> payments can take{' '}
            <span className="text-slate-200 font-medium">1–5 business days</span> to fully clear.
            During that time, the tenant may show as “paid” on their side while the payout is still processing.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Properties
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {properties.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Total units you&apos;re tracking in RentZentro.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Active tenants
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {activeTenants}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Tenants with current leases.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Monthly rent roll
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-400">
              {formatCurrency(monthlyRentRoll)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Rent for all current units this month.
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <section className="mb-6 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Quick actions
              </p>
              <p className="mt-1 text-sm text-slate-200">
                Jump straight to the tools you use the most.
              </p>
            </div>
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              Drag & drop coming in a future update.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/landlord/properties"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  🏠
                </span>
                Manage properties
              </p>
              <p className="text-[11px] text-slate-400">
                Add units, update rent, and keep your portfolio organized.
              </p>
            </Link>

            <Link
              href="/landlord/tenants"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  👤
                </span>
                Manage tenants
              </p>
              <p className="text-[11px] text-slate-400">
                View tenants, invite new ones, and keep contact details current.
              </p>
            </Link>

            <Link
              href="/landlord/payments"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  💳
                </span>
                Payments & rent
              </p>
              <p className="text-[11px] text-slate-400">
                Review recent payments and see who has paid or is still due.
              </p>
            </Link>

            <Link
              href="/landlord/maintenance"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  🛠️
                </span>
                <span className="flex items-center gap-2">
                  <span>Maintenance requests</span>
                  {newMaintenanceCount > 0 && (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
                      {newMaintenanceCount}
                    </span>
                  )}
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                Track new, in-progress, and resolved issues across your units.
              </p>
            </Link>

            <Link
              href="/landlord/messages"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  💬
                </span>
                <span className="flex items-center gap-2">
                  <span>Messages</span>
                  {unreadMessagesCount > 0 && (
                    <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
                      {unreadMessagesCount}
                    </span>
                  )}
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                View and reply to portal messages from your tenants in one place.
              </p>
            </Link>

            <Link
              href="/landlord/documents"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  📄
                </span>
                <span className="flex items-center gap-1">
                  <span>Documents &amp; e-sign</span>
                  <span className="text-[13px]">✍️</span>
                </span>
              </p>
              <p className="text-[11px] text-slate-400">
                Upload leases, share files, and send e-signature envelopes to tenants.
              </p>
            </Link>

            <Link
              href="/landlord/team"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  👥
                </span>
                Team access
              </p>
              <p className="text-[11px] text-slate-400">
                Invite or manage teammates who help manage your rentals.
              </p>
            </Link>

            <Link
              href="/landlord/settings"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  ⚙️
                </span>
                Account & billing
              </p>
              <p className="text-[11px] text-slate-400">
                Update your account details, billing info, and subscription.
              </p>
            </Link>

            <Link
              href="/landlord/listings"
              className="group rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs hover:border-emerald-500/70 hover:bg-slate-900/80 transition-colors"
            >
              <p className="mb-1 text-[11px] font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-[13px]">
                  🏷️
                </span>
                Listings
              </p>
              <p className="text-[11px] text-slate-400">
                Create a public listing page for each unit and capture inquiries in a lead inbox.
              </p>
            </Link>
          </div>
        </section>

        {/* Rent status */}
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
      </div>
    </div>
  );
}
