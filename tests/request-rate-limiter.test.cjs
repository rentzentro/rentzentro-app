const test = require('node:test');
const assert = require('node:assert/strict');

const { takeRateLimitToken } = require('../app/lib/requestRateLimiter.js');

test('takeRateLimitToken blocks once limit is reached in window', () => {
  const key = `test-${Date.now()}`;
  const first = takeRateLimitToken({ key, limit: 2, windowMs: 60_000 });
  const second = takeRateLimitToken({ key, limit: 2, windowMs: 60_000 });
  const third = takeRateLimitToken({ key, limit: 2, windowMs: 60_000 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
});
