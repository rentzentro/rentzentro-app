import { NextResponse } from 'next/server';
import type { IntegrationProvider } from '../../../lib/integrationsCatalog';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const supportActivationUrl =
  process.env.NEXT_PUBLIC_INTEGRATIONS_ACTIVATION_URL ||
  `mailto:support@rentzentro.com?subject=${encodeURIComponent('Integration activation request')}`;

const safeScopes = (input: string | undefined, fallback: string) => {
  const value = (input || fallback).trim();
  return encodeURIComponent(value);
};

const encodeState = (payload: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

function buildOAuthUrl(provider: IntegrationProvider, landlordId?: number) {
  const callbackBase = `${APP_URL}/landlord/integrations`;
  const state = encodeState({ provider, landlordId: landlordId || null, ts: Date.now() });

  if (provider === 'quickbooks') {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID;
    if (!clientId) return null;
    const redirectUri = encodeURIComponent(
      process.env.QUICKBOOKS_REDIRECT_URI || `${callbackBase}?provider=quickbooks`
    );

    return `https://appcenter.intuit.com/connect/oauth2?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${redirectUri}&response_type=code&scope=${safeScopes(
      process.env.QUICKBOOKS_SCOPES,
      'com.intuit.quickbooks.accounting'
    )}&state=${state}`;
  }

  if (provider === 'xero') {
    const clientId = process.env.XERO_CLIENT_ID;
    if (!clientId) return null;
    const redirectUri = encodeURIComponent(
      process.env.XERO_REDIRECT_URI || `${callbackBase}?provider=xero`
    );

    return `https://login.xero.com/identity/connect/authorize?response_type=code&client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${redirectUri}&scope=${safeScopes(
      process.env.XERO_SCOPES,
      'openid profile email accounting.transactions accounting.contacts offline_access'
    )}&state=${state}`;
  }

  if (provider === 'docusign') {
    const clientId = process.env.DOCUSIGN_CLIENT_ID;
    if (!clientId) return null;
    const redirectUri = encodeURIComponent(
      process.env.DOCUSIGN_REDIRECT_URI || `${callbackBase}?provider=docusign`
    );

    return `https://account-d.docusign.com/oauth/auth?response_type=code&scope=${safeScopes(
      process.env.DOCUSIGN_SCOPES,
      'signature'
    )}&client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirectUri}&state=${state}`;
  }

  if (provider === 'dropbox') {
    const clientId = process.env.DROPBOX_CLIENT_ID;
    if (!clientId) return null;
    const redirectUri = encodeURIComponent(
      process.env.DROPBOX_REDIRECT_URI || `${callbackBase}?provider=dropbox`
    );

    return `https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(
      clientId
    )}&response_type=code&redirect_uri=${redirectUri}&state=${state}`;
  }

  if (provider === 'google_drive') {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    if (!clientId) return null;
    const redirectUri = encodeURIComponent(
      process.env.GOOGLE_DRIVE_REDIRECT_URI || `${callbackBase}?provider=google_drive`
    );

    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${redirectUri}&response_type=code&access_type=offline&prompt=consent&scope=${safeScopes(
      process.env.GOOGLE_DRIVE_SCOPES,
      'https://www.googleapis.com/auth/drive.file'
    )}&state=${state}`;
  }

  if (provider === 'plaid') {
    const configuredUrl = process.env.PLAID_CONNECT_URL;
    return configuredUrl || null;
  }

  return null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const provider = (body?.provider || '') as IntegrationProvider;
  const landlordId = Number(body?.landlordId || 0) || undefined;

  if (!provider) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 });
  }

  const oauthUrl = buildOAuthUrl(provider, landlordId);
  if (oauthUrl) {
    return NextResponse.json({ url: oauthUrl, mode: 'oauth' });
  }

  return NextResponse.json({ url: supportActivationUrl, mode: 'activation' });
}
