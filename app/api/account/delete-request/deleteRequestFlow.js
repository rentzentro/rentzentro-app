const json = (status, body) => ({ status, body });

function safeString(v, max = 5000) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

async function submitDeleteRequest({
  supabaseAdmin,
  supabaseAuth,
  authHeader,
  resendApiKey,
  supportEmail,
  fromEmail,
  reason,
  landlordId,
  fetchImpl,
}) {
  if (!supabaseAdmin || !supabaseAuth) {
    return json(500, { error: 'Supabase credentials not configured on server.' });
  }

  if (!resendApiKey) {
    return json(500, {
      error:
        'Account deletion request email is not configured (missing RESEND_API_KEY). Add RESEND_API_KEY and redeploy.',
    });
  }

  if (landlordId != null && typeof landlordId !== 'number') {
    return json(400, { error: 'Invalid landlordId.' });
  }

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  if (!token) {
    return json(401, { error: 'Missing bearer token.' });
  }

  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !authData?.user) {
    return json(401, { error: 'Not authenticated.' });
  }

  const authedUserId = authData.user.id;

  const { data: landlord, error: landlordError } = await supabaseAdmin
    .from('landlords')
    .select('id, user_id, email, name')
    .eq('user_id', authedUserId)
    .maybeSingle();

  if (landlordError) {
    return json(500, { error: 'Unable to load landlord account.' });
  }

  if (!landlord) {
    return json(404, { error: 'Landlord account not found for authenticated user.' });
  }

  if (landlordId != null && landlord.id !== landlordId) {
    return json(403, { error: 'Forbidden: landlordId does not match authenticated account.' });
  }

  const normalizedReason = safeString(reason ?? '', 2000) || null;
  const subject = `RentZentro: Account deletion request (Landlord #${landlord.id})`;

  const text = [
    'Account deletion request received.',
    '',
    `Landlord ID: ${landlord.id}`,
    `Email: ${landlord.email}`,
    `Name: ${landlord.name || '(none)'}`,
    `Auth User ID: ${landlord.user_id || '(unknown)'}`,
    `Reason: ${normalizedReason || '(none)'}`,
    '',
    'Note: Deleting an account should remove access and personal data where allowed. Payment/transaction records may be retained for legal/accounting purposes.',
  ].join('\n');

  const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system; line-height: 1.4;">
        <h2 style="margin:0 0 10px;">Account deletion request received</h2>
        <p style="margin:0 0 10px;">A landlord submitted an account deletion request from the Account &amp; subscription page.</p>
        <table cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #334155;">
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Landlord ID</td><td style="border:1px solid #334155; color:#e2e8f0;">${landlord.id}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Email</td><td style="border:1px solid #334155; color:#e2e8f0;">${landlord.email}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Name</td><td style="border:1px solid #334155; color:#e2e8f0;">${landlord.name || '(none)'}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Auth User ID</td><td style="border:1px solid #334155; color:#e2e8f0;">${landlord.user_id || '(unknown)'}</td></tr>
          <tr><td style="border:1px solid #334155; color:#94a3b8;">Reason</td><td style="border:1px solid #334155; color:#e2e8f0;">${normalizedReason || '(none)'}</td></tr>
        </table>
        <p style="margin:12px 0 0; color:#94a3b8; font-size: 12px;">
          Note: Deleting an account should remove access and personal data where allowed. Payment/transaction records may be retained for legal/accounting purposes.
        </p>
      </div>
    `;

  const sendRes = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `RentZentro <${fromEmail}>`,
      to: [supportEmail],
      reply_to: landlord.email,
      subject,
      text,
      html,
    }),
  });

  const sendData = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    return json(500, { error: sendData?.message || 'Failed to send deletion request email.' });
  }

  return json(200, { ok: true });
}

module.exports = {
  submitDeleteRequest,
};
