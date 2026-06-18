# app/api/routers/metrics.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.db import User, UserRole
from app.services import metrics_service
from app.models.schemas import MetricsOut

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("", response_model=MetricsOut)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scope = None if user.role in (UserRole.admin, UserRole.super_admin) else user.id
    return metrics_service.compute(db, scope)
