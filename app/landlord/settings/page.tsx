'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../supabaseClient';

type FormState = {
  businessName: string;
  contactEmail: string;
  contactPhone: string;
};

export default function LandlordSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    businessName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load current user + metadata
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = data.user;
        if (!user) {
          router.push('/landlord/login');
          return;
        }

        const meta = (user.user_metadata || {}) as {
          landlord_business_name?: string;
          landlord_contact_email?: string;
          landlord_contact_phone?: string;
        };

        setForm({
          businessName: meta.landlord_business_name || '',
          contactEmail:
            meta.landlord_contact_email || user.email || '',
          contactPhone: meta.landlord_contact_phone || '',
        });
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Failed to load your settings. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.contactEmail.trim()) {
      setError('Contact email is required.');
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          landlord_business_name: form.businessName.trim(),
          landlord_contact_email: form.contactEmail.trim(),
          landlord_contact_phone: form.contactPhone.trim(),
        },
      });

      if (updateError) throw updateError;

      setSuccess('Settings saved successfully.');
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message || 'Failed to save settings. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading settings…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <button
              type="button"
              onClick={handleBack}
              className="text-[11px] text-slate-500 hover:text-emerald-300"
            >
              ← Back
            </button>
            <h1 className="mt-2 text-2xl font-semibold text-slate-50">
              Landlord settings
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Update your business information and contact details used across
              RentZentro.
            </p>
          </div>

          <Link
            href="/landlord"
            className="text-[11px] px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
          >
            Go to dashboard
          </Link>
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

        {/* Form */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-sm text-sm space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Business profile
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              This is how your information appears in emails and inside
              RentZentro.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Business name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Business name (optional)
              </label>
              <input
                type="text"
                name="businessName"
                value={form.businessName}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Example: Miller Property Management"
              />
            </div>

            {/* Contact email */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Contact email (required)
              </label>
              <input
                type="email"
                name="contactEmail"
                value={form.contactEmail}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="you@example.com"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                This email can be used for maintenance notifications and
                communication with tenants in future updates.
              </p>
            </div>

            {/* Contact phone */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Contact phone (optional)
              </label>
              <input
                type="tel"
                name="contactPhone"
                value={form.contactPhone}
                onChange={handleChange}
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="(555) 123-4567"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                For emergencies or direct contact. Not displayed to other
                landlords.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        </section>

        {/* Info note */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-[11px] text-slate-400">
          In future versions, these settings can also control where maintenance
          emails go, branding in tenant emails, and other landlord-specific
          preferences.
        </section>
      </div>
    </main>
  );
}
