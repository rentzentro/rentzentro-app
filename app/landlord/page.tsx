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
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  trial_active: boolean | null;
  trial_end: string | null;
  user_id?: string | null; // NEW: owner auth user id
};

type TeamMemberRow = {
  owner_user_id: string;
  member_user_id: string | null;
  status: string | null;
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

// ---------- Helpers ----------

const formatCurrency = (v: number | null | undefined) =>
  v == null || isNaN(v)
    ? '-'
    : v.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';

  const local = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds()
  );

  return local.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const parseDueDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// ---------- Component ----------

export default function LandlordDashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRow[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // ---------- Load landlord or team member + data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) Get auth user
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData.user;
        if (!user) {
          throw new Error('Please log in to access your landlord dashboard.');
        }

        const userEmail = user.email || '';
        let landlordRow: LandlordRow | null = null;
        let ownerUuid: string | null = null;
        let teamRow: TeamMemberRow | null = null;

        // 2) Try: this user is the landlord owner (preferred: by user_id)
        {
          const { data, error } = await supabase
            .from('landlords')
            .select(
              `
              id,
              email,
              name,
              subscription_status,
              subscription_current_period_end,
              trial_active,
              trial_end,
              user_id
            `
            )
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) {
            console.error('Error loading landlord by user_id:', error);
            throw error;
          }

          if (data) {
            landlordRow = data as LandlordRow;
            ownerUuid = landlordRow.user_id || user.id;
          }
        }

        // 3) Fallback: older landlord rows that only have email
        if (!landlordRow && userEmail) {
          const { data, error } = await supabase
            .from('landlords')
            .select(
              `
              id,
              email,
              name,
              subscription_status,
              subscription_current_period_end,
              trial_active,
              trial_end,
              user_id
            `
            )
            .eq('email', userEmail)
            .maybeSingle();

          if (error) {
            console.error('Error loading landlord by email:', error);
            throw error;
          }

          if (data) {
            landlordRow = data as LandlordRow;
            ownerUuid = landlordRow.user_id || null;

            // If this is an old row missing user_id, patch it to this user for future
            if (!landlordRow.user_id) {
              await supabase
                .from('landlords')
                .update({ user_id: user.id })
                .eq('id', landlordRow.id);
              ownerUuid = user.id;
              landlordRow.user_id = user.id;
            }
          }
        }

        // 4) If still no landlord row, check if this user is a TEAM MEMBER
        if (!landlordRow) {
          // First look for an already-linked active team record
          const { data: existingTeam, error: existingTeamError } = await supabase
            .from('landlord_team_members')
            .select('owner_user_id, member_user_id, status')
            .eq('member_user_id', user.id)
            .maybeSingle();

          if (existingTeamError) {
            console.error('Error loading team membership by member_user_id:', existingTeamError);
            throw existingTeamError;
          }

          if (existingTeam && existingTeam.status === 'active') {
            teamRow = existingTeam as TeamMemberRow;
          }

          // If no linked team row yet, see if there is a pending invite by email
          if (!teamRow && userEmail) {
            const { data: pendingInvite, error: pendingError } = await supabase
              .from('landlord_team_members')
              .select('id, owner_user_id, member_user_id, status, invite_email')
              .eq('invite_email', userEmail.toLowerCase())
              .eq('status', 'pending')
              .maybeSingle();

            if (pendingError) {
              console.error('Error loading pending invite by email:', pendingError);
              throw pendingError;
            }

            if (pendingInvite) {
              // Auto-link this invite to the currently logged-in user
              const { error: linkError } = await supabase
                .from('landlord_team_members')
                .update({
                  member_user_id: user.id,
                  status: 'active',
                  accepted_at: new Date().toISOString(),
                  member_email: userEmail.toLowerCase(),
                })
                .eq('id', pendingInvite.id);

              if (linkError) {
                console.error('Error auto-linking team invite:', linkError);
                throw linkError;
              }

              teamRow = {
                owner_user_id: pendingInvite.owner_user_id,
                member_user_id: user.id,
                status: 'active',
              };
            }
          }

          if (teamRow && teamRow.status === 'active') {
            setIsTeamMember(true);
            ownerUuid = teamRow.owner_user_id;

            // Load the landlord row for the OWNER using owner_user_id
            const { data: ownerLandlord, error: ownerError } = await supabase
              .from('landlords')
              .select(
                `
                id,
                email,
                name,
                subscription_status,
                subscription_current_period_end,
                trial_active,
                trial_end,
                user_id
              `
              )
              .eq('user_id', ownerUuid)
              .maybeSingle();

            if (ownerError) {
              console.error('Error loading owner landlord row for team member:', ownerError);
              throw ownerError;
            }

            if (!ownerLandlord) {
              throw new Error(
                'Your team access is active, but the owner landlord account could not be found.'
              );
            }

            landlordRow = ownerLandlord as LandlordRow;
          }
        }

        // 5) If STILL nothing, then this email/user truly has no landlord or team access
        if (!landlordRow) {
          throw new Error(
            "The email you signed in with isn't connected to a RentZentro landlord profile yet."
          );
        }

        setLandlord(landlordRow);

        // 6) Load dashboard data (RLS + team policies will scope data for both owner + team)
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
            .limit(10),
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

        // 7) Unread messages count for this landlord (non-breaking)
        try {
          const { data: msgRows, error: msgError } = await supabase
            .from('landlord_messages')
            .select('id, is_read, recipient_role')
            .eq('recipient_role', 'landlord')
            .eq('is_read', false);

          if (msgError) {
            console.error('Unread messages query error:', msgError);
          } else if (msgRows) {
            setUnreadMessagesCount(msgRows.length);
          }
        } catch (msgErr) {
          console.error('Unread messages query threw:', msgErr);
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err.message ||
            'Failed to load landlord dashboard data.'
        );
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

  const monthlyRentRoll = properties
    .filter((p) => p.status?.toLowerCase() === 'current')
    .reduce((sum, p) => sum + (p.monthly_rent || 0), 0);

  const today = new Date();
  const todayDateOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const sevenDaysFromNow = new Date(
    todayDateOnly.getFullYear(),
    todayDateOnly.getMonth(),
    todayDateOnly.getDate() + 7
  );

  const overdue = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return false;
    return due < todayDateOnly;
  });

  const upcoming7 = properties.filter((p) => {
    const due = parseDueDate(p.next_due_date);
    if (!due) return false;
    return due >= todayDateOnly && due <= sevenDaysFromNow;
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

  // Subscription / trial status
  let hasActiveTrial = false;
  let subscribedViaStripe = false;

  if (landlord) {
    const statusLower = (landlord.subscription_status || '').toLowerCase();
    subscribedViaStripe =
      statusLower === 'active' ||
      statusLower === 'trialing' ||
      statusLower === 'active_cancel_at_period_end';

    if (landlord.trial_active) {
      if (landlord.trial_end) {
        const trialEndDate = new Date(landlord.trial_end);
        const trialEndDateOnly = new Date(
          trialEndDate.getFullYear(),
          trialEndDate.getMonth(),
          trialEndDate.getDate()
        );
        hasActiveTrial = trialEndDateOnly >= todayDateOnly;
      } else {
        hasActiveTrial = true;
      }
    }
  }

  const isSubscribedOrTrial = subscribedViaStripe || hasActiveTrial;

  // ---------- Actions ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const goToSubscription = () => {
    router.push('/landlord/settings');
  };

  // ---------- UI ----------

  if (loading && !landlord && !error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading landlord dashboard…</p>
      </div>
    );
  }

  if (!landlord) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-red-500/60 p-5 space-y-3 text-center">
          <p className="text-base font-semibold text-red-200 mb-1">
            Landlord account not found.
          </p>
          <p className="text-sm text-slate-200">
            {error ||
              "The email you signed in with isn't connected to a RentZentro landlord profile yet."}
          </p>
          <p className="text-[11px] text-slate-400">
            If you were invited as a team member, make sure you opened the link from
            your invite email and signed in with that same address.
          </p>
          <button
            onClick={handleSignOut}
            className="mt-3 w-full rounded-full bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to landlord login
          </button>
        </div>
      </div>
    );
  }

  // HARD GATE: must have active Stripe sub OR active free trial
  if (!isSubscribedOrTrial) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl bg-slate-900/80 border border-amber-500/60 p-6 shadow-xl space-y-4 text-center">
          <p className="text-xs text-amber-300 font-semibold uppercase tracking-wide">
            Subscription required
          </p>
          <h1 className="text-lg font-semibold text-slate-50">
            Unlock your RentZentro landlord tools
          </h1>
          <p className="text-sm text-slate-300">
            Your landlord account is created, but your subscription isn&apos;t active
            and your free promo period has ended. To access your dashboard, properties,
            tenants, and online rent collection, please activate the{' '}
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
            </ul>
          </div>

          <button
            onClick={goToSubscription}
            className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Go to subscription settings
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

  // If we're here: landlord exists AND has active trial or subscription → show full dashboard
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
              {isTeamMember ? 'Team access dashboard' : 'Landlord dashboard'}
            </h1>
            <p className="text-[13px] text-slate-400">
              Overview of your units, rent status, and recent payments.
            </p>
          </div>

          {/* Top-right: Log out pill */}
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

        {/* Error */}
        {error && (
          <div className="mb-4 text-sm p-3 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-rose-100">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-950/80 border border-slate-800 shadow-sm">
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Properties
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {totalProperties}
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
                Documents
              </p>
              <p className="text-[11px] text-slate-400">
                Upload and share leases, notices, and other files with tenants.
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

            {/* NEW: Team access quick action */}
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
                Invite teammates and manage who can access your landlord dashboard.
              </p>
            </Link>
          </div>
        </section>

        {/* Rent status: overdue / upcoming / not due yet */}
        <section className="mb-6 p-4 rounded-2xl bg-slate-950/70 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Rent status
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Overdue, upcoming, and future rent
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
                  {overdue.map((p) => (
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
                        {formatCurrency(p.monthly_rent)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming 7 days */}
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-amber-200">
                  Upcoming 7 days
                </p>
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
                <p className="font-semibold text-emerald-200">
                  Not due yet
                </p>
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
                          {p.method || 'Method not specified'}
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
              Card payments from tenants are recorded here automatically after
              Stripe confirms the payment.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
