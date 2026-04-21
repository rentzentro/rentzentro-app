const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getTrialEndYMD,
  normalizeEmail,
  validateLandlordSignupInput,
} = require('../app/landlord/signup/signupValidation.cjs');

test('normalizeEmail trims and lowercases email', () => {
  assert.equal(normalizeEmail('  OWNER@Example.COM  '), 'owner@example.com');
});

test('validation rejects missing fields', () => {
  const result = validateLandlordSignupInput({ email: '', password: '', confirmPassword: '' });
  assert.equal(result.ok, false);
  assert.equal(result.message, 'Please fill in all fields.');
});

test('validation rejects password mismatch', () => {
  const result = validateLandlordSignupInput({
    email: 'owner@example.com',
    password: 'password123',
    confirmPassword: 'different123',
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, 'Passwords do not match. Please double-check.');
});

test('validation rejects short password', () => {
  const result = validateLandlordSignupInput({
    email: 'owner@example.com',
    password: 'abc123',
    confirmPassword: 'abc123',
  });
  assert.equal(result.ok, false);
  assert.equal(result.message, 'Password should be at least 8 characters long.');
});

test('validation accepts valid values and returns normalized email', () => {
  const result = validateLandlordSignupInput({
    email: ' OWNER@Example.COM ',
    password: 'password123',
    confirmPassword: 'password123',
  });
  assert.equal(result.ok, true);
  assert.equal(result.normalizedEmail, 'owner@example.com');
});

test('trial end date is 35 days from now by default', () => {
  const mockNow = new Date('2026-04-21T00:00:00.000Z');
  assert.equal(getTrialEndYMD(35, mockNow), '2026-05-26');
});
