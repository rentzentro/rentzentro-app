const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createAccountingWorkflow,
} = require('../app/api/accounting/workflows/accountingFlow.js');

const makeSupabaseAuth = ({ user = { id: 'user-1' }, error = null } = {}) => ({
  auth: {
    getUser: async () => ({ data: { user }, error }),
  },
});

const makeSupabaseAdmin = ({ landlord, landlordError = null }) => ({
  from: (table) => {
    assert.equal(table, 'landlords');
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: landlord, error: landlordError }),
        }),
      }),
    };
  },
});

test('createAccountingWorkflow rejects missing bearer token', async () => {
  const result = await createAccountingWorkflow({
    supabaseAdmin: {},
    supabaseAuth: {},
    authHeader: '',
    payload: {},
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'Missing bearer token.');
});

test('createAccountingWorkflow rejects landlord mismatch', async () => {
  const result = await createAccountingWorkflow({
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 12, user_id: 'user-1' },
    }),
    supabaseAuth: makeSupabaseAuth(),
    authHeader: 'Bearer token',
    payload: {
      action: 'issue_invoice',
      landlordId: 99,
      invoiceId: 'inv_1',
      occurredOn: '2026-04-01',
      dueOn: '2026-04-05',
      rentAmount: 1000,
    },
  });

  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'Forbidden: landlordId does not match authenticated account.');
});

test('createAccountingWorkflow returns invoice workflow payload', async () => {
  const result = await createAccountingWorkflow({
    supabaseAdmin: makeSupabaseAdmin({
      landlord: { id: 77, user_id: 'user-1' },
    }),
    supabaseAuth: makeSupabaseAuth(),
    authHeader: 'Bearer token',
    payload: {
      action: 'issue_invoice',
      landlordId: 77,
      invoiceId: 'inv_1',
      occurredOn: '2026-04-01',
      dueOn: '2026-04-05',
      rentAmount: 1250,
      feeAmount: 25,
      unitLabel: 'Maple Court · Unit 3',
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.workflow, 'invoice_issue');
  assert.equal(result.body.invoice.totalCents, 127500);
  assert.equal(result.body.journalEntry.totals.debitCents, 127500);
});
