function getBearerToken(authHeader) {
  if (typeof authHeader !== 'string') return '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return '';
  return authHeader.slice('Bearer '.length).trim();
}

function enforceOwnerApiAccess(req) {
  const configuredToken = String(process.env.OWNER_API_TOKEN || '').trim();

  // Backward-compatible mode: if no owner token is configured, keep endpoint available.
  if (!configuredToken) {
    return { ok: true, mode: 'open' };
  }

  const authHeader = req.headers.get('authorization') || '';
  const headerToken = req.headers.get('x-owner-api-key') || '';
  const bearerToken = getBearerToken(authHeader);
  const provided = bearerToken || headerToken;

  if (!provided || provided !== configuredToken) {
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Unauthorized owner API request.',
      },
    };
  }

  return { ok: true, mode: 'token' };
}

module.exports = {
  enforceOwnerApiAccess,
};
