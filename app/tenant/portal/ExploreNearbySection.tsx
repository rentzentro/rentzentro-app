'use client';

type LocalCategory = {
  label: string;
  emoji: string;
  query: string;
};

type LocalQuickFilter = {
  label: string;
  queryPrefix: string;
};

type LocalEssential = {
  label: string;
  emoji: string;
  query: string;
};

const localCategories: LocalCategory[] = [
  { label: 'Restaurants', emoji: '🍽️', query: 'restaurants' },
  { label: 'Parks', emoji: '🌳', query: 'parks' },
  { label: 'Zoos & aquariums', emoji: '🦁', query: 'zoos and aquariums' },
  { label: 'Beaches & waterfronts', emoji: '🏖️', query: 'beaches and waterfront parks' },
  { label: 'Museums', emoji: '🏛️', query: 'museums' },
  { label: 'Family activities', emoji: '🎡', query: 'family activities' },
];

const localQuickFilters: LocalQuickFilter[] = [
  { label: 'Open now', queryPrefix: 'open now' },
  { label: 'Kid-friendly', queryPrefix: 'kid friendly' },
  { label: 'Outdoor', queryPrefix: 'outdoor' },
  { label: 'Under 15 min', queryPrefix: 'within 15 minutes of' },
];

const localEssentials: LocalEssential[] = [
  { label: 'Groceries', emoji: '🛒', query: 'grocery stores' },
  { label: 'Pharmacies', emoji: '💊', query: 'pharmacies' },
  { label: 'Urgent care', emoji: '🏥', query: 'urgent care' },
  { label: 'Coffee shops', emoji: '☕', query: 'coffee shops' },
];

const buildMapsLink = (query: string, areaHint: string | null) => {
  const fullQuery = areaHint ? `${query} near ${areaHint}` : `${query} near me`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;
};

const buildLocalEventsLink = (areaHint: string | null) => {
  const query = areaHint ? `weekend events in ${areaHint}` : 'weekend events near me';
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

export default function ExploreNearbySection({
  areaHint,
  propertyName,
}: {
  areaHint: string | null;
  propertyName: string | null;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Explore nearby</p>
          <p className="mt-1 text-sm font-medium text-slate-50">Things to do around your area</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Discover local spots near {propertyName || 'your home'}.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {localQuickFilters.map((filter) => (
          <a
            key={filter.label}
            href={buildMapsLink(`${filter.queryPrefix} things to do`, areaHint)}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-200"
          >
            {filter.label}
          </a>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {localCategories.map((item) => (
          <a
            key={item.label}
            href={buildMapsLink(item.query, areaHint)}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 hover:border-emerald-500/40"
          >
            <p className="text-sm font-medium text-slate-100">
              <span className="mr-1" aria-hidden="true">
                {item.emoji}
              </span>
              {item.label}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">Open in Google Maps</p>
          </a>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Daily essentials</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {localEssentials.map((item) => (
            <a
              key={item.label}
              href={buildMapsLink(item.query, areaHint)}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-2 hover:border-emerald-500/40"
            >
              <p className="text-xs font-medium text-slate-100">
                <span className="mr-1.5" aria-hidden="true">
                  {item.emoji}
                </span>
                {item.label}
              </p>
            </a>
          ))}
        </div>
      </div>

      <a
        href={buildLocalEventsLink(areaHint)}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-500/15"
      >
        See this weekend&apos;s local events
      </a>

      <p className="mt-3 text-[11px] text-slate-500">
        We&apos;re starting with quick local discovery links. Next step: personalize
        recommendations based on resident preferences and lease profile.
      </p>
    </section>
  );
}
