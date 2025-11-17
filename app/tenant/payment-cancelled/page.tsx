export default function PaymentCancelledPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-600/20 border border-rose-600/40">
          <svg
            className="w-10 h-10 text-rose-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-rose-400">Payment Cancelled</h1>

        <p className="text-slate-400 text-sm leading-relaxed">
          It looks like your payment was canceled or interrupted before it was
          completed. No charges were made.
        </p>

        <a
          href="/tenant/portal"
          className="inline-block mt-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-6 py-2 rounded-xl transition border border-slate-700"
        >
          Back to Tenant Portal
        </a>
      </div>
    </div>
  );
}
