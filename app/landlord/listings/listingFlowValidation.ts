export type ListingPublishValidationInput = {
  title?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export function validateListingForPublish(input: ListingPublishValidationInput): string | null {
  const title = (input.title || '').trim();
  const contactEmail = (input.contactEmail || '').trim();
  const contactPhone = (input.contactPhone || '').trim();

  if (!title) return 'Title is required before publishing.';

  if (!contactEmail && !contactPhone) {
    return 'Add a contact email or phone number before publishing so renters can reach you.';
  }

  return null;
}
