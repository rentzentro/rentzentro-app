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
          <p className="text-xs text-amber-300">

          </p>
        </header>

        {/* 1. Overview */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">1. Overview</h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and
            use of the RentZentro software-as-a-service platform, website, and
            related services (collectively, the &quot;Service&quot;). The
            Service is operated by RentZentro (&quot;RentZentro,&quot;
            &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;).
          </p>
          <p>
            By creating an account, accessing, or using the Service, you agree
            to be bound by these Terms. If you are using the Service on behalf
            of a company or other entity, you represent that you have authority
            to bind that entity, and &quot;you&quot; refers to both you and that
            entity.
          </p>
        </section>

        {/* 2. Description of the Service */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            2. Description of the Service
          </h2>
          <p>
            RentZentro provides tools for property owners and managers
            (&quot;Landlords&quot;) to track properties, units, tenants, and
            rent payments, and to accept electronic payments from tenants via
            third-party payment processors such as Stripe
            (&quot;Payment Processors&quot;). Tenants may use the Service to
            view lease and payment information and to submit payments to their
            Landlord.
          </p>
          <p>
            RentZentro is an information and workflow platform. We do not act as
            a bank, money transmitter, escrow agent, property manager, or legal
            advisor. We do not enter into lease agreements on your behalf, and
            we are not a party to any lease or rental agreement between
            Landlords and Tenants.
          </p>
        </section>

        {/* 3. Accounts and Eligibility */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            3. Accounts and Eligibility
          </h2>
          <p>
            To use the Service as a Landlord, you must create an account and
            provide accurate and complete information. You are responsible for
            maintaining the confidentiality of your login credentials and for
            all activities that occur under your account.
          </p>
          <p>
            You represent and warrant that you have the right to enter into
            these Terms, and that your use of the Service will comply with all
            applicable laws, rules, and regulations, including those relating to
            rental housing, fees and surcharges, data privacy, and payments.
          </p>
          <p>
            We may suspend or terminate your access to the Service at any time
            if we believe you have violated these Terms or are otherwise using
            the Service in a way that may cause harm or legal liability.
          </p>
        </section>

        {/* 4. Fees, Billing, and Taxes */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            4. Fees, Billing, and Taxes
          </h2>
          <p>

          </p>
          <p>
            We may modify our pricing, including the Transaction Fee, in the
            future. If we do, we will provide notice through the dashboard,
            email, or other reasonable means before changes take effect. Your
            continued use of the Service after pricing changes are posted
            constitutes your acceptance of the new pricing.
          </p>
          <p>
            <span className="font-semibold">Passing fees to tenants.</span>{' '}
            Whether and how you pass any fees or surcharges on to tenants is
            your decision and responsibility. Some jurisdictions and card
            networks restrict or prohibit surcharges on rent or card payments.
            You are solely responsible for complying with all applicable laws,
            regulations, lease terms, and card network rules relating to any
            such fees or surcharges.
          </p>
          <p>
            <span className="font-semibold">Taxes.</span> You are responsible
            for determining and paying any taxes, duties, or similar
            governmental assessments associated with your use of the Service and
            your rental activities.
          </p>
        </section>

        {/* 5. Payments */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">5. Payments</h2>
          <p>
            Card payments made through the Service are processed by third-party
            Payment Processors such as Stripe, under their own terms and privacy
            policies. By using the Service to accept or make payments, you also
            agree to the applicable Payment Processor&apos;s terms and policies.
          </p>
          <p>
            We do not have control over, and are not responsible for, payment
            authorization, settlement, chargebacks, refunds, or disputes between
            Landlords and Tenants. Any disputes regarding the amount of rent
            owed, late fees, refunds, or other financial terms are solely
            between the Landlord and Tenant.
          </p>
          <p>
            We may display payment information in your dashboard, but such
            information is provided for convenience only. The official record of
            a transaction is maintained by the Payment Processor.
          </p>
        </section>

        {/* 6. Data and Privacy */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            6. Data and Privacy
          </h2>
          <p>
            Our collection and use of personal information is described in our{' '}
            <Link href="/privacy" className="text-emerald-400 underline">
              Privacy Policy
            </Link>
            . By using the Service, you consent to our handling of personal data
            as described there.
          </p>
          <p>
            You are responsible for complying with applicable privacy and data
            protection laws in connection with your use of the Service and your
            handling of Tenant information. If you export, download, or copy
            data from the Service, you are solely responsible for securing and
            protecting that data.
          </p>
        </section>

        {/* 7. Acceptable Use */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">7. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>violate any applicable law or regulation;</li>
            <li>
              misrepresent rental amounts, fees, or other financial terms to
              Tenants;
            </li>
            <li>
              engage in fraud, money laundering, or any other illegal financial
              activity;
            </li>
            <li>
              upload or transmit malicious code, viruses, or other harmful
              software;
            </li>
            <li>
              attempt to gain unauthorized access to the Service or related
              systems;
            </li>
            <li>
              reverse engineer, decompile, or attempt to derive the source code
              of the Service, except to the extent permitted by law;
            </li>
            <li>
              infringe or violate the intellectual property or privacy rights of
              others.
            </li>
          </ul>
        </section>

        {/* 8. Disclaimers */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">8. Disclaimers</h2>
          <p>
            The Service is provided on an &quot;AS IS&quot; and &quot;AS
            AVAILABLE&quot; basis, without warranties of any kind, whether
            express or implied, including but not limited to implied warranties
            of merchantability, fitness for a particular purpose, and
            non-infringement.
          </p>
          <p>
            RentZentro does not guarantee uninterrupted or error-free operation
            of the Service, that the Service will meet your requirements, or
            that any data will be accurate or complete. You are responsible for
            verifying the accuracy of information before relying on it.
          </p>
          <p>
            RentZentro is not a law firm, accounting firm, or property
            management company. Nothing in the Service constitutes legal,
            financial, or housing advice. You should consult your own advisors
            regarding compliance with applicable laws and regulations.
          </p>
        </section>

        {/* 9. Limitation of Liability */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            9. Limitation of Liability
          </h2>
          <p>
            To the maximum extent permitted by law, RentZentro and its owners,
            employees, contractors, and affiliates will not be liable for any
            indirect, incidental, consequential, special, or punitive damages,
            or for any loss of profits, revenue, or data, arising out of or in
            connection with your use of the Service.
          </p>
          <p>
            To the maximum extent permitted by law, our total aggregate
            liability for any claims arising out of or relating to the Service
            will not exceed the greater of (a) the amount of fees you paid to
            us for the Service in the three (3) months preceding the event
            giving rise to the claim, or (b) one hundred U.S. dollars
            (US$100).
          </p>
        </section>

        {/* 10. Changes to the Service and Terms */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            10. Changes to the Service and Terms
          </h2>
          <p>
            We may update or modify the Service from time to time, including by
            adding or removing features. We may also update these Terms. If we
            make material changes, we will provide notice by posting the updated
            Terms in the dashboard or on our website, or by other reasonable
            means.
          </p>
          <p>
            Your continued use of the Service after the effective date of any
            changes constitutes your acceptance of the revised Terms. If you do
            not agree to the changes, you must stop using the Service.
          </p>
        </section>

        {/* 11. Contact */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">11. Contact</h2>
          <p>
            If you have questions about these Terms or the Service, you can
            contact us at:
          </p>
          <p className="text-slate-300">
            RentZentro
            <br />
            {/* Replace with your real contact info when ready */}
            support@rentzentro.com
          </p>
        </section>
      </div>
    </div>
  );
}
