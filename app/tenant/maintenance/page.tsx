'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

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
};

type MaintenanceRequestRow = {
  id: number;
  created_at: string;
  updated_at: string;
  tenant_id: number | null;
  property_id: number | null;
  status: string;
  priority: string;
  category: string | null;
  description: string;
  resolution_note: string | null;
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function TenantMaintenancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get auth user
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const email = authData.user?.email;
        if (!email) throw new Error('Unable to load tenant: missing email.');

        // Find tenant by email
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

        // Load property if assigned
        let prop: PropertyRow | null = null;
        if (t.property_id) {
          const { data: propRows, error: propError } = await supabase
            .from('properties')
            .select('id, name, unit_label')
            .eq('id', t.property_id)
            .limit(1);

          if (propError) throw propError;
          prop = (propRows || [])[0] as PropertyRow | undefined || null;
        }
        setProperty(prop);

        // Load existing maintenance requests for this tenant
        const { data: reqRows, error: reqError } = await supabase
          .from('maintenance_requests')
          .select('*')
          .eq('tenant_id', t.id)
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;
        setRequests((reqRows || []) as MaintenanceRequestRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load maintenance requests. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tenant) return;

    if (!description.trim()) {
      setError('Please describe the issue before submitting.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data, error: insertError } = await supabase
        .from('maintenance_requests')
        .insert({
          tenant_id: tenant.id,
          property_id: tenant.property_id,
          status: 'new',
          priority,
          category: category.trim() || null,
          description: description.trim(),
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      setRequests((prev) => [data as MaintenanceRequestRow, ...prev]);
      setCategory('');
      setPriority('normal');
      setDescription('');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Failed to submit your request. Please try again or contact your landlord.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back
            </button>
            <h1 className="mt-2 text-xl font-semibold text-slate-50">
              Maintenance requests
            </h1>
            <p className="text-[13px] text-slate-400">
              Submit a new request and see updates from your landlord.
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p className="text-slate-300 font-medium">
              {tenant?.name || 'Tenant account'}
            </p>
            <p className="truncate max-w-[200px]">{tenant?.email}</p>
            {property && (
              <p className="mt-1 text-[11px] text-slate-500">
                {property.name || 'Property'}
                {property.unit_label ? ` · ${property.unit_label}` : ''}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* New request form */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            New request
          </p>
          <p className="mt-1 text-sm text-slate-200">
            Describe the issue so your landlord can review and schedule work.
          </p>

          <form onSubmit={handleSubmit} className="mt-4 grid gap-3 md:grid-cols-3 text-sm">
            <div className="space-y-3 md:col-span-1">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ex: Plumbing, Heating, Appliance"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as 'low' | 'normal' | 'high' | 'urgent')
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:ring-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col">
              <label className="block text-[11px] text-slate-400 mb-1">
                Description of the issue
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe what’s wrong, where it is, and any details that might help. Example: Kitchen sink is leaking under the cabinet."
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-emerald-500"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || loading}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Existing requests */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm text-xs">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide">
            Your requests
          </p>

          {loading ? (
            <p className="mt-3 text-xs text-slate-400">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
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
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor:
                            r.status === 'completed'
                              ? 'rgba(16,185,129,0.15)'
                              : r.status === 'in_progress'
                              ? 'rgba(245,158,11,0.15)'
                              : 'rgba(248,113,113,0.12)',
                          color:
                            r.status === 'completed'
                              ? '#6ee7b7'
                              : r.status === 'in_progress'
                              ? '#fbbf24'
                              : '#fb7185',
                          borderColor:
                            r.status === 'completed'
                              ? 'rgba(16,185,129,0.5)'
                              : r.status === 'in_progress'
                              ? 'rgba(245,158,11,0.5)'
                              : 'rgba(248,113,113,0.5)',
                          borderWidth: 1,
                        }}
                      >
                        {r.status === 'new'
                          ? 'New'
                          : r.status === 'in_progress'
                          ? 'In progress'
                          : 'Completed'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {r.priority.charAt(0).toUpperCase() + r.priority.slice(1)} priority
                        {r.category ? ` • ${r.category}` : ''}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {formatDateTime(r.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-200">
                    {r.description}
                  </p>
                  {r.resolution_note && (
                    <p className="mt-1 text-[11px] text-emerald-200">
                      Update from landlord: {r.resolution_note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500">
            For emergencies (gas leak, fire, major water damage), contact local
            emergency services first, then notify your landlord.
          </p>
        </section>
      </div>
    </div>
  );
}
