// app/landlord/documents/page.tsx
'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../supabaseClient';

// ---------- Types ----------

type PropertyRow = {
  id: number;
  name: string | null;
  unit_label: string | null;
};

type DocumentRow = {
  id: number;
  created_at: string;
  title: string;
  file_url: string;
  storage_path: string;
  property_id: number | null;
};

// ---------- Constants ----------

const ESIGN_PRICE_PER_SIGNATURE = 2.95;

// ---------- Helpers ----------

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

// ---------- Component ----------

export default function LandlordDocumentsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [propertyId, setPropertyId] = useState<number | ''>('');

  // E-sign purchase info
  const [landlordUserId, setLandlordUserId] = useState<string | null>(null);
  const [esignTotalPurchased, setEsignTotalPurchased] = useState<number | null>(
    null
  );
  const [buyQuantity, setBuyQuantity] = useState<number>(10);
  const [buying, setBuying] = useState(false);

  // E-sign usage (sending envelopes)
  const [activeEsignDocId, setActiveEsignDocId] = useState<number | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [sendingEnvelope, setSendingEnvelope] = useState(false);
  const [esignSuccess, setEsignSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData?.user) {
          router.push('/landlord/login');
          return;
        }

        const user = authData.user;
        setLandlordUserId(user.id);

        // Properties
        const { data: propRows, error: propError } = await supabase
          .from('properties')
          .select('id, name, unit_label')
          .order('name', { ascending: true });

        if (propError) throw propError;
        setProperties((propRows || []) as PropertyRow[]);

        // Documents
        const { data: docRows, error: docError } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (docError) throw docError;
        setDocuments((docRows || []) as DocumentRow[]);

        // E-sign purchases
        try {
          const { data: esignRows, error: esignError } = await supabase
            .from('esign_purchases')
            .select('signatures')
            .eq('landlord_user_id', user.id);

          if (esignError) {
            console.warn(
              '[documents] E-sign purchases lookup error:',
              esignError
            );
          } else if (esignRows) {
            const total = (esignRows as any[]).reduce(
              (sum, row) => sum + (row.signatures ?? 0),
              0
            );
            setEsignTotalPurchased(total);
          }
        } catch (innerErr) {
          console.warn('[documents] E-sign purchases lookup failed:', innerErr);
        }
      } catch (err: any) {
        console.error(err);
        setError(
          err?.message || 'Failed to load documents. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  // ---------- Upload document ----------

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a document title.');
      return;
    }
    if (propertyId === '') {
      setError('Please choose a property to link this document to.');
      return;
    }

    const propertyIdNumber = propertyId as number;

    setUploading(true);
    setError(null);

    try {
      const bucket = 'documents';
      const safe = title.trim().replace(/[^a-z0-9-_]+/gi, '-');
      const path = `landlord-docs/${Date.now()}-${safe}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path);
      const fileUrl = urlData?.publicUrl;
      if (!fileUrl) throw new Error('Failed to retrieve file URL.');

      const { data: insert, error: insertError } = await supabase
        .from('documents')
        .insert({
          title: title.trim(),
          file_url: fileUrl,
          storage_path: path,
          property_id: propertyIdNumber,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      setDocuments((prev) => [insert as DocumentRow, ...prev]);
      setTitle('');
      setPropertyId('');
      setFile(null);

      const inputEl = document.getElementById(
        'doc-file-input'
      ) as HTMLInputElement | null;
      if (inputEl) inputEl.value = '';
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected upload error.');
    } finally {
      setUploading(false);
    }
  };

  // ---------- Delete document ----------

  const handleDelete = async (doc: DocumentRow) => {
    if (!window.confirm('Delete this document?')) return;

    try {
      await supabase.storage.from('documents').remove([doc.storage_path]);

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete document.');
    }
  };

  const propertyLabel = (id: number | null) => {
    if (!id) return 'Not linked';
    const p = properties.find((x) => x.id === id);
    if (!p) return 'Unknown property';
    return `${p.name || 'Property'}${p.unit_label ? ` · ${p.unit_label}` : ''}`;
  };

  // ---------- Buy signatures ----------

  const handleBuySignatures = async (e: FormEvent) => {
    e.preventDefault();
    if (!buyQuantity || buyQuantity <= 0) {
      setError('Please enter a valid number of signatures to purchase.');
      return;
    }

    setBuying(true);
    setError(null);

    try {
      const res = await fetch('/api/esign/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: buyQuantity }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.url) {
        throw new Error(
          data?.error ||
            'Failed to start e-sign checkout. Please double-check your Stripe configuration.'
        );
      }

      window.location.href = data.url as string;
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Something went wrong starting the e-sign checkout session.'
      );
    } finally {
      setBuying(false);
    }
  };

  const estimatedTotal =
    buyQuantity > 0
      ? (buyQuantity * ESIGN_PRICE_PER_SIGNATURE).toFixed(2)
      : null;

  // ---------- Start e-sign request ----------

  const handleStartEsign = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeEsignDocId) {
      setError('Please choose a document to send for e-sign.');
      return;
    }
    if (!landlordUserId) {
      setError('Unable to find your landlord account. Please log in again.');
      return;
    }
    if (!signerName.trim() || !signerEmail.trim()) {
      setError('Please enter the tenant’s name and email.');
      return;
    }

    const doc = documents.find((d) => d.id === activeEsignDocId);
    if (!doc) {
      setError('Selected document was not found.');
      return;
    }

    setSendingEnvelope(true);
    setError(null);
    setEsignSuccess(null);

    try {
      const res = await fetch('/api/esign/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landlordUserId,
          documentId: doc.id,
          documentTitle: doc.title,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            'Failed to create e-sign envelope. Please try again.'
        );
      }

      const remaining =
        typeof data?.remainingCredits === 'number'
          ? data.remainingCredits
          : null;

      setEsignSuccess(
        remaining != null
          ? `E-sign request started. Remaining credits: ${remaining}.`
          : 'E-sign request started.'
      );
      setSignerName('');
      setSignerEmail('');
      setActiveEsignDocId(null);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Unexpected error while starting the e-sign request.'
      );
    } finally {
      setSendingEnvelope(false);
    }
  };

  // ---------- UI ----------

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-xs text-slate-500 flex gap-2">
              <Link href="/landlord" className="hover:text-emerald-400">
                Landlord
              </Link>
              <span>/</span>
              <span className="text-slate-300">Documents</span>
            </div>

            <h1 className="text-xl font-semibold mt-1 text-slate-50">
              Leases & documents
            </h1>
            <p className="text-[13px] text-slate-400">
              Upload leases, addenda, and important files for your properties.
            </p>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            ← Back
          </button>
        </div>

        {/* Error / success banners */}
        {error && (
          <div className="mb-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        {esignSuccess && (
          <div className="mb-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 px-4 py-3 text-sm text-emerald-100">
            {esignSuccess}
          </div>
        )}

        {/* E-SIGNATURES PURCHASE PANEL */}
        <section className="mb-6 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                E-signatures (per signature)
              </p>
              <p className="mt-1 text-sm text-slate-50">
                Purchase e-signature credits so you can send leases and forms
                for electronic signature directly from RentZentro.
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Credits are paid by you as the landlord. Tenants never pay to
                sign.
              </p>
              <p className="mt-1 text-[11px] text-emerald-200">
                Price: ${ESIGN_PRICE_PER_SIGNATURE.toFixed(2)} per signature
                (billed via Stripe at checkout).
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-right text-[11px] min-w-[190px]">
              <p className="text-slate-300">Signatures purchased</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                {esignTotalPurchased == null
                  ? '—'
                  : esignTotalPurchased.toLocaleString('en-US')}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Based on completed purchases
              </p>
            </div>
          </div>

          <form
            onSubmit={handleBuySignatures}
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <label
                htmlFor="esign-qty"
                className="text-slate-300 whitespace-nowrap"
              >
                Signatures to purchase
              </label>
              <input
                id="esign-qty"
                type="number"
                min={1}
                value={buyQuantity}
                onChange={(e) =>
                  setBuyQuantity(Number(e.target.value) || 0)
                }
                className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-slate-500">
                Total charged:{' '}
                <span className="font-semibold text-emerald-300">
                  {estimatedTotal ? `$${estimatedTotal}` : '—'}
                </span>
              </span>
            </div>

            <button
              type="submit"
              disabled={buying}
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {buying ? 'Starting checkout…' : 'Buy e-signatures'}
            </button>
          </form>
        </section>

        {/* USE E-SIGNATURES INSTRUCTIONS */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Use e-signatures
          </p>
          <p className="mt-2 text-[11px] text-slate-300">
            1) Upload a lease or form below. 2) In the{' '}
            <span className="font-semibold">Stored documents</span> list, choose
            a document and enter your tenant&apos;s name and email. 3) RentZentro
            will create an e-sign request and email your tenant a secure link to
            sign online.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Upload at least one document before starting an e-sign request.
          </p>
        </section>

        {/* Upload Form */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Upload new document
          </p>

          <form
            onSubmit={handleUpload}
            className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)]"
          >
            {/* LEFT SIDE INPUTS */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Document title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: 2025 Lease Agreement"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Linked property
                </label>
                <select
                  value={propertyId === '' ? '' : propertyId}
                  onChange={(e) =>
                    setPropertyId(
                      e.target.value === '' ? '' : Number(e.target.value)
                    )
                  }
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 focus:ring-emerald-500"
                >
                  <option value="">Select property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || 'Property'}
                      {p.unit_label ? ` · ${p.unit_label}` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Required so RentZentro knows which unit and tenant this
                  document belongs to.
                </p>
              </div>
            </div>

            {/* RIGHT SIDE: FILE + UPLOAD */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  File
                </label>

                <input
                  id="doc-file-input"
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-[13px] text-slate-300 file:bg-slate-700 file:text-slate-100 file:border file:border-slate-600 file:rounded-md file:px-3 file:py-1.5 hover:file:bg-slate-600"
                />

                <p className="mt-1 text-[11px] text-slate-500">
                  PDF, images, and documents supported.
                </p>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {uploading ? 'Uploading…' : 'Upload document'}
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* Documents List + E-sign usage */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <p className="text-xs text-slate-500 uppercase tracking-wide">
            Stored documents
          </p>

          {loading ? (
            <p className="text-xs text-slate-400 mt-3">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="text-xs text-slate-500 mt-3">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="mt-3 space-y-3 text-xs">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100 truncate">
                        {doc.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {propertyLabel(doc.property_id)} •{' '}
                        {formatDate(doc.created_at)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveEsignDocId((prev) =>
                            prev === doc.id ? null : doc.id
                          );
                          setSignerName('');
                          setSignerEmail('');
                          setEsignSuccess(null);
                        }}
                        className="text-[11px] px-3 py-1 rounded-full border border-emerald-500/70 bg-emerald-900/40 hover:bg-emerald-800/60"
                      >
                        Use e-sign
                      </button>

                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] px-3 py-1 rounded-full border border-slate-700 bg-slate-900 hover:bg-slate-800"
                      >
                        Open
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        className="text-[11px] px-3 py-1 rounded-full border border-rose-500/60 bg-rose-900/60 hover:bg-rose-800/80"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {activeEsignDocId === doc.id && (
                    <form
                      onSubmit={handleStartEsign}
                      className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3"
                    >
                      <p className="text-[11px] text-slate-400 mr-2">
                        Send for e-sign:
                      </p>
                      <input
                        type="text"
                        placeholder="Tenant name"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="min-w-[140px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-50 focus:ring-emerald-500"
                      />
                      <input
                        type="email"
                        placeholder="Tenant email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        className="min-w-[180px] rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-50 focus:ring-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={sendingEnvelope}
                        className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                      >
                        {sendingEnvelope ? 'Creating…' : 'Send e-sign request'}
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500">
            Tenants will be able to view documents assigned to their unit and
            sign e-sign requests sent from this page.
          </p>
        </section>
      </div>
    </div>
  );
}
