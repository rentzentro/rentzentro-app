'use client';

import { useEffect, useMemo, useState } from 'react';
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
  rent_amount: number | null;
  beds: number | null;
  baths: number | null;
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

export default function LandlordListingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://www.rentzentro.com';

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
          'id, created_at, owner_id, title, slug, published, published_at, status, city, state, rent_amount, beds, baths'
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRows((data || []) as ListingRow[]);
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

  const publishedCount = useMemo(
    () => rows.filter((r) => r.published).length,
    [rows]
  );

  const togglePublish = async (listing: ListingRow) => {
    if (busyId) return;

    // Confirm unpublish (publish doesn't need confirmation)
    if (listing.published) {
      const ok = window.confirm(
        `Unpublish this listing?\n\n"${listing.title}"\n\nIt will no longer be visible on the public page.`
      );
      if (!ok) return;
    }

    setBusyId(listing.id);
    setError(null);

    try {
      const nextPublished = !listing.published;

      const payload: any = {
        published: nextPublished,
        published_at: nextPublished ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('listings')
        .update(payload)
        .eq('id', listing.id);

      if (error) throw error;

      setRows((prev) =>
        prev.map((r) =>
          r.id === listing.id
            ? { ...r, published: nextPublished, published_at: payload.published_at }
            : r
        )
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to update publish status.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteDraft = async (listing: ListingRow) => {
    if (busyId) return;
    if (listing.published) return;

    const ok = window.confirm(
      `Delete this draft listing?\n\n"${listing.title}"\n\nThis cannot be undone.`
    );
    if (!ok) return;

    setBusyId(listing.id);
    setError(null);

    try {
      const { error } = await supabase.from('listings').delete().eq('id', listing.id);
      if (error) throw error;

      setRows((prev) => prev.filter((r) => r.id !== listing.id));
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to delete listing.');
    } finally {
      setBusyId(null);
    }
  };

  const copyPublicLink = async (slug: string) => {
    const url = `${siteUrl.replace(/\/$/, '')}/listings/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('Public link copied to clipboard!');
    } catch {
      prompt('Copy this link:', url);
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

        {error && (
          <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        {/* Content */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          {/* How it works + Tips */}
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                How listings work
              </p>

              <div className="mt-2 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold text-slate-200">
                    Create &amp; publish in 4 steps
                  </p>
                  <ol className="mt-2 space-y-1 text-[12px] text-slate-300 list-decimal list-inside">
                    <li>
                      Click <span className="font-semibold text-slate-100">+ New listing</span>
                    </li>
                    <li>
                      Fill out details and click{' '}
                      <span className="font-semibold text-slate-100">Create draft</span>
                    </li>
                    <li>
                      Upload photos, then click{' '}
                      <span className="font-semibold text-slate-100">Save changes</span>
                    </li>
                    <li>
                      Click <span className="font-semibold text-emerald-300">Publish</span> to make
                      it public
                    </li>
                  </ol>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                  <p className="text-[11px] font-semibold text-slate-200">Share the link</p>
                  <ol className="mt-2 space-y-1 text-[12px] text-slate-300 list-decimal list-inside">
                    <li>
                      Find a listing with the{' '}
                      <span className="font-semibold text-emerald-300">Published</span> badge
                    </li>
                    <li>
                      Click <span className="font-semibold text-slate-100">Copy link</span>
                    </li>
                    <li>
                      Paste it anywhere (Facebook groups, Marketplace, Craigslist, text)
                    </li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Listing tips
              </p>

              <ul className="mt-3 space-y-2 text-[12px] text-slate-300">
                <li>
                  <span className="font-semibold text-slate-100">Use a strong title:</span> “Updated
                  2BR • Parking • Laundry”
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Add 6–12 photos</span> (bright,
                  wide shots first)
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Cover photo matters:</span> first
                  photo is what people click
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Be clear:</span> rent, deposit,
                  availability, pets
                </li>
                <li>
                  <span className="font-semibold text-slate-100">Hide exact address</span> until a
                  showing is scheduled (recommended)
                </li>
              </ul>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[11px] text-slate-400">
                  Pro tip: Posting the public link in multiple places is the fastest way to fill a
                  unit.
                </p>
              </div>
            </div>
          </div>

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
                const editHref = `/landlord/listings/new?id=${r.id}`;
                const isBusy = busyId === r.id;

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
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
                          {r.beds != null ? `${r.beds} bd` : '—'} ·{' '}
                          {r.baths != null ? `${r.baths} ba` : '—'}
                          <span className="mx-2">•</span>
                          {loc || 'Location not set'}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-500">
                          Created {niceDate(r.created_at)}
                          {r.published && r.published_at ? (
                            <>
                              <span className="mx-2">•</span>
                              Published {niceDate(r.published_at)}
                            </>
                          ) : null}
                        </p>
                      </div>

                      {/* Buttons (match tenant page colors) */}
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {/* Edit = blue OUTLINE (like tenant page) */}
                        <Link
                          href={editHref}
                          className="rounded-full border border-sky-500/60 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/15"
                        >
                          Edit
                        </Link>

                        {r.published && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => copyPublicLink(r.slug)}
                            className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60"
                          >
                            Copy link
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

                        {/* Publish/Unpublish = green OUTLINE */}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => togglePublish(r)}
                          className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-60"
                        >
                          {isBusy ? 'Saving…' : r.published ? 'Unpublish' : 'Publish'}
                        </button>

                        {/* Delete = red outline, drafts only */}
                        {!r.published && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => deleteDraft(r)}
                            className="rounded-full border border-rose-500/50 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-950/40 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <p className="text-[11px] text-slate-400">
                        Slug: <span className="text-slate-200 font-mono">{r.slug}</span>
                        {r.published && (
                          <>
                            <span className="mx-2">•</span>
                            <span className="text-slate-500">
                              Public URL: {siteUrl.replace(/\/$/, '')}/listings/{r.slug}
                            </span>
                          </>
                        )}
                      </p>
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
