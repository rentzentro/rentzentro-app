'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type LandlordRow = {
  id: number;
  email: string;
  user_id: string | null; // auth.users UUID
};

type PropertyRow = {
  id: number;
  owner_id: string | null; // stored as landlord.user_id (UUID)
  name: string | null;
  unit_label: string | null;
  monthly_rent: number | null;
  status: string | null;
};

type TenantRow = {
  id: number;
  owner_id: string | null; // stored as landlord.user_id (UUID)
  name: string | null;
  email: string;
  phone: string | null;
  property_id: number | null;
  status: string | null;
  monthly_rent: number | null;
  lease_start: string | null;
  lease_end: string | null;
  allow_early_payment?: boolean | null; // NEW
};

type TeamMemberRow = {
  owner_user_id: string;
  member_user_id: string | null;
  status: string | null;
};

// ---------- Helpers ----------

const formatCurrency = (v: number | null | undefined) =>
  v == null || isNaN(v as any)
    ? '-'
    : (v as number).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      });

// Normalize a date from Supabase for <input type="date">
const toDateInputValue = (iso: string | null | undefined): string => {
  if (!iso) return '';
  // Handles both "YYYY-MM-DD" and ISO timestamps like "2025-01-01T00:00:00Z"
  return iso.slice(0, 10);
};

// Human-readable lease date label (safe for date-only or ISO)
const formatLeaseDateLabel = (value: string | null | undefined): string => {
  if (!value) return '—';

  // Prefer treating "YYYY-MM-DD" as a pure date (no timezone shift)
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]); // 1–12
    const day = Number(match[3]);
    if (!year || !month || !day) return '—';

    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Fallback for any other ISO-ish value
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// ---------- Component ----------

