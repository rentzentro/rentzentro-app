'use client';

import { useEffect, useState } from 'react';

type Props = {
  listingId: number;
  listingTitle: string;
};

const savedListingsKey = 'rentzentro:saved-listings';

const readSavedListingIds = () => {
  if (typeof window === 'undefined') return new Set<number>();

  try {
    const raw = window.localStorage.getItem(savedListingsKey);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : []);
  } catch {
    return new Set<number>();
  }
};

const writeSavedListingIds = (ids: Set<number>) => {
  window.localStorage.setItem(savedListingsKey, JSON.stringify(Array.from(ids)));
};

export default function SaveListingButton({ listingId, listingTitle }: Props) {
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setIsSaved(readSavedListingIds().has(listingId));
  }, [listingId]);

  const handleToggle = () => {
    const savedIds = readSavedListingIds();
    const nextSaved = !savedIds.has(listingId);

    if (nextSaved) {
      savedIds.add(listingId);
    } else {
      savedIds.delete(listingId);
    }

    writeSavedListingIds(savedIds);
    setIsSaved(nextSaved);
    setStatus(nextSaved ? 'Saved to this browser' : 'Removed from saved listings');
  };

  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
      <button
        type="button"
        aria-label={`${isSaved ? 'Unsave' : 'Save'} ${listingTitle}`}
        aria-pressed={isSaved}
        onClick={handleToggle}
        className={`grid h-10 w-10 place-items-center rounded-full shadow-lg backdrop-blur transition focus:outline-none focus:ring-4 focus:ring-rose-400/40 ${
          isSaved
            ? 'bg-rose-500 text-white hover:bg-rose-400'
            : 'bg-slate-950/70 text-white hover:bg-rose-500'
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill={isSaved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
        </svg>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
      {isSaved ? (
        <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-black text-white shadow-lg">
          Saved
        </span>
      ) : null}
    </div>
  );
}
