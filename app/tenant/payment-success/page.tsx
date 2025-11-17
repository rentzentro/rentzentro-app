import Link from 'next/link';

export default function TenantPaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        {/* Breadcrumb / top */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link
                href="/tenant"
                className="text-slate-400 hover:text-emerald-300"
              >
                Tenant
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-slate-200">Payment success</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-50 sm:text-xl">
              Payment complete
            </h1>
            <p className="text-[13px] text-slate-400">
              Your rent payment has been processed securely by Stripe.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-slate-900/80 to-emerald-950/40 p-6 shadow-lg shadow-emerald-900/40">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/40">
              <span className="text-2xl">✅</span>
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-emerald-100">
                Thank you — your payment went through
              </h2>
              <p className="mt-2 text-sm text-emerald-100/80">
                Your card was charged successfully and the transaction has been
                recorded with our payment processor. If your landlord uses
                RentZentro to track payments, this rent will appear in your
                payment history shortly.
              </p>
              <p className="mt-3 text-[12px] text-emerald-100/70">
                A receipt may also be emailed to you by Stripe or your landlord
                depending on how they have notifications configured.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/tenant/portal"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400"
                >
                  Back to tenant portal
                </Link>
                <Link
                  href="/tenant"
                  className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                >
                  Tenant home
                </Link>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[11px] text-slate-500">
            If something looks incorrect on your RentZentro balance, contact
            your landlord directly with the date and amount of this payment.
          </p>
        </div>
      </div>
    </div>
  );
}
