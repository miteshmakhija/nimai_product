# app/api/routers/products.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user, require_role
from app.models.db import User, UserRole
from app.services import product_service
from app.models.schemas import ProductFieldsIn, ProductFieldsOut

router = APIRouter(prefix="/products", tags=["products"])
_admin_dep = require_role(UserRole.admin, UserRole.super_admin)


@router.get("", response_model=list[ProductFieldsOut])
def list_products(
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    rows = product_service.list_products(db)
    return [_out(r) for r in rows]


@router.get("/{product_name}", response_model=ProductFieldsOut)
def get_product(
    product_name: str,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    row = product_service.get_product_fields(db, product_name)
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return _out(row)


@router.put("/{product_name}", response_model=ProductFieldsOut)
def upsert_product(
    product_name: str,
    body: ProductFieldsIn,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    row = product_service.upsert_product_fields(
        db, product_name, [f.model_dump() for f in body.fields]
    )
    return _out(row)


@router.delete("/{product_name}", status_code=204)
def delete_product(
    product_name: str,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    if not product_service.get_product_fields(db, product_name):
        raise HTTPException(status_code=404, detail="Product not found")
    product_service.delete_product(db, product_name)


def _out(row) -> ProductFieldsOut:
    return ProductFieldsOut(
        id=str(row.id),
        product_name=row.product_name,
        fields=row.fields,
        created_at=row.created_at.isoformat(),
        updated_at=row.updated_at.isoformat(),
    )
