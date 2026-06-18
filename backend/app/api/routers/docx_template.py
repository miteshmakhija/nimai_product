import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_role
from app.models.db import User, UserRole
from app.services.docx_template_service import get_active_template, save_template, deactivate_template

router = APIRouter(prefix="/docx-template", tags=["docx-template"])

_admin = require_role(UserRole.admin, UserRole.super_admin)


@router.post("")
async def upload_template(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(_admin),
):
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(status_code=400, detail="Must upload a .docx file")
    blob = await file.read()
    try:
        from docxtpl import DocxTemplate
        DocxTemplate(io.BytesIO(blob))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid .docx file: {e}")
    record = save_template(db, blob=blob, name=file.filename, user_id=user.id)
    return {"name": record.name, "uploaded_at": record.uploaded_at.isoformat(), "active": True}


@router.get("")
def get_template_info(
    db: Session = Depends(get_db),
    user: User = Depends(_admin),
):
    active = get_active_template(db)
    if not active:
        return {"active": False}
    return {
        "active": True,
        "name": active.name,
        "uploaded_at": active.uploaded_at.isoformat(),
        "uploaded_by": str(active.uploaded_by),
    }


@router.delete("")
def remove_template(
    db: Session = Depends(get_db),
    user: User = Depends(_admin),
):
    deactivate_template(db)
    return {"active": False}
