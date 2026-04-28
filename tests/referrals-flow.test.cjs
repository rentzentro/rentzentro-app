const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeReferralCode,
  buildLandlordReferralCode,
  buildLandlordReferralLink,
} = require('../app/lib/referrals.js');

test('sanitizeReferralCode normalizes user input safely', () => {
  assert.equal(sanitizeReferralCode('  rzL-22  '), 'RZL-22');
  assert.equal(sanitizeReferralCode('abc$%/123'), 'ABC123');
  assert.equal(sanitizeReferralCode(''), null);
});

test('buildLandlordReferralCode only emits valid landlord id codes', () => {
  assert.equal(buildLandlordReferralCode(19), 'RZL-19');
  assert.equal(buildLandlordReferralCode('20'), 'RZL-20');
  assert.equal(buildLandlordReferralCode(0), null);
  assert.equal(buildLandlordReferralCode('abc'), null);
});

test('buildLandlordReferralLink creates signup URL with ref query param', () => {
  assert.equal(
    buildLandlordReferralLink('https://rentzentro.com', 44),
    'https://rentzentro.com/landlord/signup?ref=RZL-44'
  );

  assert.equal(buildLandlordReferralLink('', 44), null);
});
