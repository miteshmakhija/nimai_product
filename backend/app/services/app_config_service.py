# app/services/app_config_service.py
import json
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db import AppConfig


def get_all(db: Session) -> list[AppConfig]:
    return db.query(AppConfig).order_by(AppConfig.sort_order).all()


def bulk_upsert(db: Session, items: list[dict]) -> list[AppConfig]:
    result = []
    for item in items:
        row_id = item.get("id")
        if row_id:
            try:
                parsed_id = uuid.UUID(row_id)
            except ValueError:
                raise ValueError(f"Invalid config id: '{row_id}'")
            row = db.query(AppConfig).filter(AppConfig.id == parsed_id).first()
            if row is None:
                raise ValueError(f"Config id '{row_id}' not found")
            row.label = item["label"]
            row.value = item["value"]
            row.field_type = item["field_type"]
            row.required = item["required"]
            row.enabled = item["enabled"]
            row.sort_order = item["sort_order"]
            row.updated_at = datetime.utcnow()
            result.append(row)
        else:
            row = AppConfig(
                key=item["key"],
                label=item["label"],
                value=item["value"],
                field_type=item["field_type"],
                required=item["required"],
                enabled=item["enabled"],
                sort_order=item["sort_order"],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(row)
            result.append(row)
    db.commit()
    for row in result:
        db.refresh(row)
    return result


def delete_item(db: Session, item_id: str) -> bool:
    try:
        parsed_id = uuid.UUID(item_id)
    except ValueError:
        raise ValueError(f"Invalid config id: '{item_id}'")
    row = db.query(AppConfig).filter(AppConfig.id == parsed_id).first()
    if not row:
        return False
    if row.required:
        raise ValueError(f"Cannot delete required config key '{row.key}'")
    db.delete(row)
    db.commit()
    return True


def get_company_context(db: Session) -> dict:
    rows = db.query(AppConfig).filter(AppConfig.enabled.is_(True)).order_by(AppConfig.sort_order).all()
    ctx = {}
    for row in rows:
        if row.field_type == "list":
            try:
                ctx[row.key] = json.loads(row.value) if row.value else []
            except (json.JSONDecodeError, ValueError):
                ctx[row.key] = []
        else:
            ctx[row.key] = row.value
    return ctx
