# app/services/auth_service.py
from sqlalchemy.orm import Session
from app.models.db import User, UserRole
from app.core import security


def authenticate(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return None
    if not security.verify_password(password, user.password_hash):
        return None
    return user


def create_user(db: Session, email: str, password: str, full_name: str = "",
                role: UserRole = UserRole.end_user) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=security.hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def tokens_for_user(user: User) -> dict:
    claims = {"sub": str(user.id), "role": user.role.value, "email": user.email}
    return {
        "access_token": security.create_access_token(claims),
        "refresh_token": security.create_refresh_token({"sub": str(user.id)}),
        "token_type": "bearer",
    }


def seed_super_admin(db: Session, email: str, password: str):
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing
    return create_user(db, email, password, full_name="Super Admin", role=UserRole.super_admin)


def _upsert_user(db: Session, email: str, password: str, full_name: str,
                 role: UserRole, can_approve: bool = False) -> User:
    """Create the user if they don't exist; update can_approve if they do."""
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.can_approve = can_approve
        user.password_hash = security.hash_password(password)
        db.commit()
        return user
    user = User(
        email=email,
        full_name=full_name,
        password_hash=security.hash_password(password),
        role=role,
        can_approve=can_approve,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


TEST_USERS = [
    # (email, password, full_name, role, can_approve)
    ("admin@nimai.ai",          "password!123",  "Super Admin",        UserRole.super_admin, True),
    ("alice.finance@nimai.ai",  "Test@1234",     "Alice Finance",      UserRole.admin,       True),
    ("bob.engineering@nimai.ai","Test@1234",     "Bob Engineering",    UserRole.admin,       True),
    ("carol.director@nimai.ai", "Test@1234",     "Carol Director",     UserRole.admin,       True),
    ("dave.sales@nimai.ai",     "Test@1234",     "Dave Sales",         UserRole.end_user,    True),
    ("eve.procurement@nimai.ai","Test@1234",     "Eve Procurement",    UserRole.end_user,    True),
    ("frank.viewer@nimai.ai",   "Test@1234",     "Frank Viewer",       UserRole.end_user,    False),
    ("grace.submitter@nimai.ai","Test@1234",     "Grace Submitter",    UserRole.end_user,    False),
]


def seed_test_users(db: Session) -> None:
    """Idempotent — safe to call on every startup. Creates/updates test accounts."""
    for email, password, full_name, role, can_approve in TEST_USERS:
        _upsert_user(db, email, password, full_name, role, can_approve)


DEFAULT_APP_CONFIG = [
    # (key, label, value, field_type, required, sort_order)
    ("company_name",        "Company Name",          "",   "text",     True,  0),
    ("company_address",     "Company Address",       "",   "textarea", True,  1),
    ("phone",               "Phone",                 "",   "text",     False, 2),
    ("email",               "Email",                 "",   "text",     False, 3),
    ("certifications",      "Certifications",        "[]", "list",     False, 4),
    ("city_state",          "City & State",          "",   "text",     False, 5),
    ("certification_asme",  "ASME Certification",    "CERTIFIED COMPANY BY THE AMERICAN SOCIETY OF MECHANICAL ENGINEERS (ASME U STAMP)", "text", False, 6),
    ("certification_iso",   "ISO Certification",     "ISO 9001:2015 CERTIFIED COMPANY BY TUV NORD GERMANY", "text", False, 7),
]


def seed_app_config(db: Session) -> None:
    """Idempotent — inserts only keys that don't already exist."""
    from app.models.db import AppConfig
    from datetime import datetime
    for key, label, value, field_type, required, sort_order in DEFAULT_APP_CONFIG:
        if db.query(AppConfig).filter(AppConfig.key == key).first():
            continue
        row = AppConfig(
            key=key,
            label=label,
            value=value,
            field_type=field_type,
            required=required,
            enabled=True,
            sort_order=sort_order,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(row)
    db.commit()
