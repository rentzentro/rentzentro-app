import Link from 'next/link';

export default function TenantPaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">
              Tenant portal
            </p>
            <h1 className="mt-1 text-lg font-semibold text-slate-50">
              Payment cancelled
            </h1>
          </div>
          <div className="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-400/60 flex items-center justify-center text-amber-300">
            !
          </div>
        </div>

        <p className="text-sm text-slate-300">
          You left Stripe Checkout before completing your payment. No charge was
          made to your card.
        </p>

        <p className="mt-3 text-[11px] text-slate-500">
          When you&apos;re ready, you can start the payment again from your
          tenant portal. If you believe this is an error, contact your landlord.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/tenant/portal"
            className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-100 text-center border border-slate-700 hover:bg-slate-800"
          >
            Return to my tenant portal
          </Link>

          <Link
            href="/"
            className="w-full rounded-full border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-300 text-center hover:bg-slate-900"
          >
            Go to RentZentro home
          </Link>
        </div>
      </div>
    </div>
  );
}

