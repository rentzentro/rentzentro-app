function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateLandlordSignupInput({ email, password, confirmPassword }) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password || !confirmPassword) {
    return { ok: false, message: 'Please fill in all fields.' };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: 'Passwords do not match. Please double-check.' };
  }

  if (password.length < 8) {
    return { ok: false, message: 'Password should be at least 8 characters long.' };
  }

  return { ok: true, normalizedEmail };
}

function getTrialEndYMD(days = 35, now = new Date()) {
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + days);
  return trialEnd.toISOString().split('T')[0];
}

module.exports = {
  getTrialEndYMD,
  normalizeEmail,
  validateLandlordSignupInput,
};
