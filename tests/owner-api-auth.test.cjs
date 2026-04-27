const test = require('node:test');
const assert = require('node:assert/strict');

const {
  constantTimeTokenEquals,
  enforceOwnerApiAccess,
} = require('../app/lib/ownerApiAuth.js');

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

function makeSupabaseAdmin({ email = 'owner@example.com', error = null } = {}) {
  return {
    auth: {
      getUser: async () => ({
        data: error ? null : { user: { id: 'owner-1', email } },
        error,
      }),
    },
  };
}

test('enforceOwnerApiAccess allows open mode when no token and no admin emails are configured', async () => {
  delete process.env.OWNER_API_TOKEN;
  delete process.env.OWNER_ADMIN_EMAILS;

  const result = await enforceOwnerApiAccess({
    req: makeReq(),
    supabaseAdmin: makeSupabaseAdmin(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'open');
});

test('enforceOwnerApiAccess accepts OWNER_API_TOKEN when configured', async () => {
  process.env.OWNER_API_TOKEN = 'secret-owner-token';

  const result = await enforceOwnerApiAccess({
    req: makeReq({ ownerKey: 'secret-owner-token' }),
    supabaseAdmin: makeSupabaseAdmin(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'owner_api_token');
});

test('enforceOwnerApiAccess accepts bearer OWNER_API_TOKEN when configured', async () => {
  process.env.OWNER_API_TOKEN = 'secret-owner-token';
  delete process.env.OWNER_ADMIN_EMAILS;

  const result = await enforceOwnerApiAccess({
    req: makeReq({ authorization: 'Bearer secret-owner-token' }),
    supabaseAdmin: makeSupabaseAdmin(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'owner_api_token');
});

test('enforceOwnerApiAccess rejects near-match OWNER_API_TOKEN values', async () => {
  process.env.OWNER_API_TOKEN = 'secret-owner-token';
  delete process.env.OWNER_ADMIN_EMAILS;

  const result = await enforceOwnerApiAccess({
    req: makeReq({ ownerKey: 'secret-owner-token-typo' }),
    supabaseAdmin: makeSupabaseAdmin(),
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test('enforceOwnerApiAccess validates bearer token user email against OWNER_ADMIN_EMAILS', async () => {
  delete process.env.OWNER_API_TOKEN;
  process.env.OWNER_ADMIN_EMAILS = 'owner@example.com,admin@example.com';

  const result = await enforceOwnerApiAccess({
    req: makeReq({ authorization: 'Bearer jwt-token' }),
    supabaseAdmin: makeSupabaseAdmin({ email: 'owner@example.com' }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'owner_admin_email');
});

test('constantTimeTokenEquals returns false for empty or mismatched lengths', () => {
  assert.equal(constantTimeTokenEquals('', 'a'), false);
  assert.equal(constantTimeTokenEquals('abc', 'ab'), false);
  assert.equal(constantTimeTokenEquals('abc', 'xyz'), false);
  assert.equal(constantTimeTokenEquals('abc', 'abc'), true);
});
