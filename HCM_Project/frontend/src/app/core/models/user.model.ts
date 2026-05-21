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

export type AppRole = 'Admin' | 'Operator' | 'Viewer' | string;
