const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getRateLimitClientIp,
  takeRateLimitToken,
} = require('../app/lib/requestRateLimiter.js');

test('takeRateLimitToken blocks once limit is reached in window', () => {
  const key = `test-${Date.now()}`;
  const first = takeRateLimitToken({ key, limit: 2, windowMs: 60_000 });
  const second = takeRateLimitToken({ key, limit: 2, windowMs: 60_000 });
  const third = takeRateLimitToken({ key, limit: 2, windowMs: 60_000 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
});

test('getRateLimitClientIp uses first forwarded IP and falls back safely', () => {
  const reqWithForwarded = {
    headers: {
      get(header) {
        if (header === 'x-forwarded-for') return '198.51.100.20, 10.0.0.1';
        return null;
      },
    },
  };

  const reqWithRealIpOnly = {
    headers: {
      get(header) {
        if (header === 'x-real-ip') return '203.0.113.8';
        return null;
      },
    },
  };

  const reqWithCloudflareIp = {
    headers: {
      get(header) {
        if (header === 'cf-connecting-ip') return '192.0.2.77';
        return null;
      },
    },
  };

  const reqWithoutIp = { headers: { get() { return null; } } };

  assert.equal(getRateLimitClientIp(reqWithForwarded), '198.51.100.20');
  assert.equal(getRateLimitClientIp(reqWithCloudflareIp), '192.0.2.77');
  assert.equal(getRateLimitClientIp(reqWithRealIpOnly), '203.0.113.8');
  assert.equal(getRateLimitClientIp(reqWithoutIp), 'unknown');
});
