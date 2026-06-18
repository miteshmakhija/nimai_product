# app/services/rfq_service.py
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db import RfqRun, RfqDataPoint, RunStatus, InputType


def create_run(db: Session, submitted_by: UUID, input_type: InputType,
               source_filename: str = None, source_text: str = None,
               prompt_version_id: UUID = None) -> RfqRun:
    run = RfqRun(
        submitted_by=submitted_by,
        input_type=input_type,
        source_filename=source_filename,
        source_text=source_text,
        prompt_version_id=prompt_version_id,
        status=RunStatus.queued,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def set_task_id(db: Session, run_id: UUID, task_id: str) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.task_id = task_id
        db.commit()


def set_status(db: Session, run_id: UUID, status: RunStatus) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.status = status
        db.commit()


def complete_run(db: Session, run_id: UUID, result_json: dict) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.status = RunStatus.done
        run.result_json = result_json
        run.completed_at = datetime.utcnow()
        db.commit()


def fail_run(db: Session, run_id: UUID, error: str) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.status = RunStatus.failed
        run.error = error
        run.completed_at = datetime.utcnow()
        db.commit()


def get_run(db: Session, run_id: UUID):
    return db.query(RfqRun).filter(RfqRun.id == run_id).first()


def list_runs(db: Session, user_id: UUID = None):
    q = db.query(RfqRun).order_by(RfqRun.created_at.desc())
    if user_id is not None:
        q = q.filter(RfqRun.submitted_by == user_id)
    return q.all()


def save_metadata(db: Session, run_id: UUID, meta: dict) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.meta_company_name = meta.get("meta_company_name")
        run.meta_product = meta.get("meta_product")
        run.meta_rfq_date = meta.get("meta_rfq_date")
        run.meta_rfq_number = meta.get("meta_rfq_number")
        db.commit()


def set_confirmed(db: Session, run_id: UUID) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.meta_confirmed = True
        db.commit()


def save_data_points(db: Session, run_id: UUID, data_points: list) -> None:
    """Bulk-upsert data points. Replaces all existing rows for this run."""
    db.query(RfqDataPoint).filter(RfqDataPoint.run_id == run_id).delete()
    for dp in data_points:
        row = RfqDataPoint(
            run_id=run_id,
            field_key=dp["key"],
            field_label=dp.get("label"),
            value=dp.get("value"),
            source=dp.get("source", "extracted"),
        )
        db.add(row)
    db.commit()


def set_data_confirmed(db: Session, run_id: UUID) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.data_confirmed = True
        db.commit()


def save_content(db: Session, run_id: UUID, content: str) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.edited_content = content
        db.commit()


def get_data_points(db: Session, run_id: UUID) -> list:
    return db.query(RfqDataPoint).filter(RfqDataPoint.run_id == run_id).all()


def save_extracted_json(db: Session, run_id: UUID, extracted: dict) -> None:
    """Cache full structured extraction in result_json with a marker so the worker can skip re-extraction."""
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.result_json = {**extracted, "_extraction_only": True}
        db.commit()


def save_similar_ids(db: Session, run_id: UUID, ids: list) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.similar_run_ids = ids
        db.commit()
