import Link from 'next/link';

export default function TenantPaymentCancelledPage() {
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
              <span className="text-slate-200">Payment cancelled</span>
            </div>
            <h1 className="text-lg font-semibold text-slate-50 sm:text-xl">
              Payment not completed
            </h1>
            <p className="text-[13px] text-slate-400">
              You were redirected back before finishing your payment.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-slate-900/80 to-amber-950/40 p-6 shadow-lg shadow-amber-900/40">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/40">
              <span className="text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-amber-100">
                Your card was not charged
              </h2>
              <p className="mt-2 text-sm text-amber-100/85">
                It looks like you closed the payment window or cancelled at the
                Stripe checkout page. No rent payment was completed for this
                attempt.
              </p>
              <p className="mt-3 text-[12px] text-amber-100/80">
                If this was a mistake, you can safely try again. If you&apos;re
                not sure whether a charge went through, check your email or bank
                statement, or contact your landlord before submitting another
                payment.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/tenant/portal"
                  className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-emerald-400"
                >
                  Try payment again
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
            If you believe you were charged but RentZentro still shows a
            balance, contact your landlord with any receipts or bank details so
            they can verify and update your account.
          </p>
        </div>
      </div>
    </div>
  );
}
