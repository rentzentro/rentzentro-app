const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeEmail,
  validateLandlordSignupInput,
  mapSignupErrorMessage,
} = require('../app/landlord/signup/signupValidation.js');

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


test('mapSignupErrorMessage translates user already registered errors', () => {
  const message = mapSignupErrorMessage({ message: 'User already registered' });
  assert.equal(
    message,
    'This email is already registered. Please sign in instead, or use Forgot password if needed.'
  );
});

test('mapSignupErrorMessage falls back to original message when unknown', () => {
  const message = mapSignupErrorMessage({ message: 'Temporary outage' });
  assert.equal(message, 'Temporary outage');
});
