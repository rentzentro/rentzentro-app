'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Photo = {
  id: number;
  image_url: string;
  sort_order: number;
};

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const safe = useMemo(() => (Array.isArray(photos) ? photos : []), [photos]);

  const ordered = useMemo(
    () =>
      [...safe]
        .filter((p) => !!p?.image_url)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [safe]
  );

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const startX = useRef<number | null>(null);

  const close = () => setOpenIndex(null);

  const prev = () => {
    if (openIndex == null) return;
    setOpenIndex((i) => (i == null ? null : (i - 1 + ordered.length) % ordered.length));
  };

  const next = () => {
    if (openIndex == null) return;
    setOpenIndex((i) => (i == null ? null : (i + 1) % ordered.length));
  };

  // Lock scroll while open
  useEffect(() => {
    if (openIndex == null) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [openIndex]);

  // Keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (openIndex == null) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex, ordered.length]);

  if (!ordered.length) {
    return <p className="mt-3 text-sm text-slate-400">No photos uploaded yet.</p>;
  }

  const active = openIndex != null ? ordered[openIndex] : null;

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ordered.map((ph, idx) => (
          <button
            key={ph.id}
            type="button"
            onClick={() => setOpenIndex(idx)}
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 text-left"
            aria-label={`Open photo ${idx + 1}`}
            title="Click to expand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ph.image_url}
              alt={`Listing photo ${idx + 1}`}
              className="h-56 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="pointer-events-none absolute bottom-2 left-2 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
              {idx + 1} / {ordered.length}
            </div>

            <div className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-slate-700 bg-slate-950/70 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
              Click to expand
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {openIndex != null && active?.image_url && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-[2px] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // click outside to close
            if (e.target === e.currentTarget) close();
          }}
          onTouchStart={(e) => {
            startX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const sx = startX.current;
            const ex = e.changedTouches[0]?.clientX ?? null;
            startX.current = null;
            if (sx == null || ex == null) return;
            const dx = ex - sx;
            if (Math.abs(dx) < 40) return;
            if (dx > 0) prev();
            else next();
          }}
        >
          <div className="w-full max-w-5xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-300">
                Photo <span className="text-slate-50 font-semibold">{openIndex + 1}</span> /{' '}
                <span className="text-slate-50 font-semibold">{ordered.length}</span>
              </p>

              <div className="flex items-center gap-2">
                <a
                  href={active.image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900"
                >
                  Open full size
                </a>

                <button
                  type="button"
                  onClick={close}
                  className="rounded-full border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.image_url}
                alt={`Listing photo ${openIndex + 1} large`}
                className="max-h-[75vh] w-full object-contain"
              />

              {ordered.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900"
                    aria-label="Previous photo"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900"
                    aria-label="Next photo"
                  >
                    ▶
                  </button>
                </>
              )}
            </div>

            <p className="mt-2 text-[11px] text-slate-400">
              Tip: Use ← → keys on desktop or swipe on mobile.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