export default function LandlordTenantsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [landlord, setLandlord] = useState<LandlordRow | null>(null);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add-tenant form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formPropertyId, setFormPropertyId] = useState<number | ''>('');
  const [formLeaseStart, setFormLeaseStart] = useState('');
  const [formLeaseEnd, setFormLeaseEnd] = useState('');
  const [formAllowEarlyPayment, setFormAllowEarlyPayment] = useState(false); // NEW
  const [savingTenant, setSavingTenant] = useState(false);

  // Invite state
  const [inviteLoadingId, setInviteLoadingId] = useState<number | null>(null);

  // Edit-tenant state
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPropertyId, setEditPropertyId] = useState<number | ''>('');
  const [editLeaseStart, setEditLeaseStart] = useState('');
  const [editLeaseEnd, setEditLeaseEnd] = useState('');
  const [editAllowEarlyPayment, setEditAllowEarlyPayment] = useState(false); // NEW
  const [savingEdit, setSavingEdit] = useState(false);

  // ---------- Load landlord / team owner + data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        // Auth
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData.user?.email) {
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;
        const email = user.email!;

        // We want an "acting owner" user_id to drive all queries.
        let actingOwnerUserId: string | null = null;
        let landlordRecord: LandlordRow | null = null;

        // 1) Try: this user IS the landlord (user_id on landlords)
        let { data: landlordRow, error: landlordError } = await supabase
          .from('landlords')
          .select('id, email, user_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (landlordError) {
          console.error('Error loading landlord by user_id:', landlordError);
          throw new Error('Unable to load landlord account.');
        }

        if (landlordRow) {
          const typed = landlordRow as LandlordRow;
          actingOwnerUserId = typed.user_id;
          landlordRecord = typed;
        } else {
          // 2) No landlord row on this user → check if they are a team member
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
            const ownerUserId = (teamRow as TeamMemberRow).owner_user_id;
            actingOwnerUserId = ownerUserId;

            // Try to load the owning landlord row by that owner_user_id.
            const {
              data: ownerLandlord,
              error: ownerLandlordError,
            } = await supabase
              .from('landlords')
              .select('id, email, user_id')
              .eq('user_id', ownerUserId)
              .maybeSingle();

            if (ownerLandlordError) {
              console.error(
                'Error loading owner landlord from team row:',
                ownerLandlordError
              );
              // Fallback: still allow access using ownerUserId only.
              landlordRecord = {
                id: 0,
                email: 'Team owner',
                user_id: ownerUserId,
              };
            } else if (!ownerLandlord) {
              // Fallback: allow access with a stub landlord record instead of throwing.
              landlordRecord = {
                id: 0,
                email: 'Team owner',
                user_id: ownerUserId,
              };
            } else {
              landlordRecord = ownerLandlord as LandlordRow;
            }
          } else {
            // 3) As a last fallback, try older landlord rows by email
            const byEmail = await supabase
              .from('landlords')
              .select('id, email, user_id')
              .eq('email', email)
              .maybeSingle();

            if (byEmail.error) {
              console.error('Error loading landlord by email:', byEmail.error);
              throw new Error('Unable to load landlord account.');
            }

            if (!byEmail.data) {
              throw new Error(
                'Landlord account could not be found for this login.'
              );
            }

            const typedByEmail = byEmail.data as LandlordRow;
            actingOwnerUserId = typedByEmail.user_id;
            landlordRecord = typedByEmail;
          }
        }

        if (!actingOwnerUserId) {
          throw new Error('Unable to determine landlord for this account.');
        }

        setLandlord(landlordRecord);

        const ownerUuid = actingOwnerUserId; // used as FK in properties/tenants

        // Properties for this landlord (or team owner)
        const { data: propRows, error: propError } = await supabase
          .from('properties')
          .select('id, owner_id, name, unit_label, monthly_rent, status')
          .eq('owner_id', ownerUuid)
          .order('created_at', { ascending: false });

        if (propError) throw propError;
        setProperties((propRows || []) as PropertyRow[]);

        // Tenants for this landlord (or team owner)
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select(
            'id, owner_id, name, email, phone, property_id, status, monthly_rent, lease_start, lease_end, allow_early_payment'
          )
          .eq('owner_id', ownerUuid)
          .order('created_at', { ascending: false });

        if (tenantError) throw tenantError;
        setTenants((tenantRows || []) as TenantRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Failed to load tenants. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // ---------- Actions: global ----------

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  // ---------- Actions: Add tenant ----------

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormPropertyId('');
    setFormLeaseStart('');
    setFormLeaseEnd('');
    setFormAllowEarlyPayment(false);
  };

  const handleCreateTenant = async (e: FormEvent) => {
    e.preventDefault();
    if (!landlord || !landlord.user_id) return;

    setSavingTenant(true);
    setError(null);
    setSuccess(null);

    try {
      if (!formEmail.trim()) {
        throw new Error('Tenant email is required.');
      }
      if (!formPropertyId) {
        throw new Error('Please select a property for this tenant.');
      }

      const { data, error: insertError } = await supabase
        .from('tenants')
        .insert({
          owner_id: landlord.user_id, // UUID FK
          name: formName.trim() || null,
          email: formEmail.trim(),
          phone: formPhone.trim() || null,
          property_id: formPropertyId,
          status: 'Current',
          monthly_rent: null, // property is source of truth for rent
          lease_start: formLeaseStart || null,
          lease_end: formLeaseEnd || null,
          allow_early_payment: formAllowEarlyPayment, // NEW
        })
        .select('*')
        .single();

      if (insertError) {
        console.error('Error inserting tenant:', insertError);
        throw new Error(insertError.message || 'Failed to add tenant.');
      }

      setTenants((prev) => [data as TenantRow, ...prev]);
      setSuccess(
        'Tenant added successfully. You can now send them a portal invite from the tenants list.'
      );
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      setError(err?.message || 'Error adding tenant. Please try again.');
    } finally {
      setSavingTenant(false);
    }
  };

  // ---------- Actions: Edit tenant ----------

  const startEditTenant = (t: TenantRow) => {
    setEditingTenant(t);
    setEditName(t.name || '');
    setEditEmail(t.email || '');
    setEditPhone(t.phone || '');
    setEditPropertyId(t.property_id ?? '');
    setEditLeaseStart(toDateInputValue(t.lease_start));
    setEditLeaseEnd(toDateInputValue(t.lease_end));
    setEditAllowEarlyPayment(!!t.allow_early_payment); // NEW
    setError(null);
    setSuccess(null);
  };

  const cancelEditTenant = () => {
    setEditingTenant(null);
    setEditName('');
    setEditEmail('');
    setEditPhone('');
    setEditPropertyId('');
    setEditLeaseStart('');
    setEditLeaseEnd('');
    setEditAllowEarlyPayment(false);
    setSavingEdit(false);
  };

  const handleUpdateTenant = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    setSavingEdit(true);
    setError(null);
    setSuccess(null);

    try {
      if (!editEmail.trim()) {
        throw new Error('Tenant email is required.');
      }

      const { data, error: updateError } = await supabase
        .from('tenants')
        .update({
          name: editName.trim() || null,
          email: editEmail.trim(),
          phone: editPhone.trim() || null,
          property_id: editPropertyId || null,
          lease_start: editLeaseStart || null,
          lease_end: editLeaseEnd || null,
          allow_early_payment: editAllowEarlyPayment, // NEW
        })
        .eq('id', editingTenant.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Error updating tenant:', updateError);
        throw new Error(updateError.message || 'Failed to update tenant.');
      }

      setTenants((prev) =>
        prev.map((t) => (t.id === editingTenant.id ? (data as TenantRow) : t))
      );
      setSuccess('Tenant updated successfully.');
      cancelEditTenant();
    } catch (err: any) {
      setError(err?.message || 'Error updating tenant. Please try again.');
      setSavingEdit(false);
    }
  };

  // ---------- Actions: Delete tenant ----------

  const handleDeleteTenant = async (tenantId: number) => {
    if (!window.confirm('Delete this tenant? This cannot be undone.')) return;

    setError(null);
    setSuccess(null);

    try {
      const { error: delError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);

      if (delError) {
        console.error('Error deleting tenant:', delError);
        throw new Error(delError.message || 'Failed to delete tenant.');
      }

      setTenants((prev) => prev.filter((t) => t.id !== tenantId));
      if (editingTenant && editingTenant.id === tenantId) {
        cancelEditTenant();
      }
      setSuccess('Tenant deleted.');
    } catch (err: any) {
      setError(err?.message || 'Error deleting tenant.');
    }
  };

  // ---------- Actions: Send invite ----------

  const handleSendInvite = async (
    tenant: TenantRow,
    property?: PropertyRow | null
  ) => {
    if (!tenant.email) {
      setError('This tenant does not have an email on file.');
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setInviteLoadingId(tenant.id);

    try {
      const res = await fetch('/api/tenant-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantEmail: tenant.email,
          tenantName: tenant.name,
          propertyName: property?.name,
          unitLabel: property?.unit_label,
          landlordName: landlord?.email, // later can be a landlord name field
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.error) {
        console.error('Invite error:', data);
        setError(
          data?.error ||
            `Failed to send portal invite to ${tenant.email}. Please try again.`
        );
        setSuccess(null);
      } else {
        setSuccess(
          'Portal invite sent. Your tenant will receive an email with their signup link.'
        );
      }
    } catch (err: any) {
      console.error('Invite error:', err);
      setError('Something went wrong sending the portal invite.');
      setSuccess(null);
    } finally {
      setInviteLoadingId(null);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading tenants…</p>
      </main>
    );
  }

  if (error && !landlord) {
    // Only block the page if we truly couldn't resolve *any* landlord context
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => router.push('/landlord/login')}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to login
          </button>
        </div>
      </main>
    );
  }

  const propertyById = new Map<number, PropertyRow>();
  properties.forEach((p) => propertyById.set(p.id, p));

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header / breadcrumb */}
        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-1 items-center">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Tenants</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              Manage tenants
            </h1>
            <p className="text-[13px] text-slate-400">
              Add or remove tenants, link them to properties, set lease dates,
              and send portal invites.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
            >
              {showForm ? 'Close add tenant form' : 'Add tenant'}
            </button>
            <Link
              href="/landlord"
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Alerts */}
        {(success || error) && (
          <div
            className={`rounded-xl border px-4 py-2 text-sm ${
              success
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : 'border-red-500/60 bg-red-500/10 text-red-200'
            }`}
          >
            {success || error}
          </div>
        )}

        {/* Add tenant form */}
        {showForm && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm space-y-4">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Add a tenant
              </p>
              <p className="mt-1 text-sm text-slate-200">
                Create a tenant linked to one of your properties and set their
                lease dates.
              </p>
            </div>

            {properties.length === 0 ? (
              <p className="text-xs text-amber-300">
                You don&apos;t have any properties yet. Add a property first
                from the{' '}
                <Link href="/landlord/properties" className="underline">
                  properties screen
                </Link>
                .
              </p>
            ) : (
              <form
                onSubmit={handleCreateTenant}
                className="grid gap-3 md:grid-cols-2 text-xs"
              >
                <div className="space-y-1 md:col-span-1">
                  <label className="block text-slate-300">Tenant name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <label className="block text-slate-300">
                    Tenant email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="name@example.com"
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <label className="block text-slate-300">Tenant phone</label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <label className="block text-slate-300">
                    Property <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formPropertyId === '' ? '' : String(formPropertyId)}
                    onChange={(e) =>
                      setFormPropertyId(
                        e.target.value ? Number(e.target.value) : ''
                      )
                    }
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select a property…</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || 'Unnamed property'}
                        {p.unit_label ? ` · ${p.unit_label}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lease dates */}
                <div className="space-y-1 md:col-span-1">
                  <label className="block text-slate-300">Lease start</label>
                  <input
                    type="date"
                    value={formLeaseStart}
                    onChange={(e) => setFormLeaseStart(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1 md:col-span-1">
                  <label className="block text-slate-300">Lease end</label>
                  <input
                    type="date"
                    value={formLeaseEnd}
                    onChange={(e) => setFormLeaseEnd(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Allow early payments */}
                <div className="md:col-span-2 mt-1">
                  <label className="flex items-center gap-2 text-[11px] text-slate-200">
                    <input
                      type="checkbox"
                      className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                      checked={formAllowEarlyPayment}
                      onChange={(e) =>
                        setFormAllowEarlyPayment(e.target.checked)
                      }
                    />
                    <span>
                      Allow this tenant to pay rent before the due date
                    </span>
                  </label>
                  <p className="mt-1 text-[10px] text-slate-500">
                    If unchecked, the tenant portal will only allow payments
                    once rent is due.
                  </p>
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
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
                    disabled={savingTenant || properties.length === 0}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingTenant ? 'Saving…' : 'Save tenant'}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* Edit tenant form */}
        {editingTenant && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">
                  Edit tenant
                </p>
                <p className="mt-1 text-sm text-slate-200">
                  Update details for {editingTenant.name || editingTenant.email}.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelEditTenant}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleUpdateTenant}
              className="grid gap-3 md:grid-cols-2 text-xs"
            >
              <div className="space-y-1 md:col-span-1">
                <label className="block text-slate-300">Tenant name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="block text-slate-300">
                  Tenant email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="block text-slate-300">Tenant phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="block text-slate-300">Property</label>
                <select
                  value={editPropertyId === '' ? '' : String(editPropertyId)}
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
                      {p.name || 'Unnamed property'}
                      {p.unit_label ? ` · ${p.unit_label}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Lease dates */}
              <div className="space-y-1 md:col-span-1">
                <label className="block text-slate-300">Lease start</label>
                <input
                  type="date"
                  value={editLeaseStart}
                  onChange={(e) => setEditLeaseStart(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="space-y-1 md:col-span-1">
                <label className="block text-slate-300">Lease end</label>
                <input
                  type="date"
                  value={editLeaseEnd}
                  onChange={(e) => setEditLeaseEnd(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Allow early payments (edit) */}
              <div className="md:col-span-2 mt-1">
                <label className="flex items-center gap-2 text-[11px] text-slate-200">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-slate-600 bg-slate-900"
                    checked={editAllowEarlyPayment}
                    onChange={(e) =>
                      setEditAllowEarlyPayment(e.target.checked)
                    }
                  />
                  <span>
                    Allow this tenant to pay rent before the due date
                  </span>
                </label>
                <p className="mt-1 text-[10px] text-slate-500">
                  This controls whether the tenant portal will allow early rent
                  payments for this tenant.
                </p>
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelEditTenant}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingEdit ? 'Saving changes…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Tenants list */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                Tenants
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                All tenants linked to your properties
              </p>
            </div>
          </div>

          {tenants.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              You haven&apos;t added any tenants yet.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-xs">
              {tenants.map((t) => {
                const prop =
                  t.property_id != null ? propertyById.get(t.property_id) : null;
                const earlyAllowed = !!t.allow_early_payment;

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-50 truncate">
                        {t.name || t.email}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {t.email}{' '}
                        {t.phone ? (
                          <>
                            • <span>{t.phone}</span>
                          </>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Property:{' '}
                        {prop
                          ? `${prop.name || 'Property'}${
                              prop.unit_label ? ` · ${prop.unit_label}` : ''
                            }`
                          : 'Not linked'}
                      </p>
                      {(t.lease_start || t.lease_end) && (
                        <p className="text-[11px] text-slate-500">
                          Lease:{' '}
                          {formatLeaseDateLabel(t.lease_start)} to{' '}
                          {formatLeaseDateLabel(t.lease_end)}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Early payments:{' '}
                        <span
                          className={
                            earlyAllowed
                              ? 'text-emerald-300'
                              : 'text-slate-300'
                          }
                        >
                          {earlyAllowed ? 'Allowed' : 'Not allowed'}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-[11px]">
                      <p className="text-slate-400">
                        Status:{' '}
                        <span className="text-slate-100">
                          {t.status || 'Not set'}
                        </span>
                      </p>
                      {prop?.monthly_rent != null && (
                        <p className="text-slate-400">
                          Rent:{' '}
                          <span className="text-slate-100">
                            {formatCurrency(prop.monthly_rent)}
                          </span>
                        </p>
                      )}

                      <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleSendInvite(t, prop)}
                          disabled={inviteLoadingId === t.id}
                          className="rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {inviteLoadingId === t.id
                            ? 'Sending…'
                            : 'Send portal invite'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditTenant(t)}
                          className="rounded-full border border-sky-500/60 bg-sky-500/10 px-3 py-1 text-[11px] text-sky-100 hover:bg-sky-500/20"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTenant(t.id)}
                          className="rounded-full border border-rose-500/60 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-100 hover:bg-rose-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
