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


function mapSignupErrorMessage(err) {
  const raw = String(err?.message || err?.error_description || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  const status = Number(err?.status || 0);

  const alreadyRegistered =
    raw.includes('user already registered') ||
    raw.includes('already registered') ||
    code === 'user_already_exists' ||
    (status === 422 && raw.includes('email'));

  if (alreadyRegistered) {
    return 'This email is already registered. Please sign in instead, or use Forgot password if needed.';
  }

  return err?.message || 'Unable to create your landlord account. Please try again.';
}

module.exports = {
  normalizeEmail,
  validateLandlordSignupInput,
  mapSignupErrorMessage,
};
