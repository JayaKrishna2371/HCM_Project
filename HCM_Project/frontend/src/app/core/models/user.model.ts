export interface UserProfile {
  id: number;
  directory_id: string;
  username?: string | null;
  upn?: string | null;
  email?: string | null;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  roles: string[];
  // Multi-tenancy: tenant the user belongs to (null for SUPER_ADMIN).
  tenant_id?: string | null;
  status?: string | null;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Shape of POST /auth/login response. */
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserProfile;
}

/**
 * Claims embedded in the backend-issued JWT. tenant_id / role / permissions are
 * the authorization context the SPA reads to gate menus and routes; the backend
 * remains the source of truth and re-checks every request.
 */
export interface TokenClaims {
  sub: string;
  tenant_id?: string | null;
  role?: string | null;
  roles?: string[];
  permissions?: string[];
  name?: string | null;
  email?: string | null;
  username?: string | null;
  exp?: number;
}

export type AppRole =
  | 'SUPER_ADMIN'
  | 'TENANT_ADMIN'
  | 'APPROVER'
  | 'USER'
  | 'READ_ONLY'
  | string;

export const SUPER_ADMIN = 'SUPER_ADMIN';
export const TENANT_ADMIN = 'TENANT_ADMIN';
