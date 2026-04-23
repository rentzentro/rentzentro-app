'use client';

import { useState } from 'react';

type Props = {
  defaultLocation?: string;
};

export default function ListingsSearchForm({ defaultLocation = '' }: Props) {
  const [location, setLocation] = useState(defaultLocation);
  const [geoStatus, setGeoStatus] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is not supported in this browser.');
      return;
    }

    setIsLocating(true);
    setGeoStatus('Getting your location…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
        setLocation(coords);
        setGeoStatus('Current location added. You can now search nearby rentals.');
        setIsLocating(false);
      },
      () => {
        setGeoStatus('We could not access your location. Please allow location access or type it manually.');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  return (
    <form method="GET" className="mt-7 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
      <label className="lg:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-300">Location</span>
        <div className="flex gap-2">
          <input
            type="text"
            name="location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="City, neighborhood, or state"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/60 bg-emerald-400/10 px-3 py-2.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-70"
>
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-3.5 w-3.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M12 21s-6-5.373-6-10a6 6 0 1 1 12 0c0 4.627-6 10-6 10Z" />
    <circle cx="12" cy="11" r="2" />
  </svg>
  <span>{isLocating ? 'Locating…' : 'Use current location'}</span>
          </button>
        </div>
        {geoStatus ? <p className="mt-1 text-xs text-slate-400">{geoStatus}</p> : null}
      </label>

      <label>
        <span className="mb-1 block text-xs font-medium text-slate-300">Beds (min)</span>
        <input
          type="number"
          min="0"
          step="1"
          name="beds"
          placeholder="Any"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs font-medium text-slate-300">Baths (min)</span>
        <input
          type="number"
          min="0"
          step="0.5"
          name="baths"
          placeholder="Any"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs font-medium text-slate-300">Min rent</span>
        <input
          type="number"
          min="0"
          step="50"
          name="minRent"
          placeholder="$0"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />
      </label>

      <label>
        <span className="mb-1 block text-xs font-medium text-slate-300">Max rent</span>
        <input
          type="number"
          min="0"
          step="50"
          name="maxRent"
          placeholder="No cap"
          className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-3 pt-1 lg:col-span-6">
        <button
          type="submit"
          className="inline-flex items-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Find a place
        </button>
      </div>
    </form>
  );
}
