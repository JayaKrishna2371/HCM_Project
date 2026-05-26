-- =====================================================================
-- 001_multitenancy.sql  —  Enterprise multi-tenancy / RBAC schema
-- Model: Shared DB + Shared Schema + tenant_id (row-level isolation)
--
-- Idempotent. Safe to run on an existing HCM database. For local dev the
-- application also creates these objects automatically on startup
-- (create_all + app/db/bootstrap.py); this file is for managed/prod rollouts.
-- Target: PostgreSQL 13+
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Tenants (Business Units)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code     VARCHAR(64)  NOT NULL UNIQUE,
    tenant_name     VARCHAR(255) NOT NULL,
    login_type      VARCHAR(32)  NOT NULL DEFAULT 'PLATFORM_LDAP',
    is_master       BOOLEAN      NOT NULL DEFAULT FALSE,
    base_role       VARCHAR(64)  NOT NULL DEFAULT 'USER',
    ldap_server_url VARCHAR(512),
    domain_name     VARCHAR(255),
    dc_name         VARCHAR(255),
    status          VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    created_by      VARCHAR(256),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- For pre-existing tenants tables:
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS base_role VARCHAR(64) NOT NULL DEFAULT 'USER';
CREATE INDEX IF NOT EXISTS ix_tenants_tenant_code ON tenants (tenant_code);

-- ---------------------------------------------------------------------
-- Permissions catalog
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(64) NOT NULL UNIQUE,
    description VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS ix_permissions_code ON permissions (code);

-- ---------------------------------------------------------------------
-- Roles (tenant_id NULL = system role; set = tenant custom role)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    description VARCHAR(255),
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_role_scope_code UNIQUE (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS ix_roles_tenant_id ON roles (tenant_id);
CREATE INDEX IF NOT EXISTS ix_roles_code ON roles (code);

-- ---------------------------------------------------------------------
-- Role -> Permission (many-to-many)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------
-- Audit log (tenant-scoped; NULL tenant_id = platform event)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id             SERIAL PRIMARY KEY,
    tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
    actor_user_id  INTEGER,
    actor_username VARCHAR(256),
    action         VARCHAR(128) NOT NULL,
    resource_type  VARCHAR(64),
    resource_id    VARCHAR(128),
    status         VARCHAR(16) NOT NULL DEFAULT 'SUCCESS',
    ip_address     VARCHAR(64),
    user_agent     VARCHAR(512),
    detail         JSON,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_tenant_id ON audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at);

-- ---------------------------------------------------------------------
-- Extend existing users table (additive — preserves existing data)
-- ---------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE';
CREATE INDEX IF NOT EXISTS ix_users_tenant_id ON users (tenant_id);

-- ---------------------------------------------------------------------
-- Seed: default tenant + backfill existing users into it
-- (system roles, permissions and the super admin are seeded by the app
--  bootstrap; you may also seed them here if running app-less.)
-- ---------------------------------------------------------------------
INSERT INTO tenants (tenant_code, tenant_name, login_type, is_master, base_role, status, created_by)
VALUES ('HCAP', 'HCAP', 'PLATFORM_LDAP', TRUE, 'SUPER_ADMIN', 'ACTIVE', 'system')
ON CONFLICT (tenant_code) DO NOTHING;

-- Every tenant-less user (including super admins) joins the master tenant.
UPDATE users
   SET tenant_id = (SELECT id FROM tenants WHERE is_master = TRUE LIMIT 1)
 WHERE tenant_id IS NULL;

COMMIT;

-- =====================================================================
-- OPTIONAL hard backstop: PostgreSQL Row-Level Security on users.
-- The app must run  SET app.tenant_id = '<uuid>'  (or 'SUPER_ADMIN')
-- at the start of each request/transaction for this to take effect.
-- =====================================================================
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_users ON users
--   USING (
--     current_setting('app.tenant_id', true) = 'SUPER_ADMIN'
--     OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
--   );
