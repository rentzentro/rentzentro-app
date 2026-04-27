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

module.exports = {
  takeRateLimitToken,
};
