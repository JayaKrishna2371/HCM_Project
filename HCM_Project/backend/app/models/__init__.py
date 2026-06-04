"""Importing the package registers every ORM model on ``Base.metadata`` so
``create_all`` / migrations see them. Order matters: ``tenants`` must be defined
before models that FK to it.
"""
from app.models.tenants.tenant_model import Tenant  # noqa: F401
from app.models.roles.rbac_model import Permission, Role, role_permissions  # noqa: F401
from app.models.users.user_model import User  # noqa: F401
from app.models.audit.audit_model import AuditLog  # noqa: F401
