'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

type ListingRow = {
  id: number;
  created_at: string;
  owner_id: string;
  title: string;
  slug: string;
  published: boolean;
  published_at: string | null;
  status: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  rent_amount: number | null;
  deposit_amount: number | null;
  available_date: string | null; // date string
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  description: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  hide_exact_address: boolean | null;
};

type PhotoRow = {
  id: number;
  created_at: string;
  listing_id: number;
  owner_id: string;
  image_url: string;
  sort_order: number;
};

const money = (n: number | null | undefined) =>
  n == null || isNaN(n)
    ? '-'
    : n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });

const niceDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const slugify = (raw: string) => {
  const s = (raw || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s;
};

export default function LandlordListingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<number | null>(null);

  // Photos
  const [photosByListingId, setPhotosByListingId] = useState<Record<number, PhotoRow[]>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadForListingId, setUploadForListingId] = useState<number | null>(null);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editListingId, setEditListingId] = useState<number | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formNeighborhood, setFormNeighborhood] = useState('');
  const [formRent, setFormRent] = useState<string>('');
  const [formDeposit, setFormDeposit] = useState<string>('');
  const [formAvailableDate, setFormAvailableDate] = useState<string>('');
  const [formBeds, setFormBeds] = useState<string>('');
  const [formBaths, setFormBaths] = useState<string>('');
  const [formSqft, setFormSqft] = useState<string>('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formContactPhone, setFormContactPhone] = useState('');
  const [formHideExactAddress, setFormHideExactAddress] = useState(true);
  const [formDescription, setFormDescription] = useState('');

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.rentzentro.com';

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) {
        router.push('/landlord/login');
        return;
      }

      const { data, error } = await supabase
        .from('listings')
        .select(
          `
          id,
          created_at,
          owner_id,
          title,
          slug,
          published,
          published_at,
          status,
          city,
          state,
          neighborhood,
          rent_amount,
          deposit_amount,
          available_date,
          beds,
          baths,
          sqft,
          description,
          contact_email,
          contact_phone,
          hide_exact_address
        `
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      const listings = (data || []) as ListingRow[];
      setRows(listings);

      // Load photos for all listing IDs
      const ids = listings.map((l) => l.id);
      if (ids.length > 0) {
        const { data: photoRows, error: photoErr } = await supabase
          .from('listing_photos')
          .select('id, created_at, listing_id, owner_id, image_url, sort_order')
          .in('listing_id', ids)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (photoErr) throw photoErr;

        const grouped: Record<number, PhotoRow[]> = {};
        (photoRows || []).forEach((p: any) => {
          const lid = p.listing_id as number;
          if (!grouped[lid]) grouped[lid] = [];
          grouped[lid].push(p as PhotoRow);
        });
        setPhotosByListingId(grouped);
      } else {
        setPhotosByListingId({});
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to load listings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const publishedCount = useMemo(() => rows.filter((r) => r.published).length, [rows]);

  const togglePublish = async (listing: ListingRow) => {
    setBusyId(listing.id);
    setError(null);

    try {
      const nextPublished = !listing.published;

      const payload: any = {
        published: nextPublished,
        published_at: nextPublished ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from('listings').update(payload).eq('id', listing.id);
      if (error) throw error;

      setRows((prev) =>
        prev.map((r) =>
          r.id === listing.id
            ? { ...r, published: nextPublished, published_at: payload.published_at }
            : r
        )
      );

      showNotice(nextPublished ? 'Listing published' : 'Listing unpublished');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to update publish status.');
    } finally {
      setBusyId(null);
    }
  };

  const copyPublicLink = async (slug: string) => {
    const url = `${siteUrl.replace(/\/$/, '')}/listings/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      showNotice('Public link copied');
    } catch {
      prompt('Copy this link:', url);
    }
  };

  const openEdit = (l: ListingRow) => {
    setError(null);
    setEditListingId(l.id);

    setFormTitle(l.title || '');
    setFormSlug(l.slug || '');
    setFormCity(l.city || '');
    setFormState(l.state || '');
    setFormNeighborhood(l.neighborhood || '');

    setFormRent(l.rent_amount != null ? String(l.rent_amount) : '');
    setFormDeposit(l.deposit_amount != null ? String(l.deposit_amount) : '');
    setFormAvailableDate(l.available_date || '');

    setFormBeds(l.beds != null ? String(l.beds) : '');
    setFormBaths(l.baths != null ? String(l.baths) : '');
    setFormSqft(l.sqft != null ? String(l.sqft) : '');

    setFormContactEmail(l.contact_email || '');
    setFormContactPhone(l.contact_phone || '');
    setFormHideExactAddress(l.hide_exact_address !== false); // default true
    setFormDescription(l.description || '');

    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditListingId(null);
    setEditBusy(false);
  };

  const saveEdit = async () => {
    if (!editListingId) return;

    const current = rows.find((r) => r.id === editListingId);
    if (!current) return;

    setEditBusy(true);
    setError(null);

    try {
      const nextTitle = formTitle.trim();
      if (!nextTitle) throw new Error('Title is required.');

      let nextSlug = (formSlug || '').trim();
      if (!nextSlug) nextSlug = slugify(nextTitle);

      // Only allow changing slug if NOT published (prevents broken public links)
      if (current.published && nextSlug !== current.slug) {
        throw new Error('Slug cannot be changed after publishing. Unpublish first if you need to change it.');
      }

      // Basic slug validation
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(nextSlug)) {
        throw new Error('Slug must be lowercase letters/numbers with hyphens only (no spaces).');
      }

      const payload: Partial<ListingRow> = {
        title: nextTitle,
        slug: nextSlug,
        city: formCity.trim() || null,
        state: formState.trim() || null,
        neighborhood: formNeighborhood.trim() || null,
        rent_amount: formRent.trim() === '' ? null : Number(formRent),
        deposit_amount: formDeposit.trim() === '' ? null : Number(formDeposit),
        available_date: formAvailableDate.trim() === '' ? null : formAvailableDate.trim(),
        beds: formBeds.trim() === '' ? null : Number(formBeds),
        baths: formBaths.trim() === '' ? null : Number(formBaths),
        sqft: formSqft.trim() === '' ? null : Number(formSqft),
        contact_email: formContactEmail.trim() || null,
        contact_phone: formContactPhone.trim() || null,
        hide_exact_address: !!formHideExactAddress,
        description: formDescription.trim() || null,
      };

      // Safety: numbers must be valid if provided
      const numericFields: Array<[string, any]> = [
        ['rent_amount', payload.rent_amount],
        ['deposit_amount', payload.deposit_amount],
        ['beds', payload.beds],
        ['baths', payload.baths],
        ['sqft', payload.sqft],
      ];
      for (const [k, v] of numericFields) {
        if (v == null) continue;
        if (typeof v !== 'number' || isNaN(v)) {
          throw new Error(`Invalid number for ${k.replace('_', ' ')}.`);
        }
      }

      const { data, error } = await supabase
        .from('listings')
        .update(payload)
        .eq('id', editListingId)
        .select(
          `
          id,
          created_at,
          owner_id,
          title,
          slug,
          published,
          published_at,
          status,
          city,
          state,
          neighborhood,
          rent_amount,
          deposit_amount,
          available_date,
          beds,
          baths,
          sqft,
          description,
          contact_email,
          contact_phone,
          hide_exact_address
        `
        )
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Save succeeded but no listing returned.');

      const updated = data as ListingRow;

      setRows((prev) => prev.map((r) => (r.id === editListingId ? updated : r)));
      showNotice('Listing updated');
      closeEdit();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to save listing.');
      setEditBusy(false);
    }
  };

  const deleteListing = async (l: ListingRow) => {
    if (l.published) {
      showNotice('Unpublish before deleting');
      return;
    }

    const ok = confirm(`Delete this draft listing?\n\n"${l.title}"\n\nThis cannot be undone.`);
    if (!ok) return;

    setBusyId(l.id);
    setError(null);

    try {
      const { error } = await supabase.from('listings').delete().eq('id', l.id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== l.id));

      // Remove photos from UI map (DB cascade would delete listing_photos rows)
      setPhotosByListingId((prev) => {
        const next = { ...prev };
        delete next[l.id];
        return next;
      });

      showNotice('Listing deleted');
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete listing.');
    } finally {
      setBusyId(null);
    }
  };

  const startAddPhotos = (listingId: number) => {
    setUploadForListingId(listingId);
    setError(null);
    // trigger hidden input
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const onChooseFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const listingId = uploadForListingId;

    // reset input so selecting same file again works
    e.target.value = '';

    if (!listingId || files.length === 0) return;

    setBusyId(listingId);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) throw new Error('Please log in again.');

      // basic limit to avoid huge uploads
      if (files.length > 10) throw new Error('Please upload 10 photos or fewer at a time.');

      const bucket = 'listing-photos';

      const newPhotoRows: PhotoRow[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
        const fileName = `${crypto.randomUUID()}.${safeExt}`;

        const objectPath = `${user.id}/${listingId}/${fileName}`;

        const { error: upErr } = await supabase.storage.from(bucket).upload(objectPath, file, {
          cacheControl: '3600',
          upsert: false,
        });
        if (upErr) throw upErr;

        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
        const publicUrl = publicData?.publicUrl;
        if (!publicUrl) throw new Error('Failed to get public URL for uploaded photo.');

        // Insert row in listing_photos
        const nextSort =
          (photosByListingId[listingId]?.reduce((m, p) => Math.max(m, p.sort_order || 0), 0) || 0) + 1;

        const { data: inserted, error: insErr } = await supabase
          .from('listing_photos')
          .insert({
            listing_id: listingId,
            owner_id: user.id,
            image_url: publicUrl,
            sort_order: nextSort,
          })
          .select('id, created_at, listing_id, owner_id, image_url, sort_order')
          .maybeSingle();

        if (insErr) throw insErr;
        if (inserted) newPhotoRows.push(inserted as PhotoRow);
      }

      // Update UI
      setPhotosByListingId((prev) => {
        const current = prev[listingId] || [];
        return { ...prev, [listingId]: [...current, ...newPhotoRows].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) };
      });

      showNotice('Photos added');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to upload photos.');
    } finally {
      setBusyId(null);
      setUploadForListingId(null);
    }
  };

  const deletePhotoRow = async (photo: PhotoRow) => {
    const ok = confirm('Delete this photo?');
    if (!ok) return;

    setError(null);

    try {
      const { error } = await supabase.from('listing_photos').delete().eq('id', photo.id);
      if (error) throw error;

      setPhotosByListingId((prev) => {
        const current = prev[photo.listing_id] || [];
        return { ...prev, [photo.listing_id]: current.filter((p) => p.id !== photo.id) };
      });

      showNotice('Photo deleted');
      // Note: this deletes the DB row. The storage file remains unless you also store the storage path.
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete photo.');
    }
  };

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
              <span className="text-slate-300">Listings</span>
            </div>

            <h1 className="mt-1 text-xl font-semibold text-slate-50">Listings</h1>
            <p className="mt-1 text-[13px] text-slate-400">
              Create public listing pages and capture inquiries in your lead inbox.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Published: <span className="text-slate-200">{publishedCount}</span> · Total:{' '}
              <span className="text-slate-200">{rows.length}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Keep this if you already have /landlord/listings/new */}
            <Link
              href="/landlord/listings/new"
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              + New listing
            </Link>

            <Link
              href="/landlord"
              className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        {/* Notice / Error */}
        {notice && (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm text-emerald-100">
            {notice}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onChooseFiles}
        />

        {/* Content */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          {loading ? (
            <p className="text-sm text-slate-400">Loading listings…</p>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-200 font-semibold">No listings yet</p>
              <p className="mt-1 text-[13px] text-slate-400">
                Create your first listing and publish a shareable link.
              </p>
              <Link
                href="/landlord/listings/new"
                className="mt-4 inline-flex rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Create listing
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => {
                const loc = [r.city, r.state].filter(Boolean).join(', ');
                const photos = photosByListingId[r.id] || [];

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-50">{r.title}</p>

                          {r.published ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                              Published
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                              Draft
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-[11px] text-slate-400">
                          {money(r.rent_amount)} / mo
                          <span className="mx-2">•</span>
                          {r.beds != null ? `${r.beds} bd` : '—'} · {r.baths != null ? `${r.baths} ba` : '—'}
                          <span className="mx-2">•</span>
                          {loc || 'Location not set'}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-500">
                          Created {niceDate(r.created_at)}
                          {r.published ? (
                            <>
                              <span className="mx-2">•</span>
                              <span className="text-emerald-300 font-medium">
                                Published {r.published_at ? niceDate(r.published_at) : ''}
                              </span>
                            </>
                          ) : null}
                        </p>

                        {/* Photos */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-slate-400">
                              Photos <span className="text-slate-500">({photos.length})</span>
                            </p>
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => startAddPhotos(r.id)}
                              className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                            >
                              {busyId === r.id ? 'Uploading…' : '+ Add photos'}
                            </button>
                          </div>

                          {photos.length === 0 ? (
                            <p className="mt-2 text-[11px] text-slate-500">
                              No photos yet. Add a few to make your listing look legit.
                            </p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {photos.slice(0, 8).map((p) => (
                                <div
                                  key={p.id}
                                  className="relative h-16 w-24 overflow-hidden rounded-lg border border-slate-800 bg-slate-950"
                                  title="Click X to remove"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={p.image_url}
                                    alt="Listing photo"
                                    className="h-full w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => deletePhotoRow(p)}
                                    className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-950/80 text-[12px] text-slate-200 hover:bg-slate-900 border border-slate-700"
                                    aria-label="Delete photo"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              {photos.length > 8 && (
                                <div className="h-16 w-24 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center justify-center">
                                  <span className="text-[11px] text-slate-400">+{photos.length - 8}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {/* Always blue Edit */}
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                        >
                          Edit
                        </button>

                        {r.published && (
                          <button
                            type="button"
                            onClick={() => copyPublicLink(r.slug)}
                            className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                          >
                            Copy public link
                          </button>
                        )}

                        <a
                          href={`/listings/${r.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                        >
                          Preview
                        </a>

                        <button
                          type="button"
                          disabled={busyId === r.id}
                          onClick={() => togglePublish(r)}
                          className={`rounded-full px-4 py-2 text-xs font-semibold ${
                            r.published
                              ? 'border border-rose-500/50 bg-rose-950/30 text-rose-100 hover:bg-rose-950/40'
                              : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                          } disabled:opacity-60`}
                        >
                          {busyId === r.id ? 'Saving…' : r.published ? 'Unpublish' : 'Publish'}
                        </button>

                        {/* Delete only if NOT published */}
                        {!r.published && (
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => deleteListing(r)}
                            className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-slate-800 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Slug & URL */}
                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400">
                        Slug:{' '}
                        <span className="text-slate-200 font-mono">{r.slug}</span>
                        <span className="mx-2">•</span>
                        <span className="text-slate-500">
                          Public URL: {siteUrl.replace(/\/$/, '')}/listings/{r.slug}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* EDIT MODAL */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => (editBusy ? null : closeEdit())}
          />

          <div className="relative z-10 w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Edit listing</p>
                <p className="mt-1 text-sm text-slate-300">
                  Update details. Slug changes are blocked after publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                disabled={editBusy}
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-[11px] text-slate-400">Title</label>
                <input
                  value={formTitle}
                  onChange={(e) => {
                    setFormTitle(e.target.value);
                    // keep slug loosely in sync only if user hasn’t typed a custom one
                    if (!formSlug || formSlug === slugify(formTitle)) {
                      setFormSlug(slugify(e.target.value));
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="e.g., 2BR in Downtown"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] text-slate-400">Slug</label>
                <input
                  value={formSlug}
                  onChange={(e) => setFormSlug(slugify(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 font-mono outline-none focus:border-emerald-500/60"
                  placeholder="e.g., 2br-downtown"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  URL preview: {siteUrl.replace(/\/$/, '')}/listings/{formSlug || 'your-slug'}
                </p>
              </div>

              <div>
                <label className="text-[11px] text-slate-400">City</label>
                <input
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">State</label>
                <input
                  value={formState}
                  onChange={(e) => setFormState(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="e.g., RI"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Neighborhood</label>
                <input
                  value={formNeighborhood}
                  onChange={(e) => setFormNeighborhood(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Available date</label>
                <input
                  type="date"
                  value={formAvailableDate}
                  onChange={(e) => setFormAvailableDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Rent (monthly)</label>
                <input
                  inputMode="numeric"
                  value={formRent}
                  onChange={(e) => setFormRent(e.target.value.replace(/[^\d]/g, ''))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="e.g., 2200"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Deposit</label>
                <input
                  inputMode="numeric"
                  value={formDeposit}
                  onChange={(e) => setFormDeposit(e.target.value.replace(/[^\d]/g, ''))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="e.g., 2200"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Beds</label>
                <input
                  inputMode="decimal"
                  value={formBeds}
                  onChange={(e) => setFormBeds(e.target.value.replace(/[^\d.]/g, ''))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="e.g., 2"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Baths</label>
                <input
                  inputMode="decimal"
                  value={formBaths}
                  onChange={(e) => setFormBaths(e.target.value.replace(/[^\d.]/g, ''))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="e.g., 1"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Sqft</label>
                <input
                  inputMode="numeric"
                  value={formSqft}
                  onChange={(e) => setFormSqft(e.target.value.replace(/[^\d]/g, ''))}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="e.g., 900"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Contact email</label>
                <input
                  value={formContactEmail}
                  onChange={(e) => setFormContactEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="Optional"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400">Contact phone</label>
                <input
                  value={formContactPhone}
                  onChange={(e) => setFormContactPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="Optional"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[11px] text-slate-400">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="mt-1 w-full min-h-[110px] rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500/60"
                  placeholder="Add details, amenities, lease terms, etc."
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  id="hideAddr"
                  type="checkbox"
                  checked={formHideExactAddress}
                  onChange={(e) => setFormHideExactAddress(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="hideAddr" className="text-[12px] text-slate-300">
                  Hide exact address on public page (recommended)
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editBusy}
                className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveEdit}
                disabled={editBusy}
                className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {editBusy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
