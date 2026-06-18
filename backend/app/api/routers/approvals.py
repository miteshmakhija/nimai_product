# app/api/routers/approvals.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_approver
from app.models.db import ApprovalAssignment, ApprovalStage, ApprovalStageStatus, ApprovalDecision, User
from app.models.schemas import AssignmentOut, ApprovalRequestOut, StageOut, DecideRequest
from app.services import approval_service

router = APIRouter(prefix="/approvals", tags=["approvals"])


def _assignment_out(a: ApprovalAssignment) -> AssignmentOut:
    approver = a.approver  # User FK — loaded lazily
    return AssignmentOut(
        id=str(a.id),
        approver_id=str(a.approver_id),
        approver_name=approver.full_name if approver else None,
        approver_email=approver.email if approver else None,
        decision=a.decision.value,
        comment=a.comment,
        decided_at=a.decided_at.isoformat() if a.decided_at else None,
    )


def _stage_out(stage: ApprovalStage) -> StageOut:
    return StageOut(
        id=str(stage.id),
        stage_index=stage.stage_index,
        name=approval_service.effective_stage_name(stage.request, stage),
        required_count=stage.required_count,
        status=stage.status.value,
        assignments=[_assignment_out(a) for a in stage.assignments],
    )


def _request_out(req) -> ApprovalRequestOut:
    return ApprovalRequestOut(
        id=str(req.id),
        run_id=str(req.run_id),
        submitted_by=str(req.submitted_by),
        status=req.status.value,
        current_stage_index=req.current_stage_index,
        created_at=req.created_at.isoformat(),
        completed_at=req.completed_at.isoformat() if req.completed_at else None,
        stages=[_stage_out(s) for s in sorted(req.stages, key=lambda s: s.stage_index)],
    )


@router.get("/queue", response_model=list[AssignmentOut])
def my_queue(db: Session = Depends(get_db), user: User = Depends(require_approver)):
    """Assignments where I am the approver, decision is pending, and stage is active."""
    assignments = (
        db.query(ApprovalAssignment)
        .join(ApprovalAssignment.stage)
        .filter(
            ApprovalAssignment.approver_id == user.id,
            ApprovalAssignment.decision == ApprovalDecision.pending,
            ApprovalStage.status == ApprovalStageStatus.active,
        )
        .all()
    )
    return [_assignment_out(a) for a in assignments]


@router.get("/reviewed", response_model=list[AssignmentOut])
def my_reviewed(db: Session = Depends(get_db), user: User = Depends(require_approver)):
    """Assignments where I have already decided."""
    assignments = (
        db.query(ApprovalAssignment)
        .filter(
            ApprovalAssignment.approver_id == user.id,
            ApprovalAssignment.decision != ApprovalDecision.pending,
        )
        .order_by(ApprovalAssignment.decided_at.desc())
        .all()
    )
    return [_assignment_out(a) for a in assignments]


@router.post("/{assignment_id}/decide", response_model=ApprovalRequestOut)
def decide(
    assignment_id: str,
    body: DecideRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_approver),
):
    req = approval_service.record_decision(assignment_id, user, body.decision, body.comment, db)
    return _request_out(req)
