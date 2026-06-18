# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.core.config import get_settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    s = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=s.access_token_ttl_minutes))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_refresh_token(data: dict) -> str:
    s = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=s.refresh_token_ttl_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as e:
        raise TokenError(str(e))


# ── FastAPI dependencies ──────────────────────────────────────────────────────

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.db import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = decode_token(token)
    except TokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found/inactive")
    return user


def require_role(*roles: UserRole):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return _dep


def require_approver(user: User = Depends(get_current_user)) -> User:
    """Allow users with can_approve flag OR admin/super_admin role."""
    if user.can_approve or user.role in (UserRole.admin, UserRole.super_admin):
        return user
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not an approver")
