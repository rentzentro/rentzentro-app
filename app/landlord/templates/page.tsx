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

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildPrintHtml = (template: Template) => {
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

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(template.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 26px; color: #0f172a; }
          h1 { margin: 0; font-size: 24px; }
          h2 { margin: 8px 0 18px; font-size: 14px; color: #475569; font-weight: 500; }
          h3 { margin: 18px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #1e293b; }
          ul { margin: 0; padding-left: 18px; }
          li { margin-bottom: 8px; font-size: 12px; line-height: 1.5; }
          .legal { margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 11px; color: #475569; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(template.title)}</h1>
        <h2>${escapeHtml(template.subtitle)}</h2>
        ${sectionHtml}
        <p class="legal">Template provided for convenience only. Verify compliance with state and local law before use.</p>
      </body>
    </html>
  `;
};

const printTemplate = (template: Template) => {
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
    alert('Unable to open print preview in this browser.');
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
  iframeDoc.write(buildPrintHtml(template));
  iframeDoc.close();

};

export default function LandlordTemplatesPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0].id);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0],
    [selectedTemplateId]
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Resource center</p>
            <h1 className="mt-1 text-2xl font-semibold">Free printable landlord templates</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Built with richer sections so you can print and hand off clean, professional forms. Always
              review for local legal compliance before using with tenants.
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
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
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
          </aside>

          <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-50">{selectedTemplate.title}</h2>
                <p className="mt-1 text-sm text-slate-300">{selectedTemplate.description}</p>
              </div>

              <button
                type="button"
                onClick={() => printTemplate(selectedTemplate)}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                Print template
              </button>
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
