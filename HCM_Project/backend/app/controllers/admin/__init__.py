"""Administration API package — platform & tenant management.

Every router here sits behind tenant-aware permission guards
(``app.auth.tenant_deps``). Tenant users are confined to their own tenant;
SUPER_ADMIN operates platform-wide and may switch tenant context.
"""
