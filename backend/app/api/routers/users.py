# app/api/routers/users.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_role, get_current_user
from app.services import auth_service
from app.models.db import User, UserRole
from app.models.schemas import UserOut, CreateUserRequest, UpdateUserRequest, ApproverOut

router = APIRouter(prefix="/users", tags=["users"])
SuperAdmin = require_role(UserRole.super_admin)


def _out(u: User) -> UserOut:
    return UserOut(
        id=str(u.id),
        email=u.email,
        full_name=u.full_name,
        role=u.role.value,
        is_active=u.is_active,
        auth_provider=u.auth_provider or "local",
        can_approve=u.can_approve or False,
    )


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(SuperAdmin)):
    return [_out(u) for u in db.query(User).order_by(User.email).all()]


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: CreateUserRequest, db: Session = Depends(get_db),
                _: User = Depends(SuperAdmin)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    u = auth_service.create_user(db, body.email, body.password, body.full_name,
                                 UserRole(body.role))
    if body.auth_provider != "local":
        u.auth_provider = body.auth_provider
    if body.external_id:
        u.external_id = body.external_id
    if body.can_approve:
        u.can_approve = True
    db.commit()
    db.refresh(u)
    return _out(u)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: UUID, body: UpdateUserRequest, db: Session = Depends(get_db),
                _: User = Depends(SuperAdmin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None:
        u.full_name = body.full_name
    if body.role is not None:
        u.role = UserRole(body.role)
    if body.is_active is not None:
        u.is_active = body.is_active
    if body.can_approve is not None:
        u.can_approve = body.can_approve
    if body.auth_provider is not None:
        u.auth_provider = body.auth_provider
    db.commit()
    db.refresh(u)
    return _out(u)


@router.get("/approvers", response_model=list[ApproverOut])
def list_approvers(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """All users eligible to be assigned as approvers."""
    users = (
        db.query(User)
        .filter(
            User.is_active == True,
            (User.can_approve == True) | (User.role.in_([UserRole.admin, UserRole.super_admin]))
        )
        .order_by(User.full_name)
        .all()
    )
    return [ApproverOut(id=str(u.id), email=u.email, full_name=u.full_name) for u in users]
