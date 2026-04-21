const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildJournalEntry,
  issueRentInvoiceWorkflow,
  recordRentPaymentWorkflow,
} = require('../app/lib/accountingWorkflows.js');

test('buildJournalEntry enforces double-entry balance', () => {
  assert.throws(
    () =>
      buildJournalEntry({
        journalId: 'je_1',
        occurredOn: '2026-04-01',
        description: 'Unbalanced entry',
        lines: [
          { accountCode: '1000-cash', debitCents: 10000 },
          { accountCode: '4100-rental-income', creditCents: 9000 },
        ],
      }),
    /out of balance/
  );
});

test('issueRentInvoiceWorkflow creates balanced receivable/revenue posting', () => {
  const workflow = issueRentInvoiceWorkflow({
    invoiceId: 'inv_1001',
    occurredOn: '2026-04-01',
    dueOn: '2026-04-05',
    rentAmount: 1850,
    feeAmount: 25,
    unitLabel: 'Sunset Villas · Unit 4',
  });

  assert.equal(workflow.invoice.totalCents, 187500);
  assert.equal(workflow.invoice.status, 'open');
  assert.equal(workflow.journalEntry.totals.debitCents, 187500);
  assert.equal(workflow.journalEntry.totals.creditCents, 187500);
  assert.equal(workflow.journalEntry.lines[0].accountCode, '1100-accounts-receivable');
  assert.equal(workflow.journalEntry.lines[1].accountCode, '4100-rental-income');
  assert.equal(workflow.journalEntry.lines[2].accountCode, '4200-late-fee-income');
});

test('recordRentPaymentWorkflow supports net settlement with processor fees', () => {
  const workflow = recordRentPaymentWorkflow({
    paymentId: 'pay_1001',
    invoiceId: 'inv_1001',
    occurredOn: '2026-04-03',
    method: 'card',
    receivedAmount: 1815,
    processorFeeAmount: 60,
  });

  assert.equal(workflow.payment.grossCents, 187500);
  assert.equal(workflow.payment.netCashCents, 181500);
  assert.equal(workflow.payment.processorFeeCents, 6000);
  assert.equal(workflow.journalEntry.totals.debitCents, 187500);
  assert.equal(workflow.journalEntry.totals.creditCents, 187500);

  const feeLine = workflow.journalEntry.lines.find(
    (line) => line.accountCode === '6100-payment-processing-fees'
  );
  assert.ok(feeLine);
  assert.equal(feeLine.debitCents, 6000);
});
