export type AuditLogActor = {
  id: string;
  displayName: string;
  username: string;
};

export type AuditLogItem = {
  id: string;
  action: string;
  actionLabel: string;
  entityType: string;
  entityLabel: string;
  entityId: string | null;
  actor: AuditLogActor | null;
  oldValues: unknown;
  newValues: unknown;
  metadata: unknown;
  requestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type AuditLogFilters = {
  users: AuditLogActor[];
  actions: Array<{ value: string; label: string }>;
  entityTypes: Array<{ value: string; label: string }>;
};

export type AuditLogPage = {
  items: AuditLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  filters: AuditLogFilters;
};
