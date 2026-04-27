const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 60;

function getStore() {
  if (!globalThis.__rzRateLimiterStore) {
    globalThis.__rzRateLimiterStore = new Map();
  }
  return globalThis.__rzRateLimiterStore;
}

function takeRateLimitToken({ key, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS }) {
  const now = Date.now();
  const bucketKey = String(key || 'unknown');
  const store = getStore();

  const existing = store.get(bucketKey);
  if (!existing || now - existing.windowStart >= windowMs) {
    store.set(bucketKey, {
      windowStart: now,
      count: 1,
    });
    return { ok: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (existing.count >= limit) {
    const elapsed = now - existing.windowStart;
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.max(0, windowMs - elapsed),
    };
  }

  existing.count += 1;
  store.set(bucketKey, existing);

  return { ok: true, remaining: Math.max(0, limit - existing.count), resetMs: windowMs };
}

function getRateLimitClientIp(req) {
  const normalizeIpCandidate = (value) => {
    const raw = String(value || '').trim();
    if (!raw || raw.toLowerCase() === 'unknown') {
      return '';
    }

    const bracketMatch = raw.match(/^\[([^\]]+)\](?::\d+)?$/);
    if (bracketMatch?.[1]) {
      return bracketMatch[1];
    }

    const ipv4WithPortMatch = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (ipv4WithPortMatch?.[1]) {
      return ipv4WithPortMatch[1];
    }

    if (raw.startsWith('::ffff:')) {
      return raw.slice('::ffff:'.length);
    }

    return raw;
  };

  const xForwardedFor = req?.headers?.get?.('x-forwarded-for') || '';
  const firstForwardedIp = normalizeIpCandidate(
    String(xForwardedFor)
    .split(',')[0]
    .trim()
  );

  if (firstForwardedIp) {
    return firstForwardedIp;
  }

  const cfConnectingIp = req?.headers?.get?.('cf-connecting-ip') || '';
  const normalizedCfConnectingIp = normalizeIpCandidate(cfConnectingIp);
  if (normalizedCfConnectingIp) {
    return normalizedCfConnectingIp;
  }

  const realIp = req?.headers?.get?.('x-real-ip') || '';
  const normalizedRealIp = normalizeIpCandidate(realIp);
  return normalizedRealIp || 'unknown';
}

module.exports = {
  getRateLimitClientIp,
  takeRateLimitToken,
};
