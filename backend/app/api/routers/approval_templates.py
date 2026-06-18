# app/api/routers/approval_templates.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user, require_role
from app.models.db import User, UserRole, ApprovalTemplate
from app.models.schemas import ApprovalTemplateIn, ApprovalTemplateOut

router = APIRouter(prefix="/approval-templates", tags=["approval-templates"])
_admin_dep = require_role(UserRole.admin, UserRole.super_admin)


def _out(t: ApprovalTemplate) -> ApprovalTemplateOut:
    return ApprovalTemplateOut(
        id=str(t.id),
        name=t.name,
        description=t.description,
        stages=t.stages or [],
        is_active=t.is_active,
        created_by=str(t.created_by) if t.created_by else None,
        created_at=t.created_at.isoformat(),
        updated_at=t.updated_at.isoformat(),
    )


@router.get("", response_model=list[ApprovalTemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """All active templates — available to any authenticated user so RunDetail can fetch them."""
    rows = (
        db.query(ApprovalTemplate)
        .filter(ApprovalTemplate.is_active == True)
        .order_by(ApprovalTemplate.name)
        .all()
    )
    return [_out(r) for r in rows]


@router.get("/all", response_model=list[ApprovalTemplateOut])
def list_all_templates(
    db: Session = Depends(get_db),
    _: User = Depends(_admin_dep),
):
    """All templates including inactive — admin only."""
    rows = db.query(ApprovalTemplate).order_by(ApprovalTemplate.name).all()
    return [_out(r) for r in rows]


@router.post("", response_model=ApprovalTemplateOut, status_code=201)
def create_template(
    body: ApprovalTemplateIn,
    db: Session = Depends(get_db),
    user: User = Depends(_admin_dep),
):
    t = ApprovalTemplate(
        name=body.name,
        description=body.description,
        stages=[s.model_dump() for s in body.stages],
        is_active=body.is_active,
        created_by=user.id,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _out(t)


@router.put("/{template_id}", response_model=ApprovalTemplateOut)
def update_template(
    template_id: str,
    body: ApprovalTemplateIn,
    db: Session = Depends(get_db),
    _: User = Depends(_admin_dep),
):
    t = db.query(ApprovalTemplate).filter(ApprovalTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    t.name = body.name
    t.description = body.description
    t.stages = [s.model_dump() for s in body.stages]
    t.is_active = body.is_active
    db.commit()
    db.refresh(t)
    return _out(t)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(_admin_dep),
):
    t = db.query(ApprovalTemplate).filter(ApprovalTemplate.id == template_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
