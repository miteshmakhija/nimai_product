# app/services/product_service.py
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db import ProductRequiredFields


def get_product_fields(db: Session, product_name: str) -> ProductRequiredFields | None:
    return db.query(ProductRequiredFields).filter(
        ProductRequiredFields.product_name == product_name
    ).first()


def upsert_product_fields(db: Session, product_name: str, fields: list) -> ProductRequiredFields:
    existing = get_product_fields(db, product_name)
    if existing:
        existing.fields = fields
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    row = ProductRequiredFields(product_name=product_name, fields=fields)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_products(db: Session) -> list[ProductRequiredFields]:
    return db.query(ProductRequiredFields).order_by(ProductRequiredFields.product_name).all()


def delete_product(db: Session, product_name: str) -> None:
    db.query(ProductRequiredFields).filter(
        ProductRequiredFields.product_name == product_name
    ).delete()
    db.commit()
