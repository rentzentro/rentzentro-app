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

const formatCurrency = (amount: number) =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Price per signature (Stripe price matches this)
const ESIGN_PRICE_PER_SIGNATURE = 2.95;

// ---------- Component ----------

export default function LandlordDocumentsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [propertyId, setPropertyId] = useState<number | ''>('');

  // Auth / landlord
  const [landlordUserId, setLandlordUserId] = useState<string | null>(null);

  // E-signatures (per-signature landlord pay)
  const [esignTotalPurchased, setEsignTotalPurchased] = useState<number | null>(
    null
  );
  const [esignUsedCount, setEsignUsedCount] = useState<number | null>(null);
  const [buyQuantity, setBuyQuantity] = useState<number>(10);
  const [buying, setBuying] = useState(false);

  // E-sign "send for signature" modal
  const [activeEsignDoc, setActiveEsignDoc] = useState<DocumentRow | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [startingEsign, setStartingEsign] = useState(false);

  // ---------- Initial load ----------

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      setBannerMessage(null);

      try {
        // Make sure we have a logged-in landlord
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

        // E-sign purchases (total signatures purchased by this landlord)
        try {
          const { data: esignRows, error: esignError } = await supabase
            .from('esign_purchases')
            .select('signatures')
            .eq('landlord_user_id', user.id);

          if (esignError) {
            console.warn(
              '[documents] E-sign purchases table not available or query failed:',
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

        // E-sign usage (envelopes = used credits)
        try {
          const { data: envelopeRows, error: envelopeError } = await supabase
            .from('esign_envelopes')
            .select('id')
            .eq('landlord_user_id', user.id);

          if (envelopeError) {
            console.warn(
              '[documents] E-sign envelopes lookup error:',
              envelopeError
            );
          } else if (envelopeRows) {
            setEsignUsedCount(envelopeRows.length);
          }
        } catch (innerErr) {
          console.warn('[documents] E-sign envelopes lookup failed:', innerErr);
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

  // ---------- Derived e-sign values ----------

  const remainingSignatures =
    esignTotalPurchased != null && esignUsedCount != null
      ? Math.max(esignTotalPurchased - esignUsedCount, 0)
      : null;

  const totalCharge =
    buyQuantity && buyQuantity > 0
      ? buyQuantity * ESIGN_PRICE_PER_SIGNATURE
      : 0;

  // ---------- Handlers ----------

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError('Please choose a file to upload.');
      setBannerMessage(null);
      return;
    }
    if (!title.trim()) {
      setError('Please enter a document title.');
      setBannerMessage(null);
      return;
    }

    setUploading(true);
    setError(null);
    setBannerMessage(null);

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
          property_id: propertyId === '' ? null : propertyId,
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

      setBannerMessage('Document uploaded.');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Unexpected upload error.');
      setBannerMessage(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentRow) => {
    if (!window.confirm('Delete this document?')) return;

    setError(null);
    setBannerMessage(null);

    try {
      await supabase.storage.from('documents').remove([doc.storage_path]);

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setBannerMessage('Document deleted.');
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

  const handleBuySignatures = async (e: FormEvent) => {
    e.preventDefault();
    if (!buyQuantity || buyQuantity <= 0) {
      setError('Please enter a valid number of signatures to purchase.');
      setBannerMessage(null);
      return;
    }

    setBuying(true);
    setError(null);
    setBannerMessage(null);

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

      // Redirect to Stripe Checkout
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

  const openEsignModal = (doc: DocumentRow) => {
    setActiveEsignDoc(doc);
    setSignerName('');
    setSignerEmail('');
    setError(null);
    setBannerMessage(null);
  };

  const closeEsignModal = () => {
    setActiveEsignDoc(null);
    setSignerName('');
    setSignerEmail('');
    setStartingEsign(false);
  };

  const handleStartEsign = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeEsignDoc || !landlordUserId) return;

    if (!signerName.trim() || !signerEmail.trim()) {
      setError('Please enter your tenant’s name and email to start e-sign.');
      setBannerMessage(null);
      return;
    }

    setStartingEsign(true);
    setError(null);
    setBannerMessage(null);

    try {
      const res = await fetch('/api/esign/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landlordUserId,
          documentId: activeEsignDoc.id,
          documentTitle: activeEsignDoc.title,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.error ||
            'Failed to start e-sign request. Please make sure you have available credits.'
        );
      }

      // Optimistically bump used count so remaining updates immediately
      setEsignUsedCount((prev) =>
        prev == null ? prev : prev + 1
      );

      setBannerMessage(
        'E-sign request created. One signature credit has been used.'
      );
      closeEsignModal();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.message ||
          'Unexpected error while starting the e-sign request.'
      );
    } finally {
      setStartingEsign(false);
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

          {/* BACK BUTTON */}
          <button
            type="button"
            onClick={() => router.back()}
            className="text-xs px-3 py-2 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
          >
            ← Back
          </button>
        </div>

        {/* Error / success banners */}
        {(error || bannerMessage) && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? 'border-rose-500/50 bg-rose-950/40 text-rose-100'
                : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
            }`}
          >
            {error || bannerMessage}
          </div>
        )}

        {/* E-SIGNATURES: PURCHASE + COUNTS */}
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
                Price:{' '}
                <span className="font-semibold">
                  {formatCurrency(ESIGN_PRICE_PER_SIGNATURE)}
                </span>{' '}
                per signature (billed via Stripe at checkout).
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/50 px-3 py-2 text-right text-[11px] min-w-[210px]">
              <p className="text-slate-300">Remaining signatures</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300">
                {remainingSignatures != null
                  ? remainingSignatures.toLocaleString('en-US')
                  : '—'}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Purchased:{' '}
                {esignTotalPurchased != null
                  ? esignTotalPurchased.toLocaleString('en-US')
                  : '—'}
              </p>
              <p className="text-[10px] text-slate-500">
                Used:{' '}
                {esignUsedCount != null
                  ? esignUsedCount.toLocaleString('en-US')
                  : '—'}
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
                onChange={(e) => setBuyQuantity(Number(e.target.value) || 0)}
                className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-slate-500">
                Total charged = quantity ×{' '}
                {formatCurrency(ESIGN_PRICE_PER_SIGNATURE)}{' '}
                {buyQuantity > 0 && (
                  <span className="text-slate-300 ml-1">
                    ({formatCurrency(totalCharge)})
                  </span>
                )}
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

        {/* HOW TO USE E-SIGNATURES */}
        <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Use e-signatures
          </p>
          <p className="mt-2 text-[11px] text-slate-300">
            1) Upload a lease or form below. 2) In the stored documents list,
            click <span className="font-semibold">“Send for e-signature”</span>{' '}
            and enter your tenant&apos;s name and email. 3) RentZentro will
            create an e-sign request and email your tenant a secure link to
            sign.
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
                  Linked property (optional)
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
                  <option value="">No specific property</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || 'Property'}
                      {p.unit_label ? ` · ${p.unit_label}` : ''}
                    </option>
                  ))}
                </select>
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

        {/* Documents List */}
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
            <div className="mt-3 space-y-2 text-xs">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-100 truncate">
                      {doc.title}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {propertyLabel(doc.property_id)} •{' '}
                      {formatDate(doc.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
                      onClick={() => openEsignModal(doc)}
                      className="text-[11px] px-3 py-1 rounded-full border border-emerald-500/70 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                    >
                      Send for e-signature
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(doc)}
                      className="text-[11px] px-3 py-1 rounded-full border border-rose-500/60 bg-rose-900/60 hover:bg-rose-800/80"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-3 text-[11px] text-slate-500">
            Tenants will be able to view documents assigned to their unit.
          </p>
        </section>
      </div>

      {/* E-SIGN MODAL */}
      {activeEsignDoc && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">
                  Send for e-signature
                </p>
                <p className="mt-1 text-sm text-slate-50">
                  {activeEsignDoc.title}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEsignModal}
                className="text-[11px] text-slate-400 hover:text-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleStartEsign} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Tenant name
                </label>
                <input
                  type="text"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Ex: John Smith"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Tenant email
                </label>
                <input
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="tenant@example.com"
                />
              </div>

              <p className="text-[11px] text-slate-500">
                This will use{' '}
                <span className="font-semibold text-emerald-300">
                  one signature credit
                </span>{' '}
                from your account. RentZentro will email your tenant a secure
                link to sign.
              </p>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeEsignModal}
                  className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startingEsign}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {startingEsign ? 'Creating request…' : 'Send for e-signature'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
