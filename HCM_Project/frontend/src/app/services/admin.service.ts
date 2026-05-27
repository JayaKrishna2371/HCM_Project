import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '@env/environment';
import { AdminUser, AdminUserCreate, AdminUserUpdate } from '../models/admin-user.model';
import { AuditLogPage } from '../models/audit.model';
import { Permission, Role, RoleCreate, RoleUpdate } from '../models/role.model';
import { Tenant, TenantCreate, TenantUpdate } from '../models/tenant.model';

/** Typed client for the Administration API (/api/v1/admin/*). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin`;

  // ---- Tenants ----
  listTenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(`${this.base}/tenants`);
  }
  getTenant(id: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.base}/tenants/${id}`);
  }
  createTenant(body: TenantCreate): Observable<Tenant> {
    return this.http.post<Tenant>(`${this.base}/tenants`, body);
  }
  updateTenant(id: string, body: TenantUpdate): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.base}/tenants/${id}`, body);
  }
  deleteTenant(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tenants/${id}`);
  }

  // ---- Users ----
  /** SUPER_ADMIN: pass a tenantId to filter; omit for users across ALL tenants. */
  listUsers(tenantId?: string | null): Observable<AdminUser[]> {
    let params = new HttpParams();
    if (tenantId) params = params.set('tenant_id', tenantId);
    return this.http.get<AdminUser[]>(`${this.base}/users`, { params });
  }
  createUser(body: AdminUserCreate): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${this.base}/users`, body);
  }
  updateUser(id: number, body: AdminUserUpdate): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${this.base}/users/${id}`, body);
  }
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`);
  }

  // ---- Roles & permissions ----
  listRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.base}/roles`);
  }
  createRole(body: RoleCreate): Observable<Role> {
    return this.http.post<Role>(`${this.base}/roles`, body);
  }
  updateRole(id: number, body: RoleUpdate): Observable<Role> {
    return this.http.patch<Role>(`${this.base}/roles/${id}`, body);
  }
  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/roles/${id}`);
  }
  listPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.base}/permissions`);
  }

  // ---- Audit ----
  listAudit(opts: { action?: string; limit?: number; offset?: number } = {}): Observable<AuditLogPage> {
    let params = new HttpParams();
    if (opts.action) params = params.set('action', opts.action);
    if (opts.limit != null) params = params.set('limit', String(opts.limit));
    if (opts.offset != null) params = params.set('offset', String(opts.offset));
    return this.http.get<AuditLogPage>(`${this.base}/audit`, { params });
  }
}
