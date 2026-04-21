const USD_SCALE = 100;

const toCents = (value, fieldName) => {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${fieldName} is required.`);
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }

  return Math.round(numeric * USD_SCALE);
};

const assertIsoDate = (value, fieldName) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be an ISO date (YYYY-MM-DD).`);
  }
};

const buildJournalEntry = ({
  journalId,
  occurredOn,
  description,
  reference = null,
  lines,
}) => {
  if (!journalId || typeof journalId !== 'string') {
    throw new Error('journalId is required.');
  }

  assertIsoDate(occurredOn, 'occurredOn');

  if (!description || typeof description !== 'string') {
    throw new Error('description is required.');
  }

  if (!Array.isArray(lines) || lines.length < 2) {
    throw new Error('At least two journal lines are required.');
  }

  const normalizedLines = lines.map((line, idx) => {
    if (!line || typeof line !== 'object') {
      throw new Error(`line ${idx + 1} is invalid.`);
    }

    const accountCode = (line.accountCode || '').trim();
    if (!accountCode) {
      throw new Error(`line ${idx + 1} is missing accountCode.`);
    }

    const debitCents = line.debitCents || 0;
    const creditCents = line.creditCents || 0;

    if (!Number.isInteger(debitCents) || debitCents < 0) {
      throw new Error(`line ${idx + 1} has invalid debitCents.`);
    }

    if (!Number.isInteger(creditCents) || creditCents < 0) {
      throw new Error(`line ${idx + 1} has invalid creditCents.`);
    }

    if ((debitCents > 0 && creditCents > 0) || (debitCents === 0 && creditCents === 0)) {
      throw new Error(`line ${idx + 1} must have either debit or credit amount.`);
    }

    return {
      accountCode,
      debitCents,
      creditCents,
      memo: line.memo ? String(line.memo) : null,
    };
  });

  const debitTotal = normalizedLines.reduce((sum, line) => sum + line.debitCents, 0);
  const creditTotal = normalizedLines.reduce((sum, line) => sum + line.creditCents, 0);

  if (debitTotal !== creditTotal) {
    throw new Error('Journal entry is out of balance. Debits must equal credits.');
  }

  return {
    journalId,
    occurredOn,
    description,
    reference,
    totals: {
      debitCents: debitTotal,
      creditCents: creditTotal,
    },
    lines: normalizedLines,
  };
};

const issueRentInvoiceWorkflow = ({
  invoiceId,
  occurredOn,
  dueOn,
  rentAmount,
  feeAmount = 0,
  unitLabel = null,
}) => {
  if (!invoiceId || typeof invoiceId !== 'string') {
    throw new Error('invoiceId is required.');
  }

  assertIsoDate(occurredOn, 'occurredOn');
  assertIsoDate(dueOn, 'dueOn');

  const rentCents = toCents(rentAmount, 'rentAmount');
  const feeCents = toCents(feeAmount, 'feeAmount');

  if (rentCents <= 0) {
    throw new Error('rentAmount must be greater than 0.');
  }

  if (feeCents < 0) {
    throw new Error('feeAmount cannot be negative.');
  }

  const receivableCents = rentCents + feeCents;

  return {
    workflow: 'invoice_issue',
    invoice: {
      invoiceId,
      occurredOn,
      dueOn,
      rentCents,
      feeCents,
      totalCents: receivableCents,
      status: 'open',
      unitLabel,
    },
    journalEntry: buildJournalEntry({
      journalId: `je:${invoiceId}:issue`,
      occurredOn,
      description: 'Issue rent invoice',
      reference: invoiceId,
      lines: [
        { accountCode: '1100-accounts-receivable', debitCents: receivableCents },
        { accountCode: '4100-rental-income', creditCents: rentCents },
        ...(feeCents > 0
          ? [{ accountCode: '4200-late-fee-income', creditCents: feeCents }]
          : []),
      ],
    }),
  };
};

const recordRentPaymentWorkflow = ({
  paymentId,
  invoiceId,
  occurredOn,
  method,
  receivedAmount,
  processorFeeAmount = 0,
}) => {
  if (!paymentId || typeof paymentId !== 'string') {
    throw new Error('paymentId is required.');
  }

  if (!invoiceId || typeof invoiceId !== 'string') {
    throw new Error('invoiceId is required.');
  }

  assertIsoDate(occurredOn, 'occurredOn');

  const methodValue = (method || '').trim().toLowerCase();
  if (!methodValue) {
    throw new Error('method is required.');
  }

  const receivedCents = toCents(receivedAmount, 'receivedAmount');
  const processorFeeCents = toCents(processorFeeAmount, 'processorFeeAmount');

  if (receivedCents <= 0) {
    throw new Error('receivedAmount must be greater than 0.');
  }

  if (processorFeeCents < 0) {
    throw new Error('processorFeeAmount cannot be negative.');
  }

  const grossCents = receivedCents + processorFeeCents;

  return {
    workflow: 'payment_record',
    payment: {
      paymentId,
      invoiceId,
      occurredOn,
      method: methodValue,
      grossCents,
      processorFeeCents,
      netCashCents: receivedCents,
      status: 'settled',
    },
    journalEntry: buildJournalEntry({
      journalId: `je:${paymentId}:settle`,
      occurredOn,
      description: 'Record rent payment',
      reference: invoiceId,
      lines: [
        { accountCode: '1000-cash', debitCents: receivedCents },
        ...(processorFeeCents > 0
          ? [{ accountCode: '6100-payment-processing-fees', debitCents: processorFeeCents }]
          : []),
        { accountCode: '1100-accounts-receivable', creditCents: grossCents },
      ],
    }),
  };
};

module.exports = {
  buildJournalEntry,
  issueRentInvoiceWorkflow,
  recordRentPaymentWorkflow,
};
