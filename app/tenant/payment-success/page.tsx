export default function PaymentSuccessPage() {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-6 space-y-3">
          <h1 className="text-xl font-semibold text-emerald-300">Payment successful ✅</h1>
          <p className="text-sm text-slate-200">
            Your test payment was completed. This is using Stripe&apos;s test mode and does not move real money.
          </p>
          <p className="text-xs text-slate-400">
            Later we&apos;ll connect this to your real rent records in RentZentro.
          </p>
        </div>
      </main>
    );
  }
  