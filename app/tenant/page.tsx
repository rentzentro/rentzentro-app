// app/tenant/page.tsx

export default function TenantPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl bg-slate-900/70 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold mb-2">Tenant Portal (beta)</h1>
        <p className="text-slate-400 mb-4">
          This is where you&apos;ll log in to pay rent, see due dates, and download receipts.
        </p>

        <ul className="list-disc text-sm text-slate-300 pl-5 space-y-1">
          <li>View your current rent and due date</li>
          <li>Make a payment by card or bank (coming soon)</li>
          <li>See your payment history and receipts</li>
        </ul>

        <p className="mt-6 text-xs text-slate-500">
          Next step: we&apos;ll hook this page into Stripe so you can make test payments.
        </p>
      </div>
    </main>
  );
}
