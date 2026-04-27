const crypto = require('node:crypto');

function getBearerToken(authHeader) {
  if (typeof authHeader !== 'string') return '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice('Bearer '.length).trim();
}

function constantTimeTokenEquals(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));

  if (!left.length || !right.length || left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function parseOwnerAdminEmails(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isOwnerApiOpenModeAllowed() {
  const value = String(process.env.OWNER_API_ALLOW_OPEN_MODE || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

async function enforceOwnerApiAccess({ req, supabaseAdmin }) {
  const configuredToken = String(process.env.OWNER_API_TOKEN || '').trim();
  const authHeader = req.headers.get('authorization') || '';
  const headerToken = req.headers.get('x-owner-api-key') || '';
  const bearerToken = getBearerToken(authHeader);

  if (configuredToken) {
    const providedToken = headerToken || bearerToken;
    if (constantTimeTokenEquals(providedToken, configuredToken)) {
      return { ok: true, mode: 'owner_api_token' };
    }
  }

  const adminEmails = parseOwnerAdminEmails(process.env.OWNER_ADMIN_EMAILS);
  const allowOpenMode = isOwnerApiOpenModeAllowed();

  if (!configuredToken && !adminEmails.length) {
    if (allowOpenMode) {
      return { ok: true, mode: 'open' };
    }

    return {
      ok: false,
      status: 500,
      body: {
        error:
          'Owner API auth is not configured. Set OWNER_API_TOKEN or OWNER_ADMIN_EMAILS, or explicitly allow open mode.',
      },
    };
  }

  if (!supabaseAdmin) {
    return {
      ok: false,
      status: 500,
      body: {
        error: 'Supabase admin client is not configured for owner auth.',
      },
    };
  }

  if (!bearerToken) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Unauthorized owner API request.',
      },
    };
  }

  if (!adminEmails.length) {
    return {
      ok: false,
      status: 500,
      body: {
        error: 'OWNER_ADMIN_EMAILS is not configured.',
      },
    };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
    bearerToken
  );

  if (authError || !authData?.user) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Unauthorized owner API request.',
      },
    };
  }

  const userEmail = String(authData.user.email || '').toLowerCase();
  if (!userEmail || !adminEmails.includes(userEmail)) {
    return {
      ok: false,
      status: 403,
      body: {
        error: 'Forbidden: owner access is restricted to configured admins.',
      },
    };
  }

  return {
    ok: true,
    mode: 'owner_admin_email',
    ownerEmail: userEmail,
    ownerUserId: authData.user.id,
  };
}

module.exports = {
  constantTimeTokenEquals,
  enforceOwnerApiAccess,
  isOwnerApiOpenModeAllowed,
  parseOwnerAdminEmails,
};
