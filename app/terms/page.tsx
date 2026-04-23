'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="inline-block text-xs px-3 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 mb-4"
        >
          ← Back
        </button>

        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs text-slate-500">Legal</p>
          <h1 className="text-2xl font-semibold text-slate-50">
            Terms of Service
          </h1>
        </header>

        {/* 1. Overview */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">1. Overview</h2>
          <p>
            These Terms of Service (Terms) govern your access to and use of
            the RentZentro software-as-a-service platform, website, and related
            services (collectively, the Service).
          </p>
          <p>
            By creating an account or using the Service, you agree to these
            Terms.
          </p>
        </section>

        {/* 2. Description */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">2. Description</h2>
          <p>
            RentZentro provides software tools for landlords to manage tenants,
            collect rent, and track payments. We are not a bank, escrow agent,
            or property manager.
          </p>
        </section>

        {/* 3. Accounts */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">3. Accounts</h2>
          <p>
            You are responsible for your account and all activity under it.
          </p>
        </section>

        {/* 4. Fees */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            4. Fees, Billing, and Taxes
          </h2>

          <p>
            <span className="font-semibold">Subscription.</span> RentZentro
            offers landlord subscription plans currently priced at $19, $29.95,
            and $59 per month. Pricing may change with notice.
          </p>

          <p>
            <span className="font-semibold">Transaction fees.</span> RentZentro
            may apply transaction fees to payments made through the platform.
            These fees may vary depending on payment method.
          </p>

          <p>
            <span className="font-semibold">Payment processing.</span> All
            payments are processed by third-party providers such as Stripe.
            Processing fees are determined by those providers and may be
            deducted from payments.
          </p>

          <p>
            <span className="font-semibold">Passing fees to tenants.</span>{' '}
            Landlords are responsible for ensuring any fees charged to tenants
            comply with local laws and regulations.
          </p>

          <p>
            <span className="font-semibold">No guarantee of fee coverage.</span>{' '}
            RentZentro does not guarantee that any collected fees will fully
            cover payment processing costs.
          </p>

          <p>
            <span className="font-semibold">Taxes.</span> You are responsible for
            all applicable taxes.
          </p>
        </section>

        {/* 5. Payments */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">5. Payments</h2>
          <p>
            Payments are handled by third-party processors like Stripe. We are
            not responsible for payment disputes.
          </p>
        </section>

        {/* 6. Privacy */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">6. Privacy</h2>
          <p>
            See our{' '}
            <Link href="/privacy" className="text-emerald-400 underline">
              Privacy Policy
            </Link>.
          </p>
        </section>

        {/* 7. Liability */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">7. Liability</h2>
          <p>
            RentZentro is not liable for indirect or consequential damages.
          </p>
        </section>

        {/* 8. Changes */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">8. Changes</h2>
          <p>
            We may update these Terms at any time.
          </p>
        </section>

        {/* 9. Contact */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">9. Contact</h2>
          <p>support@rentzentro.com</p>
        </section>
      </div>
    </div>
  );
}
