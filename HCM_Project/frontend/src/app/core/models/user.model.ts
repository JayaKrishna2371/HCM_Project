export interface UserProfile {
  id: number;
  azure_oid: string;
  tenant_id?: string | null;
  email?: string | null;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  roles: string[];
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type AppRole = 'Admin' | 'Operator' | 'Viewer' | string;
