'use client';

import { useState } from 'react';
import Link from 'next/link';

type BillingCycle = 'monthly' | 'annual';

type PricingPlan = {
  name: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  unitRange: string;
  description: string;
  highlights: string[];
  featured?: boolean;
  free?: boolean;
};

const pricingPlans: PricingPlan[] = [
  {
    name: 'Forever Free',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    unitRange: '1 property · 1 tenant',
    description: 'Start organized today and upgrade only when your portfolio is ready.',
    highlights: [
      'Know exactly what your first property earns.',
      'Stop chasing rent with a cleaner payment workflow.',
      'Tax season becomes easier from day one.',
      'Keep documents and maintenance history in one place.',
      'Upgrade anytime when you add more doors.',
    ],
    free: true,
  },
  {
    name: 'Starter',
    monthlyPrice: 19,
    annualMonthlyPrice: 16,
    unitRange: 'Up to 3 units',
    description: 'For landlords ready to replace scattered tools with one calm operating system.',
    highlights: [
      'Know exactly what every property earns.',
      'Stop chasing rent across texts, checks, and payment apps.',
      'Keep tenant details, documents, and repairs easy to find.',
    ],
  },
  {
    name: 'Core',
    monthlyPrice: 29.95,
    annualMonthlyPrice: 25,
    unitRange: 'Up to 20 units',
    description: 'The conversion-focused choice for owners growing beyond a few doors.',
    highlights: [
      'Grow without rebuilding spreadsheets every month.',
      'See income, expenses, and profit by property faster.',
      'Make rent, repairs, and records feel connected.',
    ],
    featured: true,
  },
  {
    name: 'Growth',
    monthlyPrice: 59,
    annualMonthlyPrice: 49,
    unitRange: 'Up to 75 units',
    description: 'For larger portfolios that need visibility and repeatable workflows at scale.',
    highlights: [
      'Understand portfolio performance without manual reporting.',
      'Keep more tenants moving through one consistent workflow.',
      'Scale operations without adding spreadsheet chaos.',
    ],
  },
];

const comparisonRows = [
  ['Rental Profit Dashboard', true, false],
  ['Rent Collection', true, true],
  ['Expense Tracking', true, true],
  ['Maintenance Requests', true, true],
  ['Document Storage', true, true],
  ['Tenant Screening', true, false],
  ['AI Lease Builder', true, false],
  ['Maintenance Vendor Directory', true, false],
  ['Portfolio Reporting', true, false],
] as const;

const faqs = [
  ['Can I cancel anytime?', 'Yes. There are no contracts, and you can cancel when RentZentro is no longer the right fit.'],
  ['Do tenants need an account?', 'Tenants use a simple tenant experience for payments, maintenance, messages, and shared documents.'],
  ['Does RentZentro hold my money?', 'No. Your money goes directly to your Stripe account through Stripe Connect.'],
  ['Is there a setup fee?', 'No. There is no setup fee to start organizing your rentals in RentZentro.'],
  ['Can I upgrade later?', 'Yes. Start free or choose the plan that fits today, then upgrade anytime as your portfolio grows.'],
] as const;

function formatPrice(plan: PricingPlan, billing: BillingCycle) {
  if (plan.free) return '$0';
  const price = billing === 'annual' ? plan.annualMonthlyPrice * 12 : plan.monthlyPrice;
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
}

function priceSuffix(billing: BillingCycle) {
  return billing === 'annual' ? '/yr' : '/mo';
}

