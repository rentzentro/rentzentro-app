'use client';

import Link from 'next/link';

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
        </header>

        {/* Intro */}
        <section className="space-y-2 text-sm text-slate-200">
          <p>
            This Privacy Policy explains how RentZentro ("RentZentro," "we,"
            "our," or "us") collects, uses, and shares information when you use
            our website, applications, and related services (the "Service").
          </p>
          <p>
            By using the Service, you agree to this Privacy Policy.
          </p>
        </section>

        {/* 1. Information We Collect */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            1. Information We Collect
          </h2>

          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="font-semibold">Account information.</span>{' '}
              Name, email, and contact details.
            </li>

            <li>
              <span className="font-semibold">Property and tenant data.</span>{' '}
              Rent, lease details, tenant info.
            </li>

            <li>
              <span className="font-semibold">Payment-related information.</span>{' '}
              Payments are processed by third-party providers such as Stripe.
              RentZentro does not store full payment card numbers, CVV codes, or
              bank account numbers. We may receive limited details such as
              payment status and transaction IDs.
            </li>

            <li>
              <span className="font-semibold">Usage data.</span> Device, browser,
              IP address, and activity.
            </li>
          </ul>
        </section>

        {/* 2. How We Use Data */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            2. How We Use Information
          </h2>

          <ul className="list-disc list-inside space-y-1">
            <li>Operate and improve the platform</li>
            <li>Process rent payments</li>
            <li>Communicate with users</li>
            <li>Prevent fraud and abuse</li>
          </ul>
        </section>

        {/* 🔥 STRONGER PAYMENT SECTION */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            3. Payment Processing
          </h2>

          <p>
            All payments are processed by third-party providers such as Stripe.
            These providers handle your payment information under their own
            terms and privacy policies.
          </p>

          <p>
            RentZentro does not store or have access to full payment details,
            including card numbers or bank account information. We only receive
            limited information necessary to display payment status and history.
          </p>

          <p>
            You agree that payment processing is governed by the third-party
            provider’s policies, and RentZentro is not responsible for their
            handling of your data.
          </p>
        </section>

        {/* 4. Sharing */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            4. How We Share Information
          </h2>

          <p>We may share data with:</p>

          <ul className="list-disc list-inside space-y-1">
            <li>Payment providers (Stripe)</li>
            <li>Service providers (hosting, analytics)</li>
            <li>Legal authorities if required</li>
          </ul>
        </section>

        {/* 5. Retention */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            5. Data Retention
          </h2>

          <p>
            We retain data as needed to provide the Service and comply with
            legal obligations.
          </p>
        </section>

        {/* 6. Security */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">6. Security</h2>

          <p>
            We use reasonable security measures, but no system is completely
            secure.
          </p>
        </section>

        {/* 7. Rights */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            7. Your Rights
          </h2>

          <p>You may request access, correction, or deletion of your data.</p>
        </section>

        {/* 8. Children */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            8. Children
          </h2>

          <p>The Service is not intended for children under 13.</p>
        </section>

        {/* 9. Changes */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            9. Changes
          </h2>

          <p>We may update this policy at any time.</p>
        </section>

        {/* 10. Contact */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            10. Contact
          </h2>

          <p>support@rentzentro.com</p>
        </section>
      </div>
    </div>
  );
}