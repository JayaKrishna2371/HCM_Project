"""Importing the package registers every ORM model on ``Base.metadata`` so
``create_all`` / migrations see them. Order matters: ``tenants`` must be defined
before models that FK to it.
"""
from app.models.tenant import Tenant  # noqa: F401
from app.models.rbac import Permission, Role, role_permissions  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.audit import AuditLog  # noqa: F401
