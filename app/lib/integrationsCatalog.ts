export type IntegrationProvider =
  | 'quickbooks'
  | 'xero'
  | 'screening'
  | 'docusign'
  | 'dropbox'
  | 'google_drive'
  | 'plaid';

export type IntegrationCard = {
  provider: IntegrationProvider;
  name: string;
  category: string;
  summary: string;
  outcomes: string[];
  statusLabel: string;
};

export const integrationCards: IntegrationCard[] = [
  {
    provider: 'quickbooks',
    name: 'QuickBooks Online',
    category: 'Accounting',
    summary:
      'Connect QuickBooks to reduce duplicate bookkeeping and keep rent + expense data flowing into your accounting stack.',
    outcomes: [
      'Sync invoice and payment journal payloads from RentZentro workflows.',
      'Reduce monthly close time by avoiding manual re-entry.',
    ],
    statusLabel: 'Beta connection',
  },
  {
    provider: 'xero',
    name: 'Xero',
    category: 'Accounting',
    summary:
      'Connect Xero to map property accounting activity into your existing chart-of-accounts process.',
    outcomes: [
      'Push rent and payment events to your accounting review process.',
      'Keep landlord and accountant workflows in one ledger system.',
    ],
    statusLabel: 'Beta connection',
  },
  {
    provider: 'screening',
    name: 'Screening providers',
    category: 'Tenant screening',
    summary:
      'Launch screening routing with configurable provider options so your team can choose the right workflow per market.',
    outcomes: [
      'Run applicant screening with fewer handoffs.',
      'Reduce friction between inquiry, application, and decision steps.',
    ],
    statusLabel: 'Partner activation',
  },
  {
    provider: 'docusign',
    name: 'DocuSign',
    category: 'E-sign',
    summary:
      'Connect DocuSign for teams that already run signature workflows there and need handoff from RentZentro.',
    outcomes: [
      'Route leases and addenda into your signature pipeline.',
      'Centralize signature completion status for leasing ops.',
    ],
    statusLabel: 'Beta connection',
  },
  {
    provider: 'dropbox',
    name: 'Dropbox',
    category: 'Storage',
    summary:
      'Connect Dropbox to reduce manual document exports and keep signed files in your existing storage workspace.',
    outcomes: [
      'Send finalized lease files to shared folders.',
      'Improve retrieval for owner, accounting, and legal teams.',
    ],
    statusLabel: 'Beta connection',
  },
  {
    provider: 'google_drive',
    name: 'Google Drive',
    category: 'Storage',
    summary:
      'Connect Google Drive for teams already operating in Google Workspace and shared drive structures.',
    outcomes: [
      'Store finalized documents with consistent naming.',
      'Minimize copy/paste and manual upload loops.',
    ],
    statusLabel: 'Beta connection',
  },
  {
    provider: 'plaid',
    name: 'Plaid',
    category: 'Banking',
    summary:
      'Connect Plaid-backed banking rails to improve payout validation and reconciliation workflows.',
    outcomes: [
      'Improve confidence in payout/account verification.',
      'Shorten reconciliation cycles for property operations.',
    ],
    statusLabel: 'Beta connection',
  },
];
