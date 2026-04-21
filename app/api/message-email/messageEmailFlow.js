function normalizeEmail(value) {
  return (value || '').trim().toLowerCase();
}

function getDirection(senderType) {
  if (senderType === 'tenant') return 'tenant_to_landlord';
  if (senderType === 'landlord' || senderType === 'team') {
    return 'landlord_or_team_to_tenant';
  }
  return null;
}

function buildRecipients({ direction, landlordEmail, tenantEmail, teamEmails = [] }) {
  if (direction === 'tenant_to_landlord') {
    const unique = new Set();
    const normalizedLandlord = normalizeEmail(landlordEmail);
    if (normalizedLandlord) unique.add(normalizedLandlord);

    for (const teamEmail of teamEmails) {
      const normalized = normalizeEmail(teamEmail);
      if (normalized) unique.add(normalized);
    }

    return Array.from(unique);
  }

  if (direction === 'landlord_or_team_to_tenant') {
    return tenantEmail ? [tenantEmail] : [];
  }

  return [];
}

function buildMessageEmail({ direction, landlordName, tenantName, messageBody }) {
  const safeBody = messageBody || '';

  const preview =
    safeBody.length > 180
      ? `${safeBody.slice(0, 177).trimEnd()}…`
      : safeBody;

  const subject =
    direction === 'tenant_to_landlord'
      ? `New message from ${tenantName} in RentZentro`
      : 'New message from your landlord in RentZentro';

  const introLine =
    direction === 'tenant_to_landlord'
      ? `${tenantName} sent you a new message in your RentZentro portal.`
      : `${landlordName} sent you a new message in your RentZentro portal.`;

  const html = `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #0f172a;">
        <p>${introLine}</p>
        <p style="margin-top: 16px; margin-bottom: 4px; font-weight: 600;">Message preview:</p>
        <blockquote style="margin: 0; padding: 8px 12px; border-left: 3px solid #10b981; background:#f1f5f9;">
          ${preview.replace(/\n/g, '<br/>')}
        </blockquote>
        <p style="margin-top: 16px;">
          To reply, log in to your RentZentro portal.
        </p>
        <p style="margin-top: 24px; font-size: 12px; color:#64748b;">
          This notification was sent by RentZentro so you don’t miss important messages about your rentals.
        </p>
      </div>
    `;

  const text = `${introLine}\n\nMessage preview:\n\n${safeBody}\n\nTo reply, log in to your RentZentro portal.`;

  return { subject, introLine, preview, html, text };
}

module.exports = {
  getDirection,
  buildRecipients,
  buildMessageEmail,
};
