'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  property_id: number | null;
};

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
  landlord_email: string | null;
};

type MaintenanceRow = {
  id: number;
  tenant_id: number;
  property_id: number;
  title: string;
  description: string;
  status: string | null;
  priority: string | null;
  created_at: string;
  resolution_note: string | null; // 👈 landlord note
};

// ---------- Helpers ----------

const emptyForm = {
  title: '',
  description: '',
  priority: 'Normal',
};

const formatStatusLabel = (status: string | null) => {
  if (!status) return 'Unknown';
  const s = status.toLowerCase();
  if (s === 'new') return 'New';
  if (s === 'in progress') return 'In Progress';
  if (s === 'resolved' || s === 'closed') return 'Resolved';
  return status;
};

const statusBadgeClasses = (status: string | null) => {
  const s = (status || '').toLowerCase();
  if (s === 'new') {
    return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40';
  }
  if (s === 'in progress') {
    return 'bg-amber-500/15 text-amber-300 border border-amber-500/40';
  }
  if (s === 'resolved' || s === 'closed') {
    return 'bg-sky-500/15 text-sky-300 border border-sky-500/40';
  }
  return 'bg-slate-700 text-slate-200 border border-slate-500/60';
};

// ---------- Component ----------

export default function TenantMaintenancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [requests, setRequests] = useState<MaintenanceRow[]>([]);

  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ---------- Load data ----------

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Auth
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const email = authData.user?.email;
        if (!email) {
          throw new Error('Unable to load tenant: missing email.');
        }

        // Tenant by email
        const { data: tenantRows, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('email', email)
          .limit(1);

        if (tenantError) throw tenantError;

        const tenantRow = (tenantRows && tenantRows[0]) || null;
        if (!tenantRow) {
          throw new Error('Tenant not found for logged-in user.');
        }

        setTenant(tenantRow);

        if (!tenantRow.property_id) {
          throw new Error('Tenant is not assigned to a property.');
        }

        // Property info
        const { data: propertyRow, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', tenantRow.property_id)
          .single();

        if (propertyError) throw propertyError;
        setProperty(propertyRow);

        // Existing maintenance requests for this tenant (includes resolution_note)
        const { data: maintenanceRows, error: maintenanceError } =
          await supabase
            .from('maintenance_requests')
            .select('*')
            .eq('tenant_id', tenantRow.id)
            .order('created_at', { ascending: false });

        if (maintenanceError) throw maintenanceError;

        setRequests((maintenanceRows || []) as MaintenanceRow[]);
      } catch (err: any) {
        console.error('Error loading tenant maintenance:', err);
        setError(err?.message || 'Failed to load maintenance data.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // ---------- Handlers ----------

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!tenant || !property) {
      setError('Unable to submit request: tenant or property missing.');
      setSuccess(null);
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      setError('Please provide both a title and description.');
      setSuccess(null);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // 1) Insert into Supabase with status 'new'
      const { data: insertData, error: insertError } = await supabase
        .from('maintenance_requests')
        .insert({
          tenant_id: tenant.id,
          property_id: property.id,
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          status: 'new',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setRequests((prev) => [insertData as MaintenanceRow, ...prev]);

      // 2) Email to landlord (route handles fallbacks)
      const landlordEmail = property?.landlord_email || '';

      fetch('/api/maintenance-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landlordEmail,
          tenantName: tenant.name,
          tenantEmail: tenant.email,
          propertyName: property?.name,
          unitLabel: property?.unit_label,
          title: form.title,
          description: form.description,
          priority: form.priority,
        }),
      }).catch((err) => {
        console.error('Maintenance email fire-and-forget error:', err);
      });

      setForm(emptyForm);
      setSuccess('Maintenance request submitted successfully.');
      setError(null);
    } catch (err: any) {
      console.error('Error submitting maintenance request:', err);
      setError(
        err?.message ||
          'Something went wrong while submitting your maintenance request.'
      );
      setSuccess(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  const handleBack = () => {
    router.push('/tenant/portal');
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">
          Loading maintenance requests…
        </p>
      </main>
    );
  }

  if (error && !tenant) {
    // Fatal load error (no tenant)
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl">
          <p className="mb-4 text-sm text-red-400">{error}</p>
          <button
            onClick={() => router.push('/tenant/login')}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400"
          >
            Back to Tenant Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-4">
        {/* Global action banner */}
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

        {/* Header */}
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back to tenant portal
            </button>
            <h1 className="text-lg font-semibold text-slate-50">
              Maintenance requests
            </h1>
            {tenant && (
              <p className="text-[11px] text-slate-400">
                Signed in as{' '}
                <span className="font-medium text-slate-100">
                  {tenant.email}
                </span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {property && (
              <div className="hidden text-right text-[11px] sm:block">
                <p className="text-slate-400">Property</p>
                <p className="font-medium text-slate-100">
                  {property.name || 'Unnamed property'}
                </p>
                <p className="text-slate-500">
                  Unit: {property.unit_label || 'N/A'}
                </p>
              </div>
            )}
            <button
              onClick={handleLogout}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Property summary (mobile) */}
        {property && (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm sm:hidden">
            <h2 className="mb-1 text-xs font-semibold text-slate-100">
              Your property
            </h2>
            <p className="text-sm text-slate-50">
              {property.name || 'Unnamed property'}
            </p>
            <p className="text-[11px] text-slate-400">
              Unit: {property.unit_label || 'N/A'}
            </p>
            {property.landlord_email && (
              <p className="mt-1 text-[11px] text-slate-500">
                Landlord contact: {property.landlord_email}
              </p>
            )}
          </section>
        )}

        {/* Form + list */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
          {/* New request form */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Submit a new request
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-200">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  placeholder="Brief summary of the issue"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-200">
                  Priority
                </label>
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                >
                  <option>Normal</option>
                  <option>Urgent</option>
                  <option>Emergency</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-200">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  rows={4}
                  placeholder="Describe the issue in as much detail as possible."
                  required
                />
                <p className="mt-1 text-[10px] text-slate-500">
                  For emergencies (fire, active flooding, gas smells, etc.),
                  call your local emergency services first, then contact your
                  landlord or property manager directly.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-md bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </form>
          </section>

          {/* Existing requests list */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100">
                Your recent requests
              </h2>
              <span className="text-[11px] text-slate-400">
                {requests.length} total
              </span>
            </div>

            {requests.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                You haven&apos;t submitted any maintenance requests yet.
              </p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-slate-50 break-words">
                          {r.title}
                        </h3>
                        <p className="mt-1 text-[11px] text-slate-300 break-words whitespace-pre-wrap">
                          {r.description}
                        </p>

                        {/* landlord note */}
                        {r.resolution_note && (
                          <div className="mt-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              Landlord note
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-200 whitespace-pre-wrap break-words">
                              {r.resolution_note}
                            </p>
                          </div>
                        )}
                      </div>
                      <span
                        className={
                          'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ' +
                          statusBadgeClasses(r.status)
                        }
                      >
                        {formatStatusLabel(r.status)}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span className="truncate">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                      {r.priority && <span>Priority: {r.priority}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
