# app/api/routers/app_config.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_role
from app.models.db import User, UserRole
from app.services import app_config_service
from app.models.schemas import AppConfigItem, AppConfigIn

router = APIRouter(prefix="/app-config", tags=["app-config"])
_admin_dep = require_role(UserRole.admin, UserRole.super_admin)


@router.get("", response_model=list[AppConfigItem])
def list_config(
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    rows = app_config_service.get_all(db)
    return [_out(r) for r in rows]


@router.put("", response_model=list[AppConfigItem])
def save_config(
    body: AppConfigIn,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    rows = app_config_service.bulk_upsert(db, [item.model_dump() for item in body.items])
    return [_out(r) for r in rows]


@router.delete("/{item_id}", status_code=204)
def delete_config_item(
    item_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    try:
        found = app_config_service.delete_item(db, item_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if not found:
        raise HTTPException(status_code=404, detail="Config item not found")


def _out(row) -> AppConfigItem:
    return AppConfigItem(
        id=str(row.id),
        key=row.key,
        label=row.label,
        value=row.value,
        field_type=row.field_type,
        required=row.required,
        enabled=row.enabled,
        sort_order=row.sort_order,
    )
