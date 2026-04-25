'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type TemplateSection = {
  title: string;
  lines: string[];
};

type Template = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  sections: TemplateSection[];
};

type LeaseBuilderMode = 'manual' | 'ai';
type AiAssistResult = {
  summary: string;
  suggestions: string[];
  clausePack: string[];
  legalReminder: string;
};

type StateComplianceGuide = {
  code: string;
  name: string;
  overview: string;
  checklist: string[];
  attorneyPrompt: string;
};

const templates: Template[] = [
  {
    id: 'residential-lease',
    title: 'Residential Lease Agreement',
    subtitle: 'Detailed starter form for new tenancies',
    description:
      'Covers core lease terms, rent terms, occupancy, utilities, and compliance disclosures.',
    sections: [
      {
        title: '1) Parties & premises',
        lines: [
          'Landlord/Manager Name: ___________________________________________',
          'Tenant Name(s): _________________________________________________',
          'Rental Property Address (incl. unit): ____________________________',
          'Parking / Storage Included (if any): _____________________________',
        ],
      },
      {
        title: '2) Lease term & rent',
        lines: [
          'Lease Type: ☐ Fixed-Term  ☐ Month-to-Month',
          'Start Date: ____________________  End Date: ____________________',
          'Monthly Rent: $________________ Due Date (day of month): ________',
          'Grace Period (if any): ____________________ days',
          'Late Fee Structure: _____________________________________________',
        ],
      },
      {
        title: '3) Deposits & fees',
        lines: [
          'Security Deposit Amount: $______________________________________',
          'Pet Deposit / Monthly Pet Rent: _________________________________',
          'Move-In Fee (if any): $__________________________________________',
          'Key / Remote / Access Device Fee: _______________________________',
        ],
      },
      {
        title: '4) Occupancy, utilities, and rules',
        lines: [
          'Approved Occupants: _____________________________________________',
          'Utilities Paid by Landlord: _____________________________________',
          'Utilities Paid by Tenant: _______________________________________',
          'Smoking Policy: _________________________________________________',
          'Pet Policy: _____________________________________________________',
          'Maintenance Reporting Method: ___________________________________',
        ],
      },
      {
        title: '5) Signatures',
        lines: [
          'Landlord Signature: ____________________________ Date: ___________',
          'Tenant Signature: ______________________________ Date: ___________',
          'Tenant Signature: ______________________________ Date: ___________',
        ],
      },
    ],
  },
  {
    id: 'month-to-month-addendum',
    title: 'Month-to-Month Addendum',
    subtitle: 'Converts an existing lease after term expiration',
    description:
      'Use this addendum to continue occupancy month-to-month while preserving key original lease terms.',
    sections: [
      {
        title: '1) Original lease reference',
        lines: [
          'Original Lease Date: ____________________________________________',
          'Property Address / Unit: ________________________________________',
          'Tenant Name(s): _________________________________________________',
        ],
      },
      {
        title: '2) Effective conversion terms',
        lines: [
          'Month-to-Month Effective Date: __________________________________',
          'Updated Monthly Rent: $__________________________________________',
          'Rent Due Date: _________________________________________________',
          'Required Notice to Terminate: ___________________________________',
          'Any Additional Changes to Original Lease: ________________________',
        ],
      },
      {
        title: '3) Acknowledgement',
        lines: [
          'All terms not modified in this addendum remain in effect.',
          'Landlord Signature: ____________________________ Date: ___________',
          'Tenant Signature: ______________________________ Date: ___________',
          'Tenant Signature: ______________________________ Date: ___________',
        ],
      },
    ],
  },
  {
    id: 'move-in-checklist',
    title: 'Move-In / Move-Out Condition Checklist',
    subtitle: 'Room-by-room condition evidence form',
    description:
      'Capture documented condition at move-in and move-out to support transparent deposit accounting.',
    sections: [
      {
        title: '1) Property details',
        lines: [
          'Property Address / Unit: ________________________________________',
          'Tenant Name(s): _________________________________________________',
          'Move-In Date: __________________  Move-Out Date: _________________',
          'Inspection Date: ________________________________________________',
        ],
      },
      {
        title: '2) Room condition scoring (G/F/P)',
        lines: [
          'Entry / Hallway: Floors ___ Walls ___ Lighting ___ Notes _________',
          'Living Room: Floors ___ Walls ___ Windows ___ Notes _____________',
          'Kitchen: Counters ___ Appliances ___ Cabinets ___ Notes _________',
          'Bathroom(s): Fixtures ___ Tile ___ Ventilation ___ Notes ________',
          'Bedroom(s): Floors ___ Closets ___ Windows ___ Notes ____________',
        ],
      },
      {
        title: '3) Safety & inventory',
        lines: [
          'Smoke/CO Detectors Tested: ☐ Yes ☐ No   Date: _________________',
          'Keys/Access Devices Issued (qty): _______________________________',
          'Photos/Videos Attached: ☐ Yes ☐ No',
          'Additional Notes: _______________________________________________',
        ],
      },
      {
        title: '4) Sign-off',
        lines: [
          'Landlord/Agent Signature: ______________________ Date: ___________',
          'Tenant Signature: ______________________________ Date: ___________',
          'Tenant Signature: ______________________________ Date: ___________',
        ],
      },
    ],
  },
  {
    id: 'maintenance-notice',
    title: 'Notice of Intent to Enter for Maintenance',
    subtitle: 'Tenant notice for repairs, inspection, or service',
    description:
      'Professional entry notice with reason, schedule, and contact details for transparent communication.',
    sections: [
      {
        title: '1) Notice details',
        lines: [
          'Tenant Name(s): _________________________________________________',
          'Property Address / Unit: ________________________________________',
          'Date Notice Delivered: __________________________________________',
          'Method of Delivery: ☐ Email ☐ Posted ☐ Hand Delivery ☐ Other',
        ],
      },
      {
        title: '2) Entry window',
        lines: [
          'Proposed Entry Date: ____________________________________________',
          'Time Window: __________________ to ______________________________',
          'Purpose of Entry: _______________________________________________',
          'Vendor / Technician Name: _______________________________________',
        ],
      },
      {
        title: '3) Contact & acknowledgement',
        lines: [
          'Landlord/Manager Contact: _______________________________________',
          'Phone / Email: _________________________________________________',
          'Notes / Accommodations Requested by Tenant: _____________________',
          'Authorized By: ______________________________ Date: ______________',
        ],
      },
    ],
  },
];

