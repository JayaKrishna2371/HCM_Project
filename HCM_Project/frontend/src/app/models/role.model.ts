export interface Permission {
  id: number;
  code: string;
  description?: string | null;
}

export interface Role {
  id: number;
  tenant_id?: string | null;
  code: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  permissions: string[];
}

export interface RoleCreate {
  code: string;
  name: string;
  description?: string | null;
  permissions: string[];
  /** SUPER_ADMIN only: target tenant. Ignored for tenant admins. */
  tenant_id?: string | null;
}

export interface RoleUpdate {
  name?: string;
  description?: string | null;
  permissions?: string[];
}
