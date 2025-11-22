'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../supabaseClient';

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

type Priority = 'low' | 'normal' | 'high' | 'emergency';

type FormState = {
  title: string;
  description: string;
  priority: Priority;
};

const emptyForm: FormState = {
  title: '',
  description: '',
  priority: 'normal',
};

// ---------- Component ----------

export default function TenantMaintenanceSubmitPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantRow | null>(null);
  const [property, setProperty] = useState<PropertyRow | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ---------- Load tenant + property ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError) throw authError;

        const email = authData.user?.email;
        if (!email) {
          throw new Error('Unable to load tenant: missing email.');
        }

        const { data: tenantRow, error: tenantError } = await supabase
          .from('tenants')
          .select('id, name, email, phone, property_id')
          .eq('email', email)
          .maybeSingle();

        if (tenantError) throw tenantError;
        if (!tenantRow) {
          throw new Error(
            "We couldn't find your tenant record. Please contact your landlord."
          );
        }

        const t = tenantRow as TenantRow;
        setTenant(t);

        if (t.property_id) {
          const { data: propRow, error: propError } = await supabase
            .from('properties')
            .select('id, name, unit_label, landlord_email')
            .eq('id', t.property_id)
            .maybeSingle();

          if (propError) throw propError;
          setProperty((propRow || null) as PropertyRow | null);
        } else {
          setProperty(null);
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message ||
            'Failed to load your account details. Please try again or contact your landlord.'
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
      setSuccess(null);
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

      console.log('Maintenance request created:', insertData);

      // 2) Call your existing API route and WAIT for the result
      const emailRes = await fetch('/api/maintenance-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landlordEmail: property?.landlord_email || undefined,
          tenantName: tenant.name,
          tenantEmail: tenant.email,
          propertyName: property?.name,
          unitLabel: property?.unit_label,
          title: form.title.trim(),
          description: form.description.trim(),
          priority: form.priority,
        }),
      });

      let emailData: any = null;
      try {
        emailData = await emailRes.json();
      } catch {
        // ignore JSON parse errors
      }

      console.log('maintenance-email response:', emailRes.status, emailData);

      if (!emailRes.ok) {
        throw new Error(
          emailData?.error ||
            'Your request was created, but the email notification failed.'
        );
      }

      // 3) Show global success banner and clear the form
      setForm(emptyForm);
      setSuccess('Your maintenance request has been submitted.');
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong submitting your request. Please try again.'
      );
      setSuccess(null);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render ----------

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading maintenance form…</p>
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md rounded-2xl bg-slate-900/80 border border-slate-700 p-6 shadow-xl space-y-4">
          <p className="text-sm text-red-400">
            {error ||
              'We could not find a tenant record for this account. Please reach out to your landlord.'}
          </p>
          <button
            onClick={() => router.push('/tenant/portal')}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-50 hover:bg-slate-700 border border-slate-600"
          >
            Back to portal
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-xl space-y-4">
        {/* Header */}
        <header className="space-y-1">
          <button
            type="button"
            onClick={handleBack}
            className="text-[11px] text-slate-500 hover:text-emerald-300"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold text-slate-50">
            Submit a maintenance request
          </h1>
          <p className="text-[11px] text-slate-400">
            Describe the issue with your unit so your landlord can review and
            respond.
          </p>
        </header>

        {/* Global banner (success / error) */}
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

        {/* Form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                Title
              </label>
              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Short summary (e.g., Leaking kitchen sink)"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                Description
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={5}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Describe the issue, when it started, and anything else your landlord should know."
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-200">
                Priority
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="low">Low – minor issue</option>
                <option value="normal">Normal</option>
                <option value="high">High – affects comfort/usage</option>
                <option value="emergency">
                  Emergency – needs immediate attention
                </option>
              </select>
            </div>

            <p className="text-[10px] text-amber-300 flex items-start gap-1">
              <span className="text-amber-300 text-xs mt-[1px]">⚠️</span>
              For true emergencies (fire, active flooding, gas smells, or
              anything life-threatening), call your local emergency services
              first, then contact your landlord or property manager directly.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>

            <div className="pt-1 flex justify-end">
              <Link
                href="/tenant/maintenance"
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                View all requests →
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
