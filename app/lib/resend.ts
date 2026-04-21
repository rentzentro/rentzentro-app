// lib/resend.ts
import { Resend } from 'resend';

let cachedClient: Resend | null = null;

function getMissingResendEnvReason(): string | null {
  if (!process.env.RESEND_API_KEY) {
    return 'RESEND_API_KEY is required.';
  }

  return null;
}

export function isResendConfigured(): boolean {
  return getMissingResendEnvReason() === null;
}

export function getResendClient(): Resend {
  if (cachedClient) return cachedClient;

  const missingReason = getMissingResendEnvReason();
  if (missingReason) {
    throw new Error(`Resend client is not configured: ${missingReason}`);
  }

  cachedClient = new Resend(process.env.RESEND_API_KEY as string);
  return cachedClient;
}

// Single shared Resend client for the whole app (lazy on first usage)
export const resend = new Proxy({} as Resend, {
  get(_target, prop, receiver) {
    const client = getResendClient();
    const value = Reflect.get(client as unknown as object, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
}) as Resend;

// Default "from" identity for RentZentro emails
export const RENTZENTRO_FROM_EMAIL =
  'RentZentro <notifications@rentzentro.com>';

// Optional: support email you can reuse elsewhere
export const RENTZENTRO_REPLY_TO = 'rentzentro@gmail.com';
