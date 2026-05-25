export interface AuditLog {
  id: number;
  tenant_id?: string | null;
  actor_user_id?: number | null;
  actor_username?: string | null;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  status: string;
  ip_address?: string | null;
  detail?: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
