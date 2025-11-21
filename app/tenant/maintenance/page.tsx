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
  created_at: string;
  tenant_id: number | null;
  property_id: number | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
};

// ---------- Component ----------

const emptyForm = {
  title: '',
  description: '',
  priority: 'normal' as 'low' | 'normal' | 'high' | 'emergency',
};

export default function TenantMaintenancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [requests, setRequests] = useState<MaintenanceRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // ---------- Load tenant + property + existing requests ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
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
        const t = (tenantRows || [])[0] as TenantRow | undefined;
        if (!t) {
          throw new Error(
            "We couldn't find your tenant record. Please contact your landlord."
          );
        }
        setTenant(t);

        // Property
        let prop: PropertyRow | null = null;
        if (t.property_id) {
          const { data: propRows, error: propError } = await supabase
            .from('properties')
            .select('id, name, unit_label, landlord_email')
            .eq('id', t.property_id)
            .limit(1);

          if (propError) throw propError;
          prop = ((propRows || [])[0] as PropertyRow | undefined) || null;
        }
        setProperty(prop);

        // Existing maintenance requests for this tenant
        const { data: reqRows, error: reqError } = await supabase
          .from('maintenance_requests')
          .select('*')
          .eq('tenant_id', t.id)
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;
        setRequests((reqRows || []) as MaintenanceRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load maintenance requests. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---------- Handlers ----------

  const handleBack = () => {
    router.back();
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant) {
      setError('Missing tenant information.');
      return;
    }

    setError(null);
    setSuccess(null);

    if (!form.title.trim() || !form.description.trim()) {
      setError('Please provide a title and description for your request.');
      return;
    }

    setSubmitting(true);

    try {
      // 1) Insert into maintenance_requests
      const { data: insertData, error: insertError } = await supabase
        .from('maintenance_requests')
        .insert({
          tenant_id: tenant.id,
          property_id: property?.id ?? null,
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
          status: 'new',
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      // Optimistically update list in UI
      setRequests((prev) => [insertData as MaintenanceRow, ...prev]);

      // 2) Email to landlord (ONLY if property has an email)
      const landlordEmail = property?.landlord_email || '';

      if (landlordEmail) {
        // Note: even if this fails, the request itself is still saved.
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
      }

      setForm(emptyForm);
      setSuccess('Your maintenance request has been submitted.');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong submitting your request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- UI ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading maintenance requests…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back
            </button>
            <h1 className="mt-2 text-2xl font-semibold">Maintenance requests</h1>
            <p className="text-xs text-slate-400 mt-1">
              Submit a maintenance request for your unit and track its status.
            </p>
          </div>

          {property && (
            <div className="text-right text-xs text-slate-400">
              <p className="text-slate-200 font-medium">
                {property.name || 'Property'}
              </p>
              {property.unit_label && (
                <p className="text-slate-500">Unit {property.unit_label}</p>
              )}
            </div>
          )}
        </header>

        {/* Alerts */}
        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}

        {/* Emergency note */}
        <section className="rounded-2xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
          <p className="font-semibold">Emergency issues</p>
          <p className="mt-1 text-[11px]">
            For fire, gas leaks, major water damage, or other emergencies, call
            local emergency services first, then notify your landlord or
            property manager directly. Do not rely on RentZentro for emergency
            response.
          </p>
        </section>

        {/* Form + list */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.1fr)]">
          {/* New request form */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-100">
              Submit a new request
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Provide as much detail as possible so your landlord can respond
              quickly.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Example: Kitchen sink leaking under cabinet"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Describe what’s happening, how long it’s been an issue, and any access notes for your landlord."
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={handleChange}
                    className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency (already called)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-4 md:mt-6 inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          </section>

          {/* Existing requests */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm text-xs">
            <h2 className="text-sm font-semibold text-slate-100">
              Your maintenance history
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Track the status of requests you’ve sent to your landlord.
            </p>

            {requests.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                You haven&apos;t submitted any maintenance requests yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-slate-100 truncate">
                        {r.title || 'Maintenance request'}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-200">
                        Status: {r.status || 'new'}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                      {r.description || 'No description provided.'}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>{new Date(r.created_at).toLocaleString()}</span>
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
