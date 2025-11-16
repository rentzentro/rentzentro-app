export default function PaymentCancelledPage() {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-3">
          <h1 className="text-xl font-semibold text-amber-300">Payment cancelled</h1>
          <p className="text-sm text-slate-200">
            You cancelled the payment before it was completed.
          </p>
          <p className="text-xs text-slate-400">
            No charges were made. You can safely close this page or try again later.
          </p>
        </div>
      </main>
    );
  }
  