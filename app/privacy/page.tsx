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
          <p className="text-xs text-amber-300">
            This template is for general information only and does not constitute
            legal advice. You should have a qualified attorney review and adapt
            this policy before launching RentZentro in production.
          </p>
        </header>

        {/* Intro */}
        <section className="space-y-2 text-sm text-slate-200">
          <p>
            This Privacy Policy explains how RentZentro (&quot;RentZentro,&quot;
            &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) collects, uses,
            and shares information when you use our website, applications, and
            related services (collectively, the &quot;Service&quot;).
          </p>
          <p>
            By accessing or using the Service, you agree to the collection and
            use of information in accordance with this Privacy Policy. If you do
            not agree, you should not use the Service.
          </p>
        </section>

        {/* 1. Information We Collect */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            1. Information We Collect
          </h2>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="font-semibold">Account information.</span> When
              Landlords create an account, we may collect name, email address,
              business name, and other contact details. When Tenants access a
              portal, we may collect their name, email, and other information
              provided by their Landlord.
            </li>
            <li>
              <span className="font-semibold">Property and tenant data.</span>{' '}
              Landlords may store information such as property names, unit
              labels, rent amounts, due dates, lease terms, and tenant contact
              information.
            </li>
            <li>
              <span className="font-semibold">Payment-related information.</span>{' '}
              RentZentro integrates with third-party payment processors (such as
              Stripe) to handle card payments. We do not store full card
              numbers, CVV codes, or bank account numbers. We may receive and
              store limited payment details from the processor, such as payment
              status, amounts, and transaction IDs.
            </li>
            <li>
              <span className="font-semibold">Usage data.</span> We may collect
              information about how you access and use the Service, such as IP
              address, browser type, device information, pages viewed, and
              timestamps.
            </li>
            <li>
              <span className="font-semibold">Support communications.</span>{' '}
              When you contact us for support, we may collect the content of
              your message, your contact information, and any additional details
              you provide.
            </li>
          </ul>
        </section>

        {/* 2. How We Use Information */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            2. How We Use Information
          </h2>
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>provide, operate, and maintain the Service;</li>
            <li>
              create and manage Landlord and Tenant accounts and profiles;
            </li>
            <li>
              process rent payments via third-party payment processors and
              display payment history;
            </li>
            <li>
              customize and improve the Service, including dashboards and
              analytics for Landlords;
            </li>
            <li>
              communicate with you about your account, payments, and updates to
              the Service;
            </li>
            <li>
              detect, prevent, and address technical issues, fraud, or abuse;
            </li>
            <li>
              comply with legal obligations and enforce our Terms of Service.
            </li>
          </ul>
        </section>

        {/* 3. Legal Bases */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            3. Legal Bases for Processing
          </h2>
          <p>
            Depending on your location, our processing of personal information
            may be based on one or more of the following legal bases:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>your consent;</li>
            <li>
              the performance of a contract (for example, providing the Service
              to you);
            </li>
            <li>
              our legitimate interests (such as improving the Service and
              supporting Landlords and Tenants); or
            </li>
            <li>compliance with legal obligations.</li>
          </ul>
        </section>

        {/* 4. How We Share Information */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            4. How We Share Information
          </h2>
          <p>We may share information as follows:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <span className="font-semibold">
                With payment processors.
              </span>{' '}
              We share necessary information with third-party payment processors
              (such as Stripe) to process card payments. These providers handle
              your payment data under their own terms and privacy policies.
            </li>
            <li>
              <span className="font-semibold">With service providers.</span> We
              may share information with third-party vendors that help us
              operate and improve the Service, such as hosting providers,
              analytics tools, and customer support platforms.
            </li>
            <li>
              <span className="font-semibold">
                With Landlords and Tenants.
              </span>{' '}
              Tenant data entered by a Landlord may be visible to that
              Landlord&apos;s authorized users. Payment history may be visible
              to the Tenant and to the relevant Landlord.
            </li>
            <li>
              <span className="font-semibold">
                For legal and safety reasons.
              </span>{' '}
              We may disclose information if we believe it is required by law,
              regulation, legal process, or governmental request, or to protect
              the rights, property, or safety of RentZentro, our users, or
              others.
            </li>
            <li>
              <span className="font-semibold">Business transfers.</span> If we
              are involved in a merger, acquisition, financing, or sale of all
              or part of our business, information may be transferred as part of
              that transaction, subject to applicable law.
            </li>
          </ul>
        </section>

        {/* 5. Data Retention */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            5. Data Retention
          </h2>
          <p>
            We retain personal information for as long as necessary to provide
            the Service, fulfill the purposes described in this Privacy Policy,
            and comply with legal, accounting, or reporting requirements. We may
            anonymize or aggregate data so that it no longer identifies
            individuals and use that data for analytics or business purposes.
          </p>
        </section>

        {/* 6. Security */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">6. Security</h2>
          <p>
            We take reasonable technical and organizational measures to help
            protect personal information from unauthorized access, disclosure,
            alteration, or destruction. However, no method of transmission over
            the internet or electronic storage is completely secure, and we
            cannot guarantee absolute security.
          </p>
        </section>

        {/* 7. Your Choices and Rights */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            7. Your Choices and Rights
          </h2>
          <p>
            Depending on your location, you may have certain rights with respect
            to your personal information, such as the right to access, correct,
            or delete your information, or to object to or restrict certain
            processing.
          </p>
          <p>
            Landlords can generally update account and property/tenant data via
            the RentZentro dashboard. Tenants who have questions about the data
            their Landlord has entered should contact their Landlord directly or
            contact us using the information below.
          </p>
        </section>

        {/* 8. Children */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            8. Children&apos;s Privacy
          </h2>
          <p>
            The Service is not intended for use by children under the age of 13,
            and we do not knowingly collect personal information from children
            under 13. If we become aware that we have collected such
            information, we will take steps to delete it.
          </p>
        </section>

        {/* 9. International Transfers */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            9. International Data Transfers
          </h2>
          <p>
            The Service may be operated from servers located in jurisdictions
            other than where you reside. By using the Service, you understand
            that your information may be transferred to and processed in
            countries that may have different data protection laws than your
            home jurisdiction.
          </p>
        </section>

        {/* 10. Changes */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">
            10. Changes to This Privacy Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. If we make
            material changes, we will provide notice by updating the &quot;Last
            updated&quot; date below or by other appropriate means. Your
            continued use of the Service after changes become effective
            constitutes your acceptance of the revised policy.
          </p>
          <p className="text-xs text-slate-400">
            Last updated: {/* Fill in when you go live, e.g. "November 2025" */}
          </p>
        </section>

        {/* 11. Contact */}
        <section className="space-y-2 text-sm text-slate-200">
          <h2 className="font-semibold text-slate-50">11. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our data
            practices, you can contact us at:
          </p>
          <p className="text-slate-300">
            RentZentro
            <br />
            {/* Replace with your real contact details when ready */}
            support@rentzentro.com
          </p>
        </section>
      </div>
    </div>
  );
}
