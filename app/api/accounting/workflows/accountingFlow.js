const {
  issueRentInvoiceWorkflow,
  recordRentPaymentWorkflow,
} = require('../../../lib/accountingWorkflows.js');

const json = (status, body) => ({ status, body });

async function createAccountingWorkflow({
  supabaseAdmin,
  supabaseAuth,
  authHeader,
  payload,
}) {
  if (!supabaseAdmin || !supabaseAuth) {
    return json(500, { error: 'Supabase credentials not configured on server.' });
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

  const landlordId = payload?.landlordId;
  if (typeof landlordId !== 'number') {
    return json(400, { error: 'Invalid landlordId in request body.' });
  }

  const { data: landlord, error: landlordError } = await supabaseAdmin
    .from('landlords')
    .select('id, user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (landlordError) {
    return json(500, { error: 'Unable to load landlord account.' });
  }

  if (!landlord) {
    return json(404, { error: 'Landlord account not found for authenticated user.' });
  }

  if (landlord.id !== landlordId) {
    return json(403, { error: 'Forbidden: landlordId does not match authenticated account.' });
  }

  const action = payload?.action;

  try {
    if (action === 'issue_invoice') {
      const workflow = issueRentInvoiceWorkflow({
        invoiceId: payload.invoiceId,
        occurredOn: payload.occurredOn,
        dueOn: payload.dueOn,
        rentAmount: payload.rentAmount,
        feeAmount: payload.feeAmount,
        unitLabel: payload.unitLabel,
      });

      return json(200, workflow);
    }

    if (action === 'record_payment') {
      const workflow = recordRentPaymentWorkflow({
        paymentId: payload.paymentId,
        invoiceId: payload.invoiceId,
        occurredOn: payload.occurredOn,
        method: payload.method,
        receivedAmount: payload.receivedAmount,
        processorFeeAmount: payload.processorFeeAmount,
      });

      return json(200, workflow);
    }

    return json(400, {
      error: 'Invalid action. Expected issue_invoice or record_payment.',
    });
  } catch (err) {
    return json(400, { error: err?.message || 'Invalid accounting workflow payload.' });
  }
}

module.exports = {
  createAccountingWorkflow,
};
