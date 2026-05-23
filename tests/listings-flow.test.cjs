const test = require('node:test');
const assert = require('node:assert/strict');

const { validateListingForPublish } = require('../app/landlord/listings/listingFlowValidation.ts');

test('publish validation rejects empty title', () => {
  const message = validateListingForPublish({
    title: '  ',
    contactEmail: 'owner@example.com',
    contactPhone: '',
  });

  assert.equal(message, 'Title is required before publishing.');
});

test('publish validation rejects missing contact channels', () => {
  const message = validateListingForPublish({
    title: '2BR apartment near downtown',
    contactEmail: ' ',
    contactPhone: ' ',
  });

  assert.equal(
    message,
    'Add a contact email or phone number before publishing so renters can reach you.'
  );
});

test('publish validation accepts valid listing publish payload', () => {
  const message = validateListingForPublish({
    title: '2BR apartment near downtown',
    contactEmail: ' owner@example.com ',
    contactPhone: '',
  });

  assert.equal(message, null);
});
