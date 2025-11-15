// app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            RentZentro
          </h1>
          <p className="text-slate-300 max-w-xl">
            Simple, automatic rent payments and tenant tracking for small landlords.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-medium text-slate-100">Choose your portal</h2>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/landlord"
              className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 transition"
            >
              I&apos;m a landlord
            </Link>

            <Link
              href="/tenant"
              className="inline-flex items-center justify-center rounded-full border border-slate-600 px-6 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 transition"
            >
              I&apos;m a tenant
            </Link>
          </div>
        </section>

        <section className="border border-slate-800 rounded-2xl p-5 bg-slate-900/40 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">
            What you can do today
          </h3>
          <ul className="list-disc text-sm text-slate-300 pl-5 space-y-1">
            <li>Landlords can add properties and track basic stats.</li>
            <li>Tenants can soon log in to view their unit and payment details.</li>
            <li>Supabase is wired up behind the scenes for real data.</li>
          </ul>
          <p className="text-xs text-slate-500 pt-2">
            More automation (Stripe payments, per-landlord accounts, tenant portal) coming next.
          </p>
        </section>
      </div>
    </main>
  );
}

