'use client';

import { useState } from 'react';

type Props = {
  defaultLocation?: string;
  defaultBeds?: string;
  defaultBaths?: string;
  defaultMinRent?: string;
  defaultMaxRent?: string;
};

const inputClass =
  'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

export default function ListingsSearchForm({
  defaultLocation = '',
  defaultBeds = '',
  defaultBaths = '',
  defaultMinRent = '',
  defaultMaxRent = '',
}: Props) {
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
    <form method="GET" className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,1.8fr)_repeat(4,minmax(96px,1fr))]">
      <input type="hidden" name="source" value="rentzentro" />

      <label>
        <span className="sr-only">Location</span>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="text"
              name="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City, neighborhood, or state"
              className={`${inputClass} pl-9`}
            />
          </div>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isLocating}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm transition hover:border-blue-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
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
            <span className="hidden sm:inline">{isLocating ? 'Locating…' : 'Near me'}</span>
          </button>
        </div>
        {geoStatus ? <p className="mt-1 text-xs font-medium text-slate-500">{geoStatus}</p> : null}
      </label>

      <label>
        <span className="sr-only">Beds minimum</span>
        <select name="beds" defaultValue={defaultBeds} className={inputClass}>
          <option value="">Beds</option>
          <option value="0">Studio+</option>
          <option value="1">1+ bed</option>
          <option value="2">2+ beds</option>
          <option value="3">3+ beds</option>
          <option value="4">4+ beds</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Baths minimum</span>
        <select name="baths" defaultValue={defaultBaths} className={inputClass}>
          <option value="">Baths</option>
          <option value="1">1+ bath</option>
          <option value="1.5">1.5+ baths</option>
          <option value="2">2+ baths</option>
          <option value="3">3+ baths</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Minimum rent</span>
        <input
          type="number"
          min="0"
          step="50"
          name="minRent"
          defaultValue={defaultMinRent}
          placeholder="Min rent"
          className={inputClass}
        />
      </label>

      <label>
        <span className="sr-only">Maximum rent</span>
        <input
          type="number"
          min="0"
          step="50"
          name="maxRent"
          defaultValue={defaultMaxRent}
          placeholder="Max rent"
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap gap-2 lg:col-span-5">
        <button
          type="submit"
          name="source"
          value="rentzentro"
          className="inline-flex h-11 items-center rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700"
        >
          Search listings
        </button>
        <button
          type="submit"
          name="source"
          value="web"
          className="inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-900 shadow-sm transition hover:border-blue-500 hover:text-blue-700"
        >
          Search the web
        </button>
      </div>
    </form>
  );
}
