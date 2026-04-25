import { NextResponse } from 'next/server';

type LeaseAssistPayload = {
  stateName?: string;
  landlordName?: string;
  tenantNames?: string;
  propertyAddress?: string;
  leaseTerm?: string;
  monthlyRent?: string;
  dueDay?: string;
  deposit?: string;
  occupancyRules?: string;
  utilities?: string;
  additionalTerms?: string;
  checklist?: string[];
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_LEASE_MODEL || 'gpt-4.1-mini';

const clip = (value: string | undefined, max = 400) => (value || '').trim().slice(0, max);

const getOutputText = (data: any) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const pieces: string[] = [];
  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (typeof block?.text === 'string' && block.text.trim()) {
        pieces.push(block.text.trim());
      }
    }
  }

  return pieces.join('\n').trim();
};

export async function POST(req: Request) {
  const body = ((await req.json().catch(() => ({}))) || {}) as LeaseAssistPayload;

  if (!OPENAI_API_KEY) {
    return NextResponse.json(
      {
        error: 'AI assistant is not configured yet. Missing OPENAI_API_KEY on the server.',
      },
      { status: 503 }
    );
  }

  const stateName = clip(body.stateName, 80) || 'General U.S. baseline';
  const checklist = (Array.isArray(body.checklist) ? body.checklist : [])
    .map((item) => clip(item, 180))
    .filter(Boolean)
    .slice(0, 10);

  const prompt = [
    'You are a lease drafting assistant for landlords.',
    'Return practical drafting guidance only, not legal advice.',
    'Always include a reminder to verify with a licensed attorney.',
    'Output strict JSON with keys: summary (string), suggestions (array of 5 strings), clausePack (array of 4 strings).',
    'Each suggestion should be actionable and plain language.',
    'Each clausePack item should be a short draft clause heading + body sentence.',
    '',
    `State profile: ${stateName}`,
    `Landlord: ${clip(body.landlordName, 120) || 'Not provided'}`,
    `Tenant(s): ${clip(body.tenantNames, 160) || 'Not provided'}`,
    `Property: ${clip(body.propertyAddress, 180) || 'Not provided'}`,
    `Lease term: ${clip(body.leaseTerm, 120) || 'Not provided'}`,
    `Monthly rent: ${clip(body.monthlyRent, 80) || 'Not provided'}`,
    `Rent due schedule: ${clip(body.dueDay, 120) || 'Not provided'}`,
    `Security deposit: ${clip(body.deposit, 80) || 'Not provided'}`,
    `Occupancy rules: ${clip(body.occupancyRules, 380) || 'Not provided'}`,
    `Utilities: ${clip(body.utilities, 320) || 'Not provided'}`,
    `Additional terms: ${clip(body.additionalTerms, 380) || 'Not provided'}`,
    `Compliance checklist: ${checklist.join(' | ') || 'None provided'}`,
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      max_output_tokens: 900,
      text: {
        format: {
          type: 'json_schema',
          name: 'lease_assistant_response',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              suggestions: {
                type: 'array',
                minItems: 5,
                maxItems: 5,
                items: { type: 'string' },
              },
              clausePack: {
                type: 'array',
                minItems: 4,
                maxItems: 4,
                items: { type: 'string' },
              },
            },
            required: ['summary', 'suggestions', 'clausePack'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => 'Unknown AI provider error.');
    return NextResponse.json(
      {
        error: 'AI assistant failed to generate suggestions.',
        details,
      },
      { status: 502 }
    );
  }

  const data = await response.json();
  const outputText = getOutputText(data);

  if (!outputText) {
    return NextResponse.json(
      {
        error: 'AI assistant returned an empty response.',
      },
      { status: 502 }
    );
  }

  const parsed = JSON.parse(outputText) as {
    summary?: string;
    suggestions?: string[];
    clausePack?: string[];
  };

  return NextResponse.json({
    summary: clip(parsed.summary, 400),
    suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
      .map((item) => clip(item, 240))
      .filter(Boolean)
      .slice(0, 8),
    clausePack: (Array.isArray(parsed.clausePack) ? parsed.clausePack : [])
      .map((item) => clip(item, 360))
      .filter(Boolean)
      .slice(0, 8),
    legalReminder: 'Reference-only drafting support. Regulations change. Verify all terms with a licensed attorney.',
  });
}
