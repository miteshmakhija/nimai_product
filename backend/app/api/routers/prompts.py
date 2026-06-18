# app/api/routers/prompts.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_role
from app.models.db import UserRole, User
from app.services import prompt_service
from app.models.schemas import PromptOut, PromptVersionOut, NewVersionRequest, SetActiveRequest

router = APIRouter(prefix="/prompts", tags=["prompts"])
ManagePrompts = require_role(UserRole.admin, UserRole.super_admin)


def _ver_out(v) -> PromptVersionOut:
    return PromptVersionOut(
        id=str(v.id), version=v.version, content=v.content,
        note=v.note or "", created_at=v.created_at.isoformat(),
    )


def _prompt_out(p) -> PromptOut:
    return PromptOut(
        id=str(p.id), key=p.key, product_name=p.product_name, name=p.name,
        description=p.description or "",
        active_version_id=str(p.active_version_id) if p.active_version_id else None,
    )


@router.get("", response_model=list[PromptOut])
def list_prompts(db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    return [_prompt_out(p) for p in prompt_service.list_prompts(db)]


@router.get("/{key}/versions", response_model=list[PromptVersionOut])
def list_versions(key: str, product_name: Optional[str] = Query(None),
                  db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    return [_ver_out(v) for v in prompt_service.list_versions(db, key, product_name)]


@router.post("/{key}/versions", response_model=PromptVersionOut, status_code=201)
def add_version(key: str, body: NewVersionRequest,
                product_name: Optional[str] = Query(None),
                db: Session = Depends(get_db), user: User = Depends(ManagePrompts)):
    # Create the (key, product_name) prompt on first save if it doesn't exist yet.
    if prompt_service._get_prompt(db, key, product_name) is None:
        name = f"Generation Prompt — {product_name}" if product_name else "Generation Prompt"
        new_prompt = prompt_service.create_prompt(
            db, key=key, name=name, content=body.content,
            description=body.note or "", created_by=user.id,
            product_name=product_name,
        )
        versions = prompt_service.list_versions(db, key, product_name)
        return _ver_out(versions[0])
    try:
        v = prompt_service.add_version(db, key, body.content, body.note,
                                       created_by=user.id, product_name=product_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _ver_out(v)


@router.post("/{key}/activate", response_model=PromptOut)
def activate(key: str, body: SetActiveRequest,
             product_name: Optional[str] = Query(None),
             db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    try:
        p = prompt_service.set_active(db, key, UUID(body.version_id), product_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _prompt_out(p)