const complianceGuides: StateComplianceGuide[] = [
  {
    code: 'general',
    name: 'General U.S. baseline',
    overview:
      'Use this as a neutral checklist when you have not selected a state yet. Confirm state + city requirements before signing.',
    checklist: [
      'Confirm required disclosures (lead paint, flood risk, utility billing, bed bug notices, etc.).',
      'Confirm notice periods for rent changes, non-renewal, and lease termination.',
      'Confirm security-deposit handling rules: limits, timelines, and itemized deductions.',
      'Confirm right-of-entry notice standards and emergency exceptions.',
      'Confirm habitability, repair timelines, and local rent-control ordinances if applicable.',
    ],
    attorneyPrompt:
      'Please review this lease packet for required disclosures, notice periods, and deposit handling rules in the property jurisdiction.',
  },
  {
    code: 'ca',
    name: 'California',
    overview:
      'California leases usually require additional consumer-protection disclosures and often involve local ordinances at the city level.',
    checklist: [
      'Validate statewide disclosures and city-specific addenda before final signatures.',
      'Review local rent stabilization / just-cause requirements where applicable.',
      'Confirm deposit, entry notice, and habitability language aligns with current statutes.',
      'Ensure utility allocation and fees are clearly described in writing.',
      'Include procedures for maintenance requests and response timelines.',
    ],
    attorneyPrompt:
      'Please verify this California lease and city addenda for disclosure compliance, rent-rule coverage, and enforceability.',
  },
  {
    code: 'tx',
    name: 'Texas',
    overview:
      'Texas lease packages should clearly define obligations, remedies, and procedures for notices, repairs, and payment handling.',
    checklist: [
      'Verify required notices and language around repair obligations and remedies.',
      'Confirm deposit-return workflow, documentation standards, and timelines.',
      'Confirm late-fee structure and cure periods are compliant and reasonable.',
      'Clarify pet, HOA, parking, and access-device policies in writing.',
      'Confirm right-of-entry and emergency maintenance procedures are documented.',
    ],
    attorneyPrompt:
      'Please review this Texas lease for required notices, fee structure compliance, and deposit procedure language.',
  },
  {
    code: 'fl',
    name: 'Florida',
    overview:
      'Florida landlords should document deposit handling methods, notices, and property-specific disclosures in lease packets.',
    checklist: [
      'Confirm notice language for lease non-renewal, rent changes, and tenant defaults.',
      'Verify deposit-handling process and post-move-out notice requirements.',
      'Document maintenance responsibilities and emergency contacts clearly.',
      'Confirm property rules, amenities, and access limitations are explicit.',
      'Check for municipal rules that add to statewide obligations.',
    ],
    attorneyPrompt:
      'Please validate this Florida lease for notice language, deposit handling workflow, and local addendum completeness.',
  },
  {
    code: 'ny',
    name: 'New York',
    overview:
      'New York lease requirements vary significantly by municipality, especially in regulated housing markets.',
    checklist: [
      'Confirm state-required notices and city-specific rider/addendum requirements.',
      'Check occupancy, renewal, and rent-change language against local rules.',
      'Validate deposit handling terms, inspection process, and move-out communications.',
      'Review entry notice, repair standards, and habitability commitments.',
      'Ensure all fee disclosures and optional charges are clearly itemized.',
    ],
    attorneyPrompt:
      'Please review this New York lease package for municipal riders, notice language, and fee/deposit compliance.',
  },
];

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const printHtml = (title: string, subtitle: string, body: string) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 26px; color: #0f172a; }
        h1 { margin: 0; font-size: 24px; }
        h2 { margin: 8px 0 18px; font-size: 14px; color: #475569; font-weight: 500; }
        h3 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b; }
        ul { margin: 0; padding-left: 18px; }
        li { margin-bottom: 8px; font-size: 12px; line-height: 1.5; }
        p { margin: 0 0 8px; font-size: 12px; line-height: 1.6; }
        .legal { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 11px; color: #475569; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <h2>${escapeHtml(subtitle)}</h2>
      ${body}
      <p class="legal">Reference use only. Regulations change frequently. Confirm all terms with a licensed attorney before signing.</p>
    </body>
  </html>
`;

const buildTemplatePrintHtml = (template: Template) => {
  const sectionHtml = template.sections
    .map(
      (section) => `
      <section>
        <h3>${escapeHtml(section.title)}</h3>
        <ul>
          ${section.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
      </section>
    `
    )
    .join('');

  return printHtml(template.title, template.subtitle, sectionHtml);
};

const launchPrint = (html: string, errorMessage: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    alert(errorMessage);
    return;
  }

  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 800);
  };

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();
};

const buildFinalLeaseHtml = ({
  stateName,
  landlordName,
  tenantNames,
  propertyAddress,
  leaseTerm,
  monthlyRent,
  dueDay,
  deposit,
  occupancyRules,
  utilities,
  additionalTerms,
  complianceChecklist,
  aiSuggestions,
}: {
  stateName: string;
  landlordName: string;
  tenantNames: string;
  propertyAddress: string;
  leaseTerm: string;
  monthlyRent: string;
  dueDay: string;
  deposit: string;
  occupancyRules: string;
  utilities: string;
  additionalTerms: string;
  complianceChecklist: string[];
  aiSuggestions: string[];
}) => {
  const checklistHtml = complianceChecklist.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const aiHtml = aiSuggestions.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  const body = `
    <section>
      <h3>1) Parties & premises</h3>
      <p><strong>Landlord:</strong> ${escapeHtml(landlordName || '_____________________________')}</p>
      <p><strong>Tenant(s):</strong> ${escapeHtml(tenantNames || '_____________________________')}</p>
      <p><strong>Property:</strong> ${escapeHtml(propertyAddress || '_____________________________')}</p>
      <p><strong>Governing state:</strong> ${escapeHtml(stateName)}</p>
    </section>
    <section>
      <h3>2) Core financial terms</h3>
      <p><strong>Lease term:</strong> ${escapeHtml(leaseTerm || '_____________________________')}</p>
      <p><strong>Monthly rent:</strong> ${escapeHtml(monthlyRent || '_____________________________')}</p>
      <p><strong>Rent due day:</strong> ${escapeHtml(dueDay || '_____________________________')}</p>
      <p><strong>Security deposit:</strong> ${escapeHtml(deposit || '_____________________________')}</p>
    </section>
    <section>
      <h3>3) Use, occupancy, and operations</h3>
      <p><strong>Occupancy and property rules:</strong> ${escapeHtml(
        occupancyRules || 'Add occupancy limits, guests, smoking, pets, and property use rules.'
      )}</p>
      <p><strong>Utility responsibilities:</strong> ${escapeHtml(
        utilities || 'Specify which utilities are landlord-paid vs tenant-paid.'
      )}</p>
      <p><strong>Additional terms:</strong> ${escapeHtml(
        additionalTerms || 'Add notices, repairs, renewal, entry, and termination procedures.'
      )}</p>
    </section>
    <section>
      <h3>4) State compliance checklist (${escapeHtml(stateName)})</h3>
      <ul>${checklistHtml}</ul>
    </section>
    ${
      aiSuggestions.length
        ? `<section><h3>5) AI drafting suggestions (review before use)</h3><ul>${aiHtml}</ul></section>`
        : ''
    }
    <section>
      <h3>6) Signatures</h3>
      <p>Landlord Signature: ____________________________________ Date: ____________________</p>
      <p>Tenant Signature: ______________________________________ Date: ____________________</p>
      <p>Tenant Signature: ______________________________________ Date: ____________________</p>
    </section>
  `;

  return printHtml('Final Residential Lease Packet', `Draft generated for ${escapeHtml(stateName)}`, body);
};

export default function LandlordTemplatesPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);
  const [builderMode, setBuilderMode] = useState<LeaseBuilderMode>('manual');
  const [selectedStateCode, setSelectedStateCode] = useState<string>(complianceGuides[0].code);
  const [landlordName, setLandlordName] = useState('');
  const [tenantNames, setTenantNames] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [leaseTerm, setLeaseTerm] = useState('12 months');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [dueDay, setDueDay] = useState('1st of each month');
  const [deposit, setDeposit] = useState('');
  const [occupancyRules, setOccupancyRules] = useState('');
  const [utilities, setUtilities] = useState('');
  const [additionalTerms, setAdditionalTerms] = useState('');
  const [aiAssistResult, setAiAssistResult] = useState<AiAssistResult | null>(null);
  const [aiAssistLoading, setAiAssistLoading] = useState(false);
  const [aiAssistError, setAiAssistError] = useState('');

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0],
    [selectedTemplateId]
  );

  const selectedCompliance = useMemo(
    () => complianceGuides.find((guide) => guide.code === selectedStateCode) || complianceGuides[0],
    [selectedStateCode]
  );

  const aiDraftSuggestions = aiAssistResult?.suggestions || [];

  const generateAiAssistance = async () => {
    setAiAssistError('');
    setAiAssistLoading(true);

    try {
      const response = await fetch('/api/lease-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stateName: selectedCompliance.name,
          landlordName,
          tenantNames,
          propertyAddress,
          leaseTerm,
          monthlyRent,
          dueDay,
          deposit,
          occupancyRules,
          utilities,
          additionalTerms,
          checklist: selectedCompliance.checklist,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to generate AI assistance right now.');
      }

      setAiAssistResult({
        summary: typeof data?.summary === 'string' ? data.summary : '',
        suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
        clausePack: Array.isArray(data?.clausePack) ? data.clausePack : [],
        legalReminder: typeof data?.legalReminder === 'string' ? data.legalReminder : '',
      });
    } catch (error: any) {
      setAiAssistError(error?.message || 'Unable to generate AI assistance right now.');
    } finally {
      setAiAssistLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Resource center</p>
            <h1 className="mt-1 text-2xl font-semibold">Lease Builder + State Guidance</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Build complete lease packets manually or with AI drafting suggestions. This workflow is reference-only
              and should always be reviewed by your attorney before sharing with tenants.
            </p>
          </div>

          <Link
            href="/landlord"
            className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-100 hover:border-emerald-500/70"
          >
            ← Back to dashboard
          </Link>
        </div>

        <section className="grid gap-4 lg:grid-cols-[330px_1fr]">
          <aside className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <div>
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Templates</p>
              <div className="space-y-2">
                {templates.map((template) => {
                  const active = selectedTemplate.id === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                        active
                          ? 'border-emerald-500/80 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-100">{template.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{template.subtitle}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-100">
              <p className="font-semibold uppercase tracking-wide">Legal reminder</p>
              <p className="mt-1 leading-relaxed">
                Reference tools only. State and local laws change frequently. Always have a licensed attorney review
                your lease before signing or sending final copies.
              </p>
            </div>
          </aside>

          <article className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">{selectedTemplate.title}</h2>
                <p className="mt-1 text-sm text-slate-300">{selectedTemplate.description}</p>
              </div>

              <button
                type="button"
                onClick={() =>
                  launchPrint(
                    buildTemplatePrintHtml(selectedTemplate),
                    'Unable to open print preview for the selected template in this browser.'
                  )
                }
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                Print template
              </button>
            </div>

            <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-2">
              <label className="space-y-2 text-xs text-slate-300">
                Lease drafting mode
                <select
                  value={builderMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as LeaseBuilderMode;
                    setBuilderMode(nextMode);
                    if (nextMode === 'manual') {
                      setAiAssistError('');
                    }
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="manual">Manual drafting</option>
                  <option value="ai">AI-assisted drafting</option>
                </select>
              </label>

              <label className="space-y-2 text-xs text-slate-300">
                State compliance profile
                <select
                  value={selectedStateCode}
                  onChange={(event) => setSelectedStateCode(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  {complianceGuides.map((guide) => (
                    <option key={guide.code} value={guide.code}>
                      {guide.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-xs text-slate-300 md:col-span-2">
                Landlord / entity legal name
                <input
                  value={landlordName}
                  onChange={(event) => setLandlordName(event.target.value)}
                  placeholder="Sunset Property Group LLC"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300 md:col-span-2">
                Tenant legal names
                <input
                  value={tenantNames}
                  onChange={(event) => setTenantNames(event.target.value)}
                  placeholder="Alex Tenant; Jordan Tenant"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300 md:col-span-2">
                Property address
                <input
                  value={propertyAddress}
                  onChange={(event) => setPropertyAddress(event.target.value)}
                  placeholder="123 Main St, Unit 4, Austin, TX"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300">
                Lease term
                <input
                  value={leaseTerm}
                  onChange={(event) => setLeaseTerm(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300">
                Monthly rent
                <input
                  value={monthlyRent}
                  onChange={(event) => setMonthlyRent(event.target.value)}
                  placeholder="$2,100.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300">
                Rent due schedule
                <input
                  value={dueDay}
                  onChange={(event) => setDueDay(event.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300">
                Security deposit
                <input
                  value={deposit}
                  onChange={(event) => setDeposit(event.target.value)}
                  placeholder="$2,100.00"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300 md:col-span-2">
                Occupancy, pets, guests, smoking, and use rules
                <textarea
                  value={occupancyRules}
                  onChange={(event) => setOccupancyRules(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300 md:col-span-2">
                Utility allocation and services
                <textarea
                  value={utilities}
                  onChange={(event) => setUtilities(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>

              <label className="space-y-2 text-xs text-slate-300 md:col-span-2">
                Additional legal / operational terms
                <textarea
                  value={additionalTerms}
                  onChange={(event) => setAdditionalTerms(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            </div>

            <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-sm font-semibold text-slate-100">{selectedCompliance.name} compliance helper</h3>
              <p className="mt-1 text-xs text-slate-300">{selectedCompliance.overview}</p>
              <ul className="mt-3 space-y-2 text-xs text-slate-200">
                {selectedCompliance.checklist.map((item) => (
                  <li key={item} className="rounded-md border border-slate-800 bg-slate-900/80 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-emerald-200">
                Attorney review prompt: <span className="text-emerald-100">{selectedCompliance.attorneyPrompt}</span>
              </p>
            </section>

            {builderMode === 'ai' ? (
              <section className="rounded-xl border border-violet-500/40 bg-violet-500/10 p-4">
                <h3 className="text-sm font-semibold text-violet-100">AI drafting assistant suggestions</h3>
                <p className="mt-1 text-xs text-violet-200">
                  Generate lease guidance from your entered draft terms. Verify every clause manually and with
                  legal counsel.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generateAiAssistance}
                    disabled={aiAssistLoading}
                    className="rounded-lg border border-violet-300/60 bg-violet-300/20 px-3 py-2 text-xs font-medium text-violet-100 hover:bg-violet-300/30 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {aiAssistLoading ? 'Generating AI suggestions...' : 'Generate AI suggestions'}
                  </button>
                  {aiAssistResult?.legalReminder ? (
                    <p className="text-xs text-violet-200">{aiAssistResult.legalReminder}</p>
                  ) : null}
                </div>
                {aiAssistError ? <p className="mt-3 text-xs text-rose-300">{aiAssistError}</p> : null}
                {aiAssistResult?.summary ? (
                  <p className="mt-3 rounded-md border border-violet-400/30 bg-violet-950/40 p-2 text-xs text-violet-100">
                    {aiAssistResult.summary}
                  </p>
                ) : null}
                {aiDraftSuggestions.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-violet-100">
                    {aiDraftSuggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-violet-200">
                    No AI output yet. Click &quot;Generate AI suggestions&quot; to create state-aware drafting guidance.
                  </p>
                )}
                {aiAssistResult?.clausePack?.length ? (
                  <div className="mt-3 rounded-md border border-violet-400/30 bg-violet-950/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-200">Suggested clause pack</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-violet-100">
                      {aiAssistResult.clausePack.map((clause) => (
                        <li key={clause}>{clause}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  launchPrint(
                    buildFinalLeaseHtml({
                      stateName: selectedCompliance.name,
                      landlordName,
                      tenantNames,
                      propertyAddress,
                      leaseTerm,
                      monthlyRent,
                      dueDay,
                      deposit,
                      occupancyRules,
                      utilities,
                      additionalTerms,
                      complianceChecklist: selectedCompliance.checklist,
                      aiSuggestions: aiDraftSuggestions,
                    }),
                    'Unable to open print preview for the generated lease in this browser.'
                  )
                }
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                Generate & print final lease
              </button>
              <p className="self-center text-xs text-slate-400">
                Final output includes compliance checklist and signature blocks for tenant-ready delivery.
              </p>
            </div>

            <div className="mt-4 space-y-4">
              {selectedTemplate.sections.map((section) => (
                <section key={section.title} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">{section.title}</h3>
                  <ul className="mt-2 space-y-2 text-xs text-slate-200">
                    {section.lines.map((line) => (
                      <li key={line} className="border-b border-dashed border-slate-700 pb-1">
                        {line}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
