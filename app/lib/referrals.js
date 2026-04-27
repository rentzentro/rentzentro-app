const REFERRAL_PREFIX = 'RZL';

function sanitizeReferralCode(value) {
  if (!value || typeof value !== 'string') return null;

  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!cleaned) return null;

  return cleaned.slice(0, 40);
}

function buildLandlordReferralCode(landlordId) {
  if (landlordId == null) return null;
  const normalized = Number(landlordId);
  if (!Number.isInteger(normalized) || normalized <= 0) return null;
  return `${REFERRAL_PREFIX}-${normalized}`;
}

function buildLandlordReferralLink(origin, landlordId) {
  const code = buildLandlordReferralCode(landlordId);
  if (!origin || !code) return null;

  const base = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return `${base}/landlord/signup?ref=${encodeURIComponent(code)}`;
}

module.exports = {
  REFERRAL_PREFIX,
  sanitizeReferralCode,
  buildLandlordReferralCode,
  buildLandlordReferralLink,
};
