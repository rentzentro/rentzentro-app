'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Photo = {
  id: number;
  image_url: string;
  sort_order: number;
};

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const ordered = useMemo(
    () => [...photos].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [photos]
  );

  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const startX = useRef<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  const prev = useCallback(() => {
    setOpenIndex((i) => {
      if (i == null) return null;
      return (i - 1 + ordered.length) % ordered.length;
    });
  }, [ordered.length]);

  const next = useCallback(() => {
    setOpenIndex((i) => {
      if (i == null) return null;
      return (i + 1) % ordered.length;
    });
  }, [ordered.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (openIndex == null) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, next, openIndex, prev]);

  if (!ordered.length) {
    return <p className="mt-3 text-sm text-slate-400">No photos uploaded yet.</p>;
  }

  return (
    <>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {ordered.map((ph, idx) => (
          <button
            key={ph.id}
            type="button"
            onClick={() => setOpenIndex(idx)}
            className="group overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 text-left"
            aria-label="Open photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ph.image_url}
              alt="Listing photo"
              className="h-56 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {openIndex != null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-[2px] flex items-center justify-center px-4"
          onMouseDown={(e) => {
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
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] text-slate-300">
                Photo <span className="text-slate-50 font-semibold">{openIndex + 1}</span> /{' '}
                <span className="text-slate-50 font-semibold">{ordered.length}</span>
              </p>

              <button
                type="button"
                onClick={close}
                className="rounded-full border border-slate-600 bg-slate-900/60 px-3 py-2 text-xs text-slate-100 hover:bg-slate-900"
              >
                Close
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ordered[openIndex].image_url}
              alt="Listing photo full"
              className="max-h-[78vh] w-full rounded-2xl border border-slate-700 object-contain bg-slate-950"
            />

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={prev}
                className="rounded-full border border-slate-600 bg-slate-900/70 px-4 py-2 text-xs text-slate-100 hover:bg-slate-900"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={next}
                className="rounded-full border border-slate-600 bg-slate-900/70 px-4 py-2 text-xs text-slate-100 hover:bg-slate-900"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
