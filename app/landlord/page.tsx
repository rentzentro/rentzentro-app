// app/landlord/page.tsx

export default function LandlordPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-3xl bg-slate-900/70 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-2xl font-semibold mb-2">Landlord Dashboard (beta)</h1>
        <p className="text-slate-400 mb-4">
          This is where you&apos;ll see units, tenants, and rent payments once the platform is fully live.
        </p>

        <ul className="list-disc text-sm text-slate-300 pl-5 space-y-1">
          <li>View all properties and units</li>
          <li>See who has paid and who is late</li>
          <li>Invite new tenants to pay online</li>
        </ul>

        <p className="mt-6 text-xs text-slate-500">
          Next step: we&apos;ll connect this page to a real database and Stripe payments.
        </p>
      </div>
    </main>
  );
}
