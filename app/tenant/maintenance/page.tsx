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
  status: string;
  priority: string | null;
  created_at: string;
};

// ---------- Component ----------

export default function TenantMaintenancePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);
  const [requests, setRequests] = useState<MaintenanceRow[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Normal',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ---------- Load tenant + property + maintenance ----------

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

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

        // Property info (including landlord_email)
        const { data: propertyRow, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', tenantRow.property_id)
          .single();

        if (propertyError) throw propertyError;

        setProperty(propertyRow);

        // Existing maintenance requests for this tenant
        const { data: maintenanceRows, error: maintenanceError } =
          await supabase
            .from('maintenance_requests')
            .select('*')
            .eq('tenant_id', tenantRow.id)
            .order('created_at', { ascending: false });

        if (maintenanceError) throw maintenanceError;

        setRequests(maintenanceRows || []);
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!tenant || !property) {
      setError('Unable to submit request: tenant or property missing.');
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      setError('Please provide both a title and description.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccess(null);

      // 1) Insert into Supabase
      const { data: insertData, error: insertError } = await supabase
        .from('maintenance_requests')
        .insert({
          tenant_id: tenant.id,
          property_id: property.id,
          title: form.title.trim(),
          description: form.description.trim(),
          status: 'Open',
          priority: form.priority,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Optimistically update list in UI
      setRequests((prev) => [insertData as MaintenanceRow, ...prev]);

      // 2) Email to landlord (always attempt; route will decide actual recipient)
      const landlordEmail = property?.landlord_email || '';

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

      // Reset form
      setForm({
        title: '',
        description: '',
        priority: 'Normal',
      });

      setSuccess('Maintenance request submitted successfully.');
    } catch (err: any) {
      console.error('Error submitting maintenance request:', err);
      setError(
        err?.message ||
          'Something went wrong while submitting your maintenance request.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/tenant/login');
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm text-slate-600">Loading maintenance portal...</p>
        </div>
      </main>
    );
  }

  if (error && !tenant) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="mb-4 text-sm text-red-600">{error}</p>
          <button
            onClick={() => router.push('/tenant/login')}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            Back to Tenant Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              RentZentro Tenant Maintenance
            </h1>
            {tenant && (
              <p className="text-xs text-slate-500">
                Signed in as <span className="font-medium">{tenant.email}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/tenant/portal"
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Back to Tenant Portal
            </Link>
            <button
              onClick={handleLogout}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Property card */}
        {property && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">
              Your Property
            </h2>
            <p className="text-sm text-slate-700">
              {property.name || 'Unnamed Property'}
            </p>
            <p className="text-xs text-slate-500">
              Unit: {property.unit_label || 'N/A'}
            </p>
            {property.landlord_email && (
              <p className="mt-1 text-xs text-slate-500">
                Landlord contact: {property.landlord_email}
              </p>
            )}
          </section>
        )}

        {/* New request form */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Submit a Maintenance Request
            </h2>
            {success && (
              <span className="text-xs font-medium text-emerald-600">
                {success}
              </span>
            )}
          </div>

          {error && (
            <p className="mb-3 text-xs text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Title
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleInputChange}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Brief summary of the issue"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Priority
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleInputChange}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Normal">Normal</option>
                <option value="Urgent">Urgent</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleInputChange}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                rows={4}
                placeholder="Describe the issue in as much detail as possible."
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </section>

        {/* Existing requests list */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Your Recent Maintenance Requests
          </h2>

          {requests.length === 0 ? (
            <p className="text-xs text-slate-500">
              You have not submitted any maintenance requests yet.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-900">
                      {r.title}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        r.status === 'Open'
                          ? 'bg-amber-100 text-amber-700'
                          : r.status === 'In Progress'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-700">
                    {r.description}
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
    </main>
  );
}
