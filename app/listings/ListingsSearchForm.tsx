'use client';

import { useState } from 'react';

type Props = {
  defaultLocation?: string;
};

const tileBaseClass =
  'rounded-3xl border px-4 py-5 text-left transition focus:outline-none focus:ring-2 focus:ring-sky-300/70';

export default function ListingsSearchForm({ defaultLocation = '' }: Props) {
  const [location, setLocation] = useState(defaultLocation);
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [minRent, setMinRent] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [homeType, setHomeType] = useState<'any' | 'houses' | 'townhomes' | 'apartments'>('any');
  const [spaceType, setSpaceType] = useState<'any' | 'entire' | 'room'>('entire');

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

  const handleReset = () => {
    setLocation('');
    setBeds('');
    setBaths('');
    setMinRent('');
    setMaxRent('');
    setGeoStatus('');
    setHomeType('any');
    setSpaceType('entire');
  };

  return (
    <form method="GET" className="mt-6 space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <span className="text-2xl font-semibold tracking-tight text-white">Filters</span>
        <button
          type="button"
          onClick={handleReset}
          className="text-lg font-medium text-sky-400 transition hover:text-sky-300"
        >
          Reset
        </button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/90 p-4">
        <p className="text-lg text-slate-100">Get updates on your search</p>
      </section>

      <section>
        <h2 className="mb-3 text-3xl font-semibold text-white">Home type</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: 'any', label: 'Any', icon: '🏢' },
            { key: 'houses', label: 'Houses', icon: '🏠' },
            { key: 'townhomes', label: 'Townhomes', icon: '🏘️' },
            { key: 'apartments', label: 'Apartments/Condos', icon: '🏬' },
          ].map((item) => {
            const active = homeType === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setHomeType(item.key as typeof homeType)}
                className={`${tileBaseClass} ${
                  active
                    ? 'border-sky-300 bg-blue-950 text-white'
                    : 'border-slate-600/90 bg-black/60 text-slate-100 hover:border-slate-400'
                }`}
              >
                <div className="text-2xl">{item.icon}</div>
                <p className="mt-2 text-2xl font-semibold">{item.label}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-3xl font-semibold text-white">Space</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { key: 'any', label: 'Any', icon: '🛏️' },
            { key: 'entire', label: 'Entire place', icon: '🏡' },
            { key: 'room', label: 'Room for rent', icon: '🚪' },
          ].map((item) => {
            const active = spaceType === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSpaceType(item.key as typeof spaceType)}
                className={`${tileBaseClass} min-h-[120px] ${
                  active
                    ? 'border-sky-300 bg-blue-950 text-white'
                    : 'border-slate-600/90 bg-black/60 text-slate-100 hover:border-slate-400'
                }`}
              >
                <div className="text-2xl">{item.icon}</div>
                <p className="mt-2 text-xl font-semibold">{item.label}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-5 border-y border-white/10 py-8">
        <h2 className="text-3xl font-semibold text-white">Price range</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-2xl font-semibold text-slate-100">Min</span>
            <input
              type="number"
              min="0"
              step="50"
              name="minRent"
              value={minRent}
              onChange={(event) => setMinRent(event.target.value)}
              placeholder="No min"
              className="w-full rounded-3xl border border-slate-600 bg-black px-5 py-4 text-3xl text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-2xl font-semibold text-slate-100">Max</span>
            <input
              type="number"
              min="0"
              step="50"
              name="maxRent"
              value={maxRent}
              onChange={(event) => setMaxRent(event.target.value)}
              placeholder="No max"
              className="w-full rounded-3xl border border-slate-600 bg-black px-5 py-4 text-3xl text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-none"
            />
          </label>
        </div>
      </section>

      <section className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-2xl font-semibold text-slate-100">Bedrooms</span>
            <input
              type="number"
              min="0"
              step="1"
              name="beds"
              value={beds}
              onChange={(event) => setBeds(event.target.value)}
              placeholder="Any"
              className="w-full rounded-3xl border border-slate-600 bg-black px-5 py-4 text-3xl text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-none"
            />
          </label>
          <label>
            <span className="mb-2 block text-2xl font-semibold text-slate-100">Bathrooms</span>
            <input
              type="number"
              min="0"
              step="0.5"
              name="baths"
              value={baths}
              onChange={(event) => setBaths(event.target.value)}
              placeholder="Any"
              className="w-full rounded-3xl border border-slate-600 bg-black px-5 py-4 text-3xl text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-none"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-2 block text-2xl font-semibold text-slate-100">Location</span>
          <div className="space-y-3">
            <input
              type="text"
              name="location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="City, neighborhood, or state"
              className="w-full rounded-3xl border border-slate-600 bg-black px-5 py-4 text-2xl text-white placeholder:text-slate-500 focus:border-sky-300 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-sky-400/70 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 21s-6-5.373-6-10a6 6 0 1 1 12 0c0 4.627-6 10-6 10Z" />
                <circle cx="12" cy="11" r="2" />
              </svg>
              <span>{isLocating ? 'Locating…' : 'Use current location'}</span>
            </button>
            {geoStatus ? <p className="text-sm text-slate-300">{geoStatus}</p> : null}
          </div>
        </label>
      </section>

      <button
        type="submit"
        className="sticky bottom-4 w-full rounded-2xl bg-sky-400 px-5 py-4 text-4xl font-semibold text-slate-950 transition hover:bg-sky-300"
      >
        See rental results
      </button>
    </form>
  );
}
