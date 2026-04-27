const test = require('node:test');
const assert = require('node:assert/strict');

const { enforceOwnerApiAccess } = require('../app/lib/ownerApiAuth.js');

function makeReq({ authorization = '', ownerKey = '' } = {}) {
  return {
    headers: {
      get(name) {
        if (name === 'authorization') return authorization;
        if (name === 'x-owner-api-key') return ownerKey;
        return null;
      },
    },
  };
}

test('enforceOwnerApiAccess allows open mode when OWNER_API_TOKEN is missing', () => {
  delete process.env.OWNER_API_TOKEN;
  const result = enforceOwnerApiAccess(makeReq());
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'open');
});

test('enforceOwnerApiAccess rejects missing token when OWNER_API_TOKEN is configured', () => {
  process.env.OWNER_API_TOKEN = 'secret-owner-token';
  const result = enforceOwnerApiAccess(makeReq());
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('enforceOwnerApiAccess accepts bearer token', () => {
  process.env.OWNER_API_TOKEN = 'secret-owner-token';
  const result = enforceOwnerApiAccess(
    makeReq({ authorization: 'Bearer secret-owner-token' })
  );
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'token');
});
