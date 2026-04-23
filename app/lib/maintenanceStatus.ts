export type MaintenanceStatusMeta = {
  key: string;
  label: string;
  progress: number;
};

const STATUS_SYNONYMS: Record<string, string> = {
  new: 'new',
  submitted: 'new',
  acknowledged: 'acknowledged',
  received: 'acknowledged',
  scheduled: 'scheduled',
  in_progress: 'in_progress',
  'in progress': 'in_progress',
  underway: 'in_progress',
  waiting_parts: 'waiting_parts',
  'waiting parts': 'waiting_parts',
  'on hold': 'waiting_parts',
  completed: 'completed',
  resolved: 'completed',
  closed: 'completed',
};

const STATUS_META: Record<string, MaintenanceStatusMeta> = {
  new: { key: 'new', label: 'Submitted', progress: 20 },
  acknowledged: { key: 'acknowledged', label: 'Acknowledged', progress: 40 },
  scheduled: { key: 'scheduled', label: 'Scheduled', progress: 60 },
  in_progress: { key: 'in_progress', label: 'In progress', progress: 80 },
  waiting_parts: {
    key: 'waiting_parts',
    label: 'Waiting on parts',
    progress: 85,
  },
  completed: { key: 'completed', label: 'Completed', progress: 100 },
};

export const normalizeMaintenanceStatus = (status: string | null | undefined) => {
  if (!status) return 'new';
  const cleaned = status.trim().toLowerCase();
  return STATUS_SYNONYMS[cleaned] || cleaned.replaceAll(' ', '_');
};

export const getMaintenanceStatusMeta = (
  status: string | null | undefined
): MaintenanceStatusMeta => {
  const normalized = normalizeMaintenanceStatus(status);
  return (
    STATUS_META[normalized] || {
      key: normalized,
      label: normalized.replaceAll('_', ' '),
      progress: normalized === 'completed' ? 100 : 20,
    }
  );
};

export const MAINTENANCE_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_parts', label: 'Waiting on parts' },
  { value: 'completed', label: 'Completed' },
] as const;
export const MAINTENANCE_STATUS_ORDER = MAINTENANCE_STATUS_OPTIONS.map(
  (option) => option.value
);