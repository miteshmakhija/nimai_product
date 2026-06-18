# app/services/prompt_service.py
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.db import Prompt, PromptVersion


def create_prompt(db: Session, key: str, name: str, content: str,
                  description: str = "", created_by: UUID = None,
                  product_name: str = None) -> Prompt:
    prompt = Prompt(key=key, name=name, description=description, product_name=product_name)
    db.add(prompt)
    db.flush()
    v1 = PromptVersion(prompt_id=prompt.id, version=1, content=content, created_by=created_by)
    db.add(v1)
    db.flush()
    prompt.active_version_id = v1.id
    db.commit()
    db.refresh(prompt)
    return prompt


def _get_prompt(db: Session, key: str, product_name: str = None):
    return (db.query(Prompt)
              .filter(Prompt.key == key, Prompt.product_name == product_name)
              .first())


def add_version(db: Session, key: str, content: str, note: str = "",
                created_by: UUID = None, product_name: str = None) -> PromptVersion:
    prompt = _get_prompt(db, key, product_name)
    if not prompt:
        raise ValueError(f"Prompt '{key}' (product={product_name}) not found")
    last = (db.query(PromptVersion)
              .filter(PromptVersion.prompt_id == prompt.id)
              .order_by(PromptVersion.version.desc()).first())
    next_version = (last.version + 1) if last else 1
    ver = PromptVersion(prompt_id=prompt.id, version=next_version, content=content,
                        note=note, created_by=created_by)
    db.add(ver)
    db.commit()
    db.refresh(ver)
    return ver


def set_active(db: Session, key: str, version_id: UUID, product_name: str = None) -> Prompt:
    prompt = _get_prompt(db, key, product_name)
    if not prompt:
        raise ValueError(f"Prompt '{key}' (product={product_name}) not found")
    prompt.active_version_id = version_id
    db.commit()
    db.refresh(prompt)
    return prompt


def get_active_content(db: Session, key: str, product_name: str = None):
    prompt = _get_prompt(db, key, product_name)
    if not prompt or not prompt.active_version_id:
        return None
    ver = db.query(PromptVersion).filter(PromptVersion.id == prompt.active_version_id).first()
    return ver.content if ver else None


def get_active_content_for(db: Session, key: str, product_name: str = None):
    """Product-specific content if it exists, else the default (product_name IS NULL)."""
    if product_name:
        content = get_active_content(db, key, product_name)
        if content is not None:
            return content
    return get_active_content(db, key, None)


def get_active_version_id(db: Session, key: str, product_name: str = None):
    prompt = _get_prompt(db, key, product_name)
    return prompt.active_version_id if prompt else None


def list_prompts(db: Session):
    return db.query(Prompt).order_by(Prompt.key, Prompt.product_name).all()


def list_versions(db: Session, key: str, product_name: str = None):
    prompt = _get_prompt(db, key, product_name)
    if not prompt:
        return []
    return (db.query(PromptVersion)
              .filter(PromptVersion.prompt_id == prompt.id)
              .order_by(PromptVersion.version.desc()).all())
