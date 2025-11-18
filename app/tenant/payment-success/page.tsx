import Link from 'next/link';

export default function TenantPaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-950/80 p-6 shadow-lg shadow-emerald-500/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Tenant portal
            </p>
            <h1 className="mt-1 text-lg font-semibold text-slate-50">
              Payment successful
            </h1>
          </div>
          <div className="h-9 w-9 rounded-full bg-emerald-500/10 border border-emerald-400/60 flex items-center justify-center text-emerald-400">
            ✓
          </div>
        </div>

        <p className="text-sm text-slate-300">
          Your rent payment was processed successfully through Stripe Checkout.
          You&apos;ll see this payment appear in your payment history once your
          landlord&apos;s records sync.
        </p>

        <p className="mt-3 text-[11px] text-slate-500">
          If you believe there is an issue with this payment, contact your
          landlord or property manager directly.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/tenant/portal"
            className="w-full rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-medium text-slate-950 text-center hover:bg-emerald-400"
          >
            Return to my tenant portal
          </Link>

          <Link
            href="/"
            className="w-full rounded-full border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 text-center hover:bg-slate-800"
          >
            Go to RentZentro home
          </Link>
        </div>
      </div>
    </div>
  );
}
