'use client';

import Link from 'next/link';

type Template = {
  id: string;
  title: string;
  description: string;
  body: string[];
};

const templates: Template[] = [
  {
    id: 'residential-lease',
    title: 'Residential Lease Agreement',
    description:
      'A clean starting point for outlining rent, term, security deposit, and house rules.',
    body: [
      'Property Address: _______________________________',
      'Lease Term (start/end dates): ___________________',
      'Monthly Rent Amount & Due Date: _________________',
      'Security Deposit Amount: ________________________',
      'Late Fee Terms: _________________________________',
      'Utilities Included: ______________________________',
      'Occupancy Limits / Pet Policy: __________________',
      'Landlord Signature / Date: ______________________',
      'Tenant Signature / Date: ________________________',
    ],
  },
  {
    id: 'month-to-month-addendum',
    title: 'Month-to-Month Addendum',
    description:
      'Use this when converting a fixed lease to month-to-month after the initial term.',
    body: [
      'Original Lease Date: ____________________________',
      'Effective Month-to-Month Date: _________________',
      'New Monthly Rent Amount: ________________________',
      'Required Notice Period: _________________________',
      'Changes to Terms (if any): ______________________',
      'Landlord Signature / Date: ______________________',
      'Tenant Signature / Date: ________________________',
    ],
  },
  {
    id: 'move-in-checklist',
    title: 'Move-In / Move-Out Condition Checklist',
    description:
      'Document property condition room-by-room to reduce disputes and protect deposits.',
    body: [
      'Property / Unit: ________________________________',
      'Tenant Name(s): _________________________________',
      'Date of Inspection: _____________________________',
      'Kitchen Condition Notes: ________________________',
      'Bathroom Condition Notes: _______________________',
      'Living / Bedrooms Condition Notes: ______________',
      'Appliance Inventory + Condition: ________________',
      'Photo Evidence Attached: Yes / No',
      'Landlord Signature / Date: ______________________',
      'Tenant Signature / Date: ________________________',
    ],
  },
  {
    id: 'maintenance-notice',
    title: 'Maintenance Entry Notice',
    description:
      'Notify tenants before entering a unit for repairs, inspections, or preventive maintenance.',
    body: [
      'Tenant Name(s): _________________________________',
      'Property / Unit Address: ________________________',
      'Entry Date + Time Window: _______________________',
      'Reason for Entry: _______________________________',
      'Technician / Vendor Name: _______________________',
      'Contact for Questions: __________________________',
      'Issued By / Date: _______________________________',
    ],
  },
];

const printTemplate = (title: string, lines: string[]) => {
  const html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
          h1 { font-size: 20px; margin-bottom: 18px; }
          ul { padding-left: 18px; }
          li { margin-bottom: 14px; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <ul>
          ${lines.map((line) => `<li>${line}</li>`).join('')}
        </ul>
      </body>
    </html>
  `;

  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!popup) return;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
};

export default function LandlordTemplatesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Resource center</p>
            <h1 className="mt-1 text-2xl font-semibold">Free printable landlord templates</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">
              Use these free starter templates to save time. Review and customize them to match local laws,
              property details, and your attorney&apos;s guidance before use.
            </p>
          </div>

          <Link
            href="/landlord"
            className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs font-medium text-slate-100 hover:border-emerald-500/70"
          >
            ← Back to dashboard
          </Link>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => (
            <article key={template.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-sm font-semibold text-slate-50">{template.title}</p>
              <p className="mt-1 text-xs text-slate-400">{template.description}</p>

              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                {template.body.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>

              <button
                onClick={() => printTemplate(template.title, template.body)}
                className="mt-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/20"
              >
                Print template
              </button>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
