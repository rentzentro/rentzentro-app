'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type TenantRow = {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
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

export default function LandlordMaintenancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequestRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          supabase.from('tenants').select('id, name, email, phone'),
          supabase.from('properties').select('id, name, unit_label'),
        ]);

        if (reqRes.error) throw reqRes.error;
        if (tenantRes.error) throw tenantRes.error;
        if (propRes.error) throw propRes.error;

        setRequests((reqRes.data || []) as MaintenanceRequestRow[]);
        setTenants((tenantRes.data || []) as TenantRow[]);
        setProperties((propRes.data || []) as PropertyRow[]);
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Failed to load maintenance requests. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const tenantById = new Map<number, TenantRow>();
  tenants.forEach((t) => tenantById.set(t.id, t));

  const propertyById = new Map<number, PropertyRow>();
  properties.forEach((p) => propertyById.set(p.id, p));

  const handleBack = () => {
    router.back();
  };

  const updateRequest = async (
    id: number,
    updates: Partial<Pick<MaintenanceRequestRow, 'status' | 'priority' | 'resolution_note'>>
  ) => {
    setUpdatingId(id);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('maintenance_requests')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (updateError) throw updateError;

      setRequests((prev) =>
        prev.map((r) => (r.id === id ? (data as MaintenanceRequestRow) : r))
      );
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || 'Failed to update request. Please try again later.'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    await updateRequest(id, { status: newStatus });
  };

  const handlePriorityChange = async (id: number, newPriority: string) => {
    await updateRequest(id, { priority: newPriority });
  };

  const handleResolutionNoteChange = async (id: number, note: string) => {
    await updateRequest(id, { resolution_note: note || null });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
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
              Maintenance overview
            </h1>
            <p className="text-[13px] text-slate-400">
              Track and update maintenance requests from your tenants.
            </p>
          </div>

          <Link
            href="/landlord"
            className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200"
          >
            Landlord dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm text-xs">
          <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-2">
            All maintenance requests
          </p>

          {loading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="text-xs text-slate-500">
              No maintenance requests have been submitted yet.
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {requests.map((r) => {
                const t = r.tenant_id ? tenantById.get(r.tenant_id) : null;
                const p = r.property_id ? propertyById.get(r.property_id) : null;

                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={r.status}
                          onChange={(e) =>
                            handleStatusChange(r.id, e.target.value)
                          }
                          className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-100"
                          disabled={updatingId === r.id}
                        >
                          <option value="new">New</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                        </select>

                        <select
                          value={r.priority}
                          onChange={(e) =>
                            handlePriorityChange(r.id, e.target.value)
                          }
                          className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-100"
                          disabled={updatingId === r.id}
                        >
                          <option value="low">Low</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>

                        {r.category && (
                          <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300">
                            {r.category}
                          </span>
                        )}
                      </div>

                      <div className="text-right text-[11px] text-slate-500">
                        <p>{formatDateTime(r.created_at)}</p>
                      </div>
                    </div>

                    <div className="mt-1 text-[11px] text-slate-300">
                      <p>{r.description}</p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-400">
                        {p && (
                          <p>
                            Property:{' '}
                            <span className="text-slate-200">
                              {p.name || 'Property'}
                              {p.unit_label ? ` · ${p.unit_label}` : ''}
                            </span>
                          </p>
                        )}
                        {t && (
                          <p>
                            Tenant:{' '}
                            <span className="text-slate-200">
                              {t.name || t.email}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="flex-1 min-w-[180px] max-w-xs">
                        <label className="block text-[10px] text-slate-500 mb-0.5 text-right">
                          Resolution / notes (visible to tenant)
                        </label>
                        <input
                          type="text"
                          value={r.resolution_note ?? ''}
                          onChange={(e) =>
                            handleResolutionNoteChange(r.id, e.target.value)
                          }
                          placeholder="Ex: Scheduled plumber for Tuesday."
                          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:ring-emerald-500"
                          disabled={updatingId === r.id}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500">
            Resolution notes are visible to the tenant in their portal. For your
            own private notes, we can add an internal-only field later.
          </p>
        </section>
      </div>
    </div>
  );
}
