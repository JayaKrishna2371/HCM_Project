export interface AdminUser {
  id: number;
  tenant_id?: string | null;
  directory_id: string;
  username?: string | null;
  email?: string | null;
  name?: string | null;
  roles: string[];
  status: string;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserCreate {
  username: string;
  email?: string | null;
  name?: string | null;
  directory_id?: string | null;
  roles: string[];
  status?: string;
  tenant_id?: string | null;
}

export interface AdminUserUpdate {
  email?: string | null;
  name?: string | null;
  roles?: string[];
  status?: string;
}
