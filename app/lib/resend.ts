// lib/resend.ts
import { Resend } from 'resend';

// Single shared Resend client for the whole app
export const resend = new Resend(process.env.RESEND_API_KEY || '');

// Default "from" identity for RentZentro emails
export const RENTZENTRO_FROM_EMAIL =
  'RentZentro <notifications@mail.rentzentro.com>';

// Optional: support email you can reuse elsewhere
export const RENTZENTRO_REPLY_TO = 'rentzentro@gmail.com';
