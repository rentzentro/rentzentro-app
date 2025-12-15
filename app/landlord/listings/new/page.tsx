'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../supabaseClient';

const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

type ListingRow = {
  id: number;
  owner_id: string;
  title: string;
  slug: string;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  rent_amount: number | null;
  deposit_amount: number | null;
  available_date: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  hide_exact_address: boolean;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  published: boolean;
  published_at: string | null;
  status: string | null;
  created_at?: string;
};

type PhotoRow = {
  id: number;
  listing_id: number;
  owner_id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
};

const money = (n: number | null | undefined) =>
  n == null || isNaN(n)
    ? ''
    : n.toLocaleString('en-US', { maximumFractionDigits: 0 });

function getQueryId(searchParams: URLSearchParams) {
  const raw = searchParams.get('id');
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseStoragePathFromPublicUrl(url: string): string | null {
  // Typical public URL:
  // https://<project>.supabase.co/storage/v1/object/public/listing-photos/<path>
  const marker = '/storage/v1/object/public/listing-photos/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export default function ListingCreateEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = useMemo(() => getQueryId(searchParams), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'create' | 'edit'>(id ? 'edit' : 'create');

  const [listing, setListing] = useState<ListingRow | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);

  // Form fields (create + edit)
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [rentAmount, setRentAmount] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [availableDate, setAvailableDate] = useState<string>(''); // YYYY-MM-DD
  const [beds, setBeds] = useState<string>('');
  const [baths, setBaths] = useState<string>('');
  const [sqft, setSqft] = useState<string>('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [hideExactAddress, setHideExactAddress] = useState(true);
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Photos upload / reorder
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);

  const suggestedSlug = useMemo(() => {
    const base = slugify(title || '');
    return base || 'new-listing';
  }, [title]);

  const hydrateFormFromListing = (l: ListingRow) => {
    setTitle(l.title || '');
    setSlug(l.slug || '');
    setCity(l.city || '');
    setStateVal(l.state || '');
    setNeighborhood(l.neighborhood || '');
    setRentAmount(l.rent_amount != null ? String(l.rent_amount) : '');
    setDepositAmount(l.deposit_amount != null ? String(l.deposit_amount) : '');
    setAvailableDate(l.available_date || '');
    setBeds(l.beds != null ? String(l.beds) : '');
    setBaths(l.baths != null ? String(l.baths) : '');
    setSqft(l.sqft != null ? String(l.sqft) : '');
    setDescription(l.description || '');
    setContactEmail(l.contact_email || '');
    setContactPhone(l.contact_phone || '');
    setHideExactAddress(!!l.hide_exact_address);
    setAddress1(l.address_line1 || '');
    setAddress2(l.address_line2 || '');
    setPostalCode(l.postal_code || '');
  };

  const loadEditMode = async (listingId: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        router.push('/landlord/login');
        return;
      }

      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select(
          `
          id, owner_id, title, slug, city, state, neighborhood,
          rent_amount, deposit_amount, available_date, beds, baths, sqft,
          description, contact_email, contact_phone,
          hide_exact_address, address_line1, address_line2, postal_code,
          published, published_at, status
        `
        )
        .eq('id', listingId)
        .maybeSingle();

      if (listingError) throw listingError;
      if (!listingData) {
        throw new Error('Listing not found (or you do not have access).');
      }

      const l = listingData as ListingRow;
      setListing(l);
      hydrateFormFromListing(l);

      const { data: photoData, error: photoError } = await supabase
        .from('listing_photos')
        .select('id, listing_id, owner_id, image_url, sort_order')
        .eq('listing_id', listingId)
        .order('sort_order', { ascending: true });

      if (photoError) throw photoError;
      setPhotos((photoData || []) as PhotoRow[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load listing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const nextMode = id ? 'edit' : 'create';
    setMode(nextMode);

    if (id) {
      loadEditMode(id);
    } else {
      // Create mode: reset
      setLoading(false);
      setListing(null);
      setPhotos([]);
      setError(null);
      setTitle('');
      setSlug('');
      setCity('');
      setStateVal('');
      setNeighborhood('');
      setRentAmount('');
      setDepositAmount('');
      setAvailableDate('');
      setBeds('');
      setBaths('');
      setSqft('');
      setDescription('');
      setContactEmail('');
      setContactPhone('');
      setHideExactAddress(true);
      setAddress1('');
      setAddress2('');
      setPostalCode('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const createDraft = async () => {
    setError(null);

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setBusy(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        router.push('/landlord/login');
        return;
      }

      // Generate a slug (unique-ish)
      let nextSlug = slugify(title.trim()) || 'new-listing';
      const suffix = Math.random().toString(36).slice(2, 7);

      // Quick check for collisions
      const { data: existing } = await supabase
        .from('listings')
        .select('id')
        .eq('slug', nextSlug)
        .maybeSingle();

      if (existing?.id) {
        nextSlug = `${nextSlug}-${suffix}`;
      }

      const payload: Partial<ListingRow> = {
        owner_id: authData.user.id,
        title: title.trim(),
        slug: nextSlug,
        city: city.trim() || null,
        state: stateVal.trim() || null,
        neighborhood: neighborhood.trim() || null,
        rent_amount: rentAmount ? Number(rentAmount) : null,
        deposit_amount: depositAmount ? Number(depositAmount) : null,
        available_date: availableDate ? availableDate : null,
        beds: beds ? Number(beds) : null,
        baths: baths ? Number(baths) : null,
        sqft: sqft ? Number(sqft) : null,
        description: description.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        hide_exact_address: hideExactAddress,
        address_line1: address1.trim() || null,
        address_line2: address2.trim() || null,
        postal_code: postalCode.trim() || null,
        published: false,
        published_at: null,
        status: 'available',
      };

      const { data: inserted, error: insertError } = await supabase
        .from('listings')
        .insert(payload)
        .select('id')
        .single();

      if (insertError) throw insertError;

      const newId = (inserted as any).id as number;
      router.push(`/landlord/listings/new?id=${newId}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to create listing.');
    } finally {
      setBusy(false);
    }
  };

  const saveChanges = async () => {
    if (!id) return;
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setBusy(true);
    try {
      const payload: Partial<ListingRow> = {
        title: title.trim(),
        // slug is normally stable for SEO; keep it unless you truly want edits
        // If you DO want to allow slug editing later, we can add it safely with uniqueness check.
        city: city.trim() || null,
        state: stateVal.trim() || null,
        neighborhood: neighborhood.trim() || null,
        rent_amount: rentAmount ? Number(rentAmount) : null,
        deposit_amount: depositAmount ? Number(depositAmount) : null,
        available_date: availableDate ? availableDate : null,
        beds: beds ? Number(beds) : null,
        baths: baths ? Number(baths) : null,
        sqft: sqft ? Number(sqft) : null,
        description: description.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        hide_exact_address: hideExactAddress,
        address_line1: address1.trim() || null,
        address_line2: address2.trim() || null,
        postal_code: postalCode.trim() || null,
      };

      const { error: updateError } = await supabase
        .from('listings')
        .update(payload)
        .eq('id', id);

      if (updateError) throw updateError;

      // Refresh listing state (optional but keeps UI consistent)
      await loadEditMode(id);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to save changes.');
    } finally {
      setBusy(false);
    }
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const uploadSelectedPhotos = async (files: FileList | null) => {
    if (!id) {
      setError('Create the draft first before uploading photos.');
      return;
    }
    if (!files || files.length === 0) return;

    setError(null);
    setUploading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        router.push('/landlord/login');
        return;
      }

      const ownerId = authData.user.id;
      const startingOrder =
        photos.length === 0
          ? 0
          : Math.max(...photos.map((p) => p.sort_order ?? 0)) + 1;

      const fileArr = Array.from(files);

      // Basic guardrails (keep it fast + safe)
      for (const f of fileArr) {
        if (!f.type.startsWith('image/')) {
          throw new Error('Only image files are allowed.');
        }
        // 8MB per photo cap (adjust if you want)
        if (f.size > 8 * 1024 * 1024) {
          throw new Error('One of the images is larger than 8MB. Please resize and try again.');
        }
      }

      for (let i = 0; i < fileArr.length; i++) {
        const file = fileArr[i];

        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
        const fileName =
          `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

        // Bucket path: <owner_id>/<listing_id>/<filename>
        const storagePath = `${ownerId}/${id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        const { data: pub } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(storagePath);

        const publicUrl = pub?.publicUrl;
        if (!publicUrl) throw new Error('Failed to generate public URL for uploaded image.');

        const { error: insertError } = await supabase
          .from('listing_photos')
          .insert({
            listing_id: id,
            owner_id: ownerId,
            image_url: publicUrl,
            sort_order: startingOrder + i,
          });

        if (insertError) throw insertError;
      }

      // reload photos
      await loadEditMode(id);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to upload photos.');
    } finally {
      setUploading(false);
    }
  };

  const persistPhotoOrder = async (next: PhotoRow[]) => {
    // Write sort_order updates
    try {
      const updates = next.map((p, idx) => ({
        id: p.id,
        sort_order: idx,
      }));

      // batch as multiple updates (simple + reliable)
      await Promise.all(
        updates.map((u) =>
          supabase
            .from('listing_photos')
            .update({ sort_order: u.sort_order })
            .eq('id', u.id)
        )
      );
    } catch (e) {
      console.error('Failed to persist photo order:', e);
      // Don’t hard fail UI; user can refresh
    }
  };

  const setAsCover = async (photoId: number) => {
    const idx = photos.findIndex((p) => p.id === photoId);
    if (idx <= 0) return; // already cover or not found
    const next = [...photos];
    const [picked] = next.splice(idx, 1);
    next.unshift(picked);
    // re-index
    const reindexed = next.map((p, i) => ({ ...p, sort_order: i }));
    setPhotos(reindexed);
    await persistPhotoOrder(reindexed);
  };

  const deletePhoto = async (p: PhotoRow) => {
    const ok = window.confirm('Delete this photo? This cannot be undone.');
    if (!ok) return;

    setError(null);
    setBusy(true);
    try {
      // best effort: delete storage object (if we can parse path)
      const storagePath = parseStoragePathFromPublicUrl(p.image_url);
      if (storagePath) {
        const { error: removeErr } = await supabase.storage
          .from('listing-photos')
          .remove([storagePath]);
        // Not fatal if it fails (still delete DB row)
        if (removeErr) console.warn('Storage remove failed:', removeErr);
      }

      const { error: delErr } = await supabase
        .from('listing_photos')
        .delete()
        .eq('id', p.id);

      if (delErr) throw delErr;

      const next = photos.filter((x) => x.id !== p.id).map((x, i) => ({ ...x, sort_order: i }));
      setPhotos(next);
      await persistPhotoOrder(next);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete photo.');
    } finally {
      setBusy(false);
    }
  };

  const onDragStart = (photoId: number) => {
    setDragId(photoId);
  };

  const onDropOn = async (targetId: number) => {
    if (dragId == null || dragId === targetId) return;

    const fromIdx = photos.findIndex((p) => p.id === dragId);
    const toIdx = photos.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = [...photos];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);

    const reindexed = next.map((p, i) => ({ ...p, sort_order: i }));
    setPhotos(reindexed);
    setDragId(null);
    await persistPhotoOrder(reindexed);
  };

  const coverPhoto = photos.length > 0 ? photos[0] : null;

  // UI
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <Link href="/landlord/listings" className="hover:text-emerald-400">
                Listings
              </Link>
              <span>/</span>
              <span className="text-slate-300">
                {mode === 'create' ? 'New' : 'Edit'}
              </span>
            </div>

            <h1 className="mt-1 text-xl font-semibold text-slate-50">
              {mode === 'create' ? 'New listing' : 'Edit listing'}
            </h1>

            <p className="mt-1 text-[13px] text-slate-400">
              {mode === 'create'
                ? 'Create a draft listing. After you create it, you can upload photos and reorder them.'
                : 'Update details, upload photos, and set your cover photo (first photo).'}
            </p>

            {mode === 'edit' && listing && (
              <p className="mt-1 text-[11px] text-slate-500">
                Slug: <span className="font-mono text-slate-300">{listing.slug}</span>
                <span className="mx-2">•</span>
                Status:{' '}
                {listing.published ? (
                  <span className="text-emerald-300 font-semibold">Published</span>
                ) : (
                  <span className="text-amber-300 font-semibold">Draft</span>
                )}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {mode === 'edit' ? (
              <>
                <button
                  onClick={saveChanges}
                  disabled={busy || loading}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>

                <Link
                  href="/landlord/listings"
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  Back to listings
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={createDraft}
                  disabled={busy}
                  className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {busy ? 'Creating…' : 'Create draft'}
                </button>

                <Link
                  href="/landlord/listings"
                  className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </Link>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Main grid */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* Left: Details */}
          <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <>
                <div>
                  <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                    Title *
                  </label>
                  <input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (mode === 'create') setSlug(suggestedSlug);
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                    placeholder="e.g., Updated 2BR with parking"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    {mode === 'create' ? (
                      <>
                        Slug preview:{' '}
                        <span className="font-mono text-slate-300">
                          {suggestedSlug}
                        </span>
                      </>
                    ) : (
                      <>
                        Slug is locked for SEO stability. (We can add a safe “change slug” flow later.)
                      </>
                    )}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      City
                    </label>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="City"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      State
                    </label>
                    <input
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="State"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Neighborhood
                    </label>
                    <input
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Rent (mo)
                    </label>
                    <input
                      value={rentAmount}
                      onChange={(e) => setRentAmount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="2000"
                      inputMode="numeric"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Deposit
                    </label>
                    <input
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="2000"
                      inputMode="numeric"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Beds
                    </label>
                    <input
                      value={beds}
                      onChange={(e) => setBeds(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="2"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Baths
                    </label>
                    <input
                      value={baths}
                      onChange={(e) => setBaths(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="1.5"
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Sqft
                    </label>
                    <input
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="1200"
                      inputMode="numeric"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Available date
                    </label>
                    <input
                      type="date"
                      value={availableDate}
                      onChange={(e) => setAvailableDate(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Leave blank to show “Now”.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 min-h-[140px] w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                    placeholder="Pets, utilities, parking, laundry, requirements, etc."
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Contact email
                    </label>
                    <input
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                      Contact phone
                    </label>
                    <input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                      placeholder="Optional"
                    />
                  </div>
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

                {!hideExactAddress && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                        Address line 1
                      </label>
                      <input
                        value={address1}
                        onChange={(e) => setAddress1(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                        placeholder="123 Main St"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                        Address line 2
                      </label>
                      <input
                        value={address2}
                        onChange={(e) => setAddress2(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                        placeholder="Apt 2B"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-500 uppercase tracking-wide">
                        Postal code
                      </label>
                      <input
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                        placeholder="02860"
                      />
                    </div>
                  </div>
                )}

                {mode === 'edit' && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      onClick={saveChanges}
                      disabled={busy || loading}
                      className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Save changes'}
                    </button>

                    <Link
                      href="/landlord/listings"
                      className="rounded-full border border-slate-700 bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800"
                    >
                      Done
                    </Link>
                  </div>
                )}

                <p className="text-[11px] text-slate-500">
                  Tip: Cover photo = first photo. Drag photos to reorder.
                </p>
              </>
            )}
          </section>

          {/* Right: Photos (only in edit mode) */}
          <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Photos
                </p>
                <p className="mt-1 text-[13px] text-slate-400">
                  {mode === 'edit'
                    ? 'Upload, reorder, set cover.'
                    : 'Create the draft first, then upload photos.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => uploadSelectedPhotos(e.target.files)}
                />

                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={mode !== 'edit' || uploading}
                  className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : '+ Upload'}
                </button>

                {mode === 'edit' && listing && (
                  <a
                    href={`/listings/${listing.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    Preview
                  </a>
                )}
              </div>
            </div>

            {mode !== 'edit' ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
                Create the draft first — then you’ll be able to upload photos here.
              </div>
            ) : loading ? (
              <p className="mt-4 text-sm text-slate-400">Loading photos…</p>
            ) : photos.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                <p className="text-sm text-slate-200 font-semibold">
                  No photos yet
                </p>
                <p className="mt-1 text-[13px] text-slate-400">
                  Upload a few photos to make your listing look premium.
                </p>
                <button
                  type="button"
                  onClick={openFilePicker}
                  disabled={uploading}
                  className="mt-3 rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : 'Upload photos'}
                </button>
              </div>
            ) : (
              <>
                {coverPhoto && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverPhoto.image_url}
                      alt="Cover photo"
                      className="h-44 w-full object-cover"
                    />
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-[11px] text-slate-300 font-semibold">
                        Cover photo
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Drag to reorder
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  {photos.map((p, idx) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => onDragStart(p.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropOn(p.id)}
                      className={`group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 ${
                        dragId === p.id ? 'ring-2 ring-emerald-500/60' : ''
                      }`}
                      title="Drag to reorder"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.image_url}
                        alt="Listing photo"
                        className="h-32 w-full object-cover"
                      />

                      {/* Badge */}
                      <div className="absolute left-2 top-2">
                        {idx === 0 ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                            Cover
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                            {idx + 1}
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="absolute inset-x-0 bottom-0 flex gap-2 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => setAsCover(p.id)}
                            disabled={busy}
                            className="flex-1 rounded-full bg-sky-500 px-3 py-1.5 text-[11px] font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
                          >
                            Set cover
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => deletePhoto(p)}
                          disabled={busy}
                          className="flex-1 rounded-full border border-rose-500/50 bg-rose-950/30 px-3 py-1.5 text-[11px] font-semibold text-rose-100 hover:bg-rose-950/40 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[11px] text-slate-500">
                  Reordering saves automatically. Cover photo is always #1.
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
