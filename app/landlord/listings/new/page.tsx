'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../supabaseClient';

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export default function NewListingPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [beds, setBeds] = useState<string>('');
  const [baths, setBaths] = useState<string>('');
  const [description, setDescription] = useState('');
  const [hideExactAddress, setHideExactAddress] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestedSlug = useMemo(() => {
    const base = slugify(title || '');
    return base || 'new-listing';
  }, [title]);

  const createListing = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        router.push('/landlord/login');
        return;
      }

      // Ensure unique slug by appending a short suffix if needed
      let slug = suggestedSlug;
      const suffix = Math.random().toString(36).slice(2, 7);
      if (slug.length < 3) slug = `listing-${suffix}`;

      // (Optional) quick check if slug exists
      const { data: existing } = await supabase
        .from('listings')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (existing?.id) {
        slug = `${slug}-${suffix}`;
      }

      const payload: any = {
        owner_id: authData.user.id,
        title: title.trim(),
        slug,
        city: city.trim() || null,
        state: state.trim() || null,
        rent_amount: rentAmount ? Number(rentAmount) : null,
        beds: beds ? Number(beds) : null,
        baths: baths ? Number(baths) : null,
        description: description.trim() || null,
        hide_exact_address: hideExactAddress,
        published: false,
        status: 'available',
      };

      const { error } = await supabase.from('listings').insert(payload);
      if (error) throw error;

      router.push('/landlord/listings');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to create listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="text-xs text-slate-500 flex gap-2">
            <Link href="/landlord" className="hover:text-emerald-400">
              Landlord
            </Link>
            <span>/</span>
            <Link href="/landlord/listings" className="hover:text-emerald-400">
              Listings
            </Link>
            <span>/</span>
            <span className="text-slate-300">New</span>
          </div>

          <h1 className="mt-1 text-xl font-semibold text-slate-50">New listing</h1>
          <p className="mt-1 text-[13px] text-slate-400">
            Create a draft listing. You can publish it when you’re ready.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wide">
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              placeholder="e.g., Updated 2BR with parking"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Slug preview: <span className="font-mono text-slate-300">{suggestedSlug}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wide">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                placeholder="City"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wide">State</label>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                placeholder="State"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wide">Rent (monthly)</label>
              <input
                value={rentAmount}
                onChange={(e) => setRentAmount(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                placeholder="e.g., 2000"
                inputMode="numeric"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wide">Beds</label>
              <input
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                placeholder="e.g., 2"
                inputMode="decimal"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-500 uppercase tracking-wide">Baths</label>
              <input
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                placeholder="e.g., 1.5"
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-500 uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
              placeholder="Add key details (pets, utilities, parking, laundry, requirements, etc.)"
            />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
            <input
              type="checkbox"
              checked={hideExactAddress}
              onChange={(e) => setHideExactAddress(e.target.checked)}
            />
            <span className="text-sm text-slate-200">
              Hide exact address on public page (recommended)
            </span>
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={createListing}
              disabled={submitting}
              className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create draft'}
            </button>

            <Link
              href="/landlord/listings"
              className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </Link>
          </div>

          <p className="text-[11px] text-slate-500">
            Draft listings are private until you publish them.
          </p>
        </section>
      </div>
    </main>
  );
}
