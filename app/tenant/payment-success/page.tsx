export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-600/20 border border-emerald-600/40">
          <svg
            className="w-10 h-10 text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-emerald-400">
          Payment Successful
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed">
          Thank you! Your payment has been successfully processed by Stripe.
          You can return to your tenant portal to view your payment history.
        </p>

        <a
          href="/tenant/portal"
          className="inline-block mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-2 rounded-xl transition"
        >
          Return to Tenant Portal
        </a>
      </div>
    </div>
  );
}
