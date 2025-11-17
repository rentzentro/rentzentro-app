'use client';

export default function LandlordPropertiesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold">Properties (coming soon)</h1>
        <p className="text-sm text-slate-400">
          This page will let you add and edit units, set monthly rent, and
          assign tenants. For now, use the dashboard view to see an overview.
        </p>
        <a
          href="/landlord"
          className="inline-block mt-2 px-5 py-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sm"
        >
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
