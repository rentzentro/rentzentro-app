import { NextResponse } from 'next/server';

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

type IntegrationState = {
  provider?: string;
  landlordId?: number | null;
  ts?: number;
};

const decodeState = (value: string | null): IntegrationState | null => {
  if (!value) return null;

  try {
    const raw = Buffer.from(value, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as IntegrationState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const realmId = url.searchParams.get('realmId');
  const error = url.searchParams.get('error') || url.searchParams.get('errorCode');
  const state = decodeState(url.searchParams.get('state'));

  const redirectUrl = new URL('/landlord/integrations', APP_URL);
  redirectUrl.searchParams.set('provider', 'quickbooks');

  if (error) {
    redirectUrl.searchParams.set('status', 'error');
    redirectUrl.searchParams.set('message', 'QuickBooks authorization was cancelled or denied.');
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set('status', 'error');
    redirectUrl.searchParams.set('message', 'QuickBooks authorization code is missing.');
    return NextResponse.redirect(redirectUrl);
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI || `${APP_URL}/api/integrations/quickbooks/callback`;

  if (!clientId || !clientSecret) {
    redirectUrl.searchParams.set('status', 'error');
    redirectUrl.searchParams.set('message', 'QuickBooks is not configured on this environment yet.');
    return NextResponse.redirect(redirectUrl);
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
    cache: 'no-store',
  });

  if (!tokenRes.ok) {
    const payload = await tokenRes.text().catch(() => 'unknown error');
    console.error('[integrations/quickbooks/callback] token exchange failed', {
      status: tokenRes.status,
      payload,
    });

    redirectUrl.searchParams.set('status', 'error');
    redirectUrl.searchParams.set('message', 'QuickBooks token exchange failed.');
    return NextResponse.redirect(redirectUrl);
  }

  const tokenPayload = await tokenRes.json().catch(() => null);
  if (!tokenPayload?.access_token) {
    redirectUrl.searchParams.set('status', 'error');
    redirectUrl.searchParams.set('message', 'QuickBooks token response was invalid.');
    return NextResponse.redirect(redirectUrl);
  }

  console.log('[integrations/quickbooks/callback] connected', {
    landlordId: state?.landlordId ?? null,
    realmId: realmId || null,
    hasRefreshToken: !!tokenPayload?.refresh_token,
    connectedAt: new Date().toISOString(),
  });

  redirectUrl.searchParams.set('status', 'success');
  redirectUrl.searchParams.set('message', 'QuickBooks connected successfully.');
  if (realmId) redirectUrl.searchParams.set('realmId', realmId);

  return NextResponse.redirect(redirectUrl);
}
