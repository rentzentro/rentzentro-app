'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
};

type MaintenanceRow = {
  id: number;
  created_at: string;
  updated_at: string | null;
  tenant_id: number | null;
  property_id: number | null;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  resolution_note: string | null;
};

// ---------- Helpers ----------

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

// ---------- Component ----------

export default function LandlordMaintenancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<MaintenanceRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);

  // Local drafts for the resolution text so typing feels normal
  const [resolutionDrafts, setResolutionDrafts] = useState<
    Record<number, string>
  >({});

  const tenantById = new Map<number, TenantRow>();
  tenants.forEach((t) => tenantById.set(t.id, t));

  const propertyById = new Map<number, PropertyRow>();
  properties.forEach((p) => propertyById.set(p.id, p));

  // ---------- Load data ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [reqRes, tenantRes, propRes] = await Promise.all([
          supabase
            .from('maintenance_requests')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('tenants')
            .select('id, name, email, phone, property_id'),
          supabase.from('properties').select('id, name, unit_label'),
        ]);

        if (reqRes.error) throw reqRes.error;
        if (tenantRes.error) throw tenantRes.error;
        if (propRes.error) throw propRes.error;

        const reqData = (reqRes.data || []) as MaintenanceRow[];
        const tenantData = (tenantRes.data || []) as TenantRow[];
        const propData = (propRes.data || []) as PropertyRow[];

        setRequests(reqData);
        setTenants(tenantData);
        setProperties(propData);

        // Initialize resolution drafts from existing data
        const drafts: Record<number, string> = {};
        reqData.forEach((r) => {
          drafts[r.id] = r.resolution_note || '';
        });
        setResolutionDrafts(drafts);
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

  // ---------- Actions ----------

  const handleBack = () => {
    router.back();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/landlord/login');
  };

  const updateRequest = async (
    id: number,
    updates: Partial<
      Pick<MaintenanceRow, 'status' | 'priority' | 'resolution_note'>
    >
  ) => {
    setSavingId(id);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('maintenance_requests')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local list
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Failed to update this maintenance request. Please try again.'
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleStatusChange = (id: number, value: string) => {
    updateRequest(id, { status: value });
  };

  const handlePriorityChange = (id: number, value: string) => {
    updateRequest(id, { priority: value });
  };

  const handleResolutionChange = (id: number, value: string) => {
    setResolutionDrafts((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  const handleResolutionBlur = (id: number) => {
    const draft = resolutionDrafts[id] ?? '';
    updateRequest(id, { resolution_note: draft });
  };

  const handleResolutionSave = (id: number) => {
    const draft = resolutionDrafts[id] ?? '';
    updateRequest(id, { resolution_note: draft });
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back
            </button>
            <h1 className="mt-2 text-2xl font-semibold">Maintenance overview</h1>
            <p className="text-xs text-slate-400 mt-1">
              Track and update maintenance requests from your tenants.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <Link
              href="/landlord"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800"
            >
              Log out
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Requests list */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">
                All maintenance requests
              </p>
              <p className="mt-1 text-sm font-medium text-slate-50">
                Update status, priority, and resolution notes.
              </p>
            </div>
            <p className="text-[11px] text-slate-500">
              Total requests: {requests.length}
            </p>
          </div>

          {requests.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              No maintenance requests yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {requests.map((r) => {
                const t = r.tenant_id ? tenantById.get(r.tenant_id) : null;
                const p = r.property_id ? propertyById.get(r.property_id) : null;
                const saving = savingId === r.id;

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3 text-xs"
                  >
                    {/* Top row: Status + Priority + date */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
                      <div className="flex flex-wrap gap-3">
                        {/* Status with label */}
                        <div className="flex flex-col">
                          <span className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                            Status
                          </span>
                          <select
                            value={r.status || 'new'}
                            onChange={(e) =>
                              handleStatusChange(r.id, e.target.value)
                            }
                            className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="new">New</option>
                            <option value="in_progress">In progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>

                        {/* Priority with label */}
                        <div className="flex flex-col">
                          <span className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">
                            Priority
                          </span>
                          <select
                            value={r.priority || 'normal'}
                            onChange={(e) =>
                              handlePriorityChange(r.id, e.target.value)
                            }
                            className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="emergency">Emergency</option>
                          </select>
                        </div>
                      </div>

                      <div className="text-right text-[11px] text-slate-500">
                        {formatDateTime(r.created_at)}
                      </div>
                    </div>

                    {/* Title & description */}
                    <div className="mb-2">
                      <p className="text-[11px] font-semibold text-slate-100">
                        {r.title || 'Maintenance request'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 whitespace-pre-wrap">
                        {r.description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Property / tenant line */}
                    <div className="mt-1 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      {p && (
                        <span>
                          <span className="text-slate-400">Property:</span>{' '}
                          <span className="text-slate-200">
                            {p.name || 'Property'}
                            {p.unit_label ? ` · ${p.unit_label}` : ''}
                          </span>
                        </span>
                      )}
                      {t && (
                        <span>
                          <span className="text-slate-400">Tenant:</span>{' '}
                          <span className="text-slate-200">
                            {t.name || t.email}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Resolution note */}
                    <div className="mt-3">
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Resolution / notes (visible to tenant)
                      </label>
                      <textarea
                        rows={2}
                        value={resolutionDrafts[r.id] ?? ''}
                        onChange={(e) =>
                          handleResolutionChange(r.id, e.target.value)
                        }
                        onBlur={() => handleResolutionBlur(r.id)}
                        placeholder="Ex: Scheduled plumber for Tuesday."
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-[11px] text-slate-50 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolutionSave(r.id)}
                          disabled={saving}
                          className="rounded-full border border-emerald-500/70 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {saving ? 'Saving…' : 'Save note'}
                        </button>
                        <p className="text-[10px] text-slate-500 text-right">
                          Notes are also saved automatically when you leave this
                          field or page.
                        </p>
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
