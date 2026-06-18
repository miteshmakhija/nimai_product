# app/services/metrics_service.py
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.db import RfqRun, RunStatus


def compute(db: Session, user_id: UUID = None) -> dict:
    q = db.query(RfqRun)
    if user_id is not None:
        q = q.filter(RfqRun.submitted_by == user_id)
    runs = q.all()

    total = len(runs)
    succeeded = sum(1 for r in runs if r.status == RunStatus.done)
    failed = sum(1 for r in runs if r.status == RunStatus.failed)
    durations = [
        (r.completed_at - r.created_at).total_seconds()
        for r in runs if r.completed_at and r.status == RunStatus.done
    ]
    avg_seconds = round(sum(durations) / len(durations), 1) if durations else None

    by_day: dict = {}
    for r in runs:
        day = r.created_at.date().isoformat()
        by_day[day] = by_day.get(day, 0) + 1
    volume_by_day = [{"date": d, "count": c} for d, c in sorted(by_day.items())]

    return {
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "success_rate": round(succeeded / total, 3) if total else 0.0,
        "avg_seconds": avg_seconds,
        "volume_by_day": volume_by_day,
    }
