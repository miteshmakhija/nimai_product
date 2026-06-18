from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db import DocxTemplateRecord
import uuid


def get_active_template(db: Session) -> DocxTemplateRecord | None:
    return db.query(DocxTemplateRecord).filter_by(is_active=True).first()


def save_template(db: Session, blob: bytes, name: str, user_id) -> DocxTemplateRecord:
    db.query(DocxTemplateRecord).filter_by(is_active=True).update({"is_active": False})
    record = DocxTemplateRecord(
        id=uuid.uuid4(),
        name=name,
        template_blob=blob,
        uploaded_by=user_id,
        uploaded_at=datetime.utcnow(),
        is_active=True,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def deactivate_template(db: Session) -> None:
    db.query(DocxTemplateRecord).filter_by(is_active=True).update({"is_active": False})
    db.commit()
