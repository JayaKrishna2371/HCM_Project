export type LoginType = 'PLATFORM_LDAP' | 'OWN_LDAP';
export type TenantStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Tenant {
  id: string;
  tenant_code: string;
  tenant_name: string;
  login_type: LoginType;
  is_master: boolean;
  base_role: string;
  user_count: number;
  ldap_server_url?: string | null;
  domain_name?: string | null;
  dc_name?: string | null;
  status: TenantStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantCreate {
  tenant_code: string;
  tenant_name: string;
  login_type: LoginType;
  base_role: string;
  ldap_server_url?: string | null;
  domain_name?: string | null;
  dc_name?: string | null;
}

export interface TenantUpdate {
  tenant_name?: string;
  login_type?: LoginType;
  base_role?: string;
  ldap_server_url?: string | null;
  domain_name?: string | null;
  dc_name?: string | null;
  status?: TenantStatus;
}