function CheckMark({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
        active ? 'bg-emerald-500/14 text-emerald-300' : 'bg-slate-800/80 text-slate-500'
      }`}
      aria-label={active ? 'Included' : 'Limited or unavailable'}
    >
      {active ? '✓' : '—'}
    </span>
  );
}

function PricingCard({ plan, billing }: { plan: PricingPlan; billing: BillingCycle }) {
  const annualSavings = plan.free ? 0 : Math.round((plan.monthlyPrice * 12 - plan.annualMonthlyPrice * 12));

  return (
    <div
      className={`flex h-full flex-col rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 ${
        plan.featured
          ? 'border-emerald-400/30 bg-emerald-950/25 shadow-[0_0_0_1px_rgba(52,211,153,0.12)]'
          : 'border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 hover:border-emerald-500/20 hover:bg-slate-900/70'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-slate-50">{plan.name}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">{plan.unitRange}</p>
        </div>
        {(plan.featured || plan.free) && (
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
            {plan.free ? 'Forever free' : 'Most popular'}
          </span>
        )}
      </div>

      <div className="mt-4">
        <span className="text-3xl font-semibold text-emerald-300">{formatPrice(plan, billing)}</span>
        <span className="ml-1 text-sm text-slate-400">{priceSuffix(billing)}</span>
        {billing === 'annual' && annualSavings > 0 && (
          <p className="mt-1 text-xs font-semibold text-amber-200">Save about ${annualSavings}/year vs. monthly billing</p>
        )}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-300">{plan.description}</p>

      <ul className="mt-4 flex-1 space-y-2.5">
        {plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
            <span className="mt-[2px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/14 text-[11px] text-emerald-300">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <Link href="/landlord/signup" className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition duration-200 hover:scale-[1.02] hover:bg-emerald-300 active:scale-95">
        {plan.free ? 'Start free' : 'Start now'}
      </Link>
    </div>
  );
}

export default function PricingSection() {
  const [billing, setBilling] = useState<BillingCycle>('annual');

  return (
    <section className="rz-fade-up rz-delay-7 border-t border-slate-900 py-14">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pricing</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-50">Start free. Upgrade when your rentals need more room.</h2>
          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-400">
            RentZentro helps you stop guessing, stop chasing rent, and keep every rental dollar, document, and repair organized in one place.
          </p>
        </div>
        <div className="w-fit rounded-full border border-white/10 bg-slate-950 p-1 text-sm">
          {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => (
            <button key={cycle} type="button" onClick={() => setBilling(cycle)} className={`rounded-full px-4 py-2 font-semibold capitalize transition ${billing === cycle ? 'bg-emerald-400 text-slate-950' : 'text-slate-300 hover:text-slate-50'}`}>
              {cycle}{cycle === 'annual' ? ' · Save' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        {pricingPlans.map((plan) => <PricingCard key={plan.name} plan={plan} billing={billing} />)}
      </div>

      <div className="mt-5 grid gap-3 text-[13px] text-slate-200 md:grid-cols-3">
        {['No contracts.', 'Your money goes directly to your Stripe account.', 'Your data always belongs to you.'].map((item) => (
          <div key={item} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3">{item}</div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-slate-950/70 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Comparison</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-50">Built for rental profit, not just generic property tasks</h3>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3 pr-4">Capability</th><th className="px-4 py-3 text-center text-emerald-300">RentZentro</th><th className="px-4 py-3 text-center">Typical landlord software</th></tr></thead>
            <tbody className="divide-y divide-slate-900">
              {comparisonRows.map(([label, rz, typical]) => (
                <tr key={label}><td className="py-3 pr-4 text-slate-200">{label}</td><td className="px-4 py-3 text-center"><CheckMark active={rz} /></td><td className="px-4 py-3 text-center"><CheckMark active={typical} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">30-Day Money Back Guarantee</p>
        <h3 className="mt-2 text-xl font-semibold text-slate-50">Try RentZentro with less risk.</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">If RentZentro is not helping you feel more organized within your first 30 days on a paid plan, contact us and we will help make it right.</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {faqs.map(([question, answer]) => (
          <div key={question} className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4">
            <h3 className="text-sm font-semibold text-slate-50">{question}</h3>
            <p className="mt-2 text-[13px] leading-6 text-slate-400">{answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
