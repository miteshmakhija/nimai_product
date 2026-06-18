# app/services/approval_service.py
"""Approval workflow engine.

create_request  — build an ApprovalRequest with ordered stages + assignments.
record_decision — record an approver's vote and advance/bounce the workflow.
get_active_request — latest non-cancelled request for a run.
"""
import uuid
from datetime import datetime
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.db import (
    RfqRun, RunStatus, ApprovalState,
    ApprovalRequest, ApprovalRequestStatus,
    ApprovalStage, ApprovalStageStatus,
    ApprovalAssignment, ApprovalDecision,
    User,
)
from app.models.schemas import ApprovalStageIn


def _now() -> datetime:
    return datetime.utcnow()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _approved_count(stage: ApprovalStage) -> int:
    return sum(1 for a in stage.assignments if a.decision == ApprovalDecision.approved)


def _activate_stage(stage: ApprovalStage) -> None:
    stage.status = ApprovalStageStatus.active
    for a in stage.assignments:
        a.decision = ApprovalDecision.pending
        a.comment = None
        a.decided_at = None


def effective_stage_name(req, stage) -> str:
    """Live stage name from the linked template (by stage_index) if available,
    else the snapshot name stored on the stage at submit time."""
    tmpl = getattr(req, "template", None)
    tmpl_stages = getattr(tmpl, "stages", None) if tmpl else None
    if tmpl_stages and 0 <= stage.stage_index < len(tmpl_stages):
        t = tmpl_stages[stage.stage_index]
        nm = (t.get("name") if isinstance(t, dict) else None) or ""
        if nm.strip():
            return nm
    return stage.name


# ── Public API ─────────────────────────────────────────────────────────────────

def get_active_request(run_id: str, db: Session):
    """Return the latest non-cancelled approval request for a run, or None."""
    return (
        db.query(ApprovalRequest)
        .filter(
            ApprovalRequest.run_id == run_id,
            ApprovalRequest.status != ApprovalRequestStatus.cancelled,
        )
        .order_by(ApprovalRequest.created_at.desc())
        .first()
    )


def create_request(run: RfqRun, submitted_by: str, stages_in: List[ApprovalStageIn], db: Session, template_id: str | None = None) -> ApprovalRequest:
    if run.status != RunStatus.done:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Run must be in 'done' status to submit for approval")

    # Validate each stage
    for i, s in enumerate(stages_in):
        if not s.approver_ids:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Stage {i} has no approvers")
        if s.required_count < 1 or s.required_count > len(s.approver_ids):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"Stage {i}: required_count must be between 1 and {len(s.approver_ids)}",
            )
        # Verify all approvers exist and are eligible
        for aid in s.approver_ids:
            approver = db.query(User).filter(User.id == uuid.UUID(aid)).first()
            if not approver:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"User {aid} not found")
            if not approver.can_approve and approver.role.value not in ("admin", "super_admin"):
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    f"User {aid} is not an approver",
                )

    # Cancel any existing in-review request
    existing = get_active_request(str(run.id), db)
    if existing and existing.status == ApprovalRequestStatus.in_review:
        existing.status = ApprovalRequestStatus.cancelled

    # Build request
    req = ApprovalRequest(
        id=uuid.uuid4(),
        run_id=run.id,
        submitted_by=uuid.UUID(submitted_by),
        status=ApprovalRequestStatus.in_review,
        current_stage_index=0,
        template_id=uuid.UUID(template_id) if template_id else None,
        created_at=_now(),
    )
    db.add(req)
    db.flush()  # get req.id

    for i, s_in in enumerate(stages_in):
        stage = ApprovalStage(
            id=uuid.uuid4(),
            request_id=req.id,
            stage_index=i,
            name=s_in.name or f"Stage {i + 1}",
            required_count=s_in.required_count,
            status=ApprovalStageStatus.active if i == 0 else ApprovalStageStatus.pending,
        )
        db.add(stage)
        db.flush()

        for aid in s_in.approver_ids:
            db.add(ApprovalAssignment(
                id=uuid.uuid4(),
                stage_id=stage.id,
                approver_id=uuid.UUID(aid),
                decision=ApprovalDecision.pending,
            ))

    run.approval_state = ApprovalState.in_review
    db.commit()
    db.refresh(req)
    return req


def record_decision(assignment_id: str, caller: User, decision_str: str, comment: str | None, db: Session) -> ApprovalRequest:
    assignment = db.query(ApprovalAssignment).filter(
        ApprovalAssignment.id == uuid.UUID(assignment_id)
    ).first()
    if not assignment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    if str(assignment.approver_id) != str(caller.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your assignment")
    if assignment.decision != ApprovalDecision.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already decided")

    stage = assignment.stage
    if stage.status != ApprovalStageStatus.active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Stage is not active")

    req = stage.request
    run = req.run

    # Record the vote
    try:
        decision = ApprovalDecision(decision_str)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "decision must be 'approved' or 'rejected'")

    assignment.decision = decision
    assignment.comment = comment
    assignment.decided_at = _now()

    if decision == ApprovalDecision.approved:
        # Check quorum
        if _approved_count(stage) >= stage.required_count:
            stage.status = ApprovalStageStatus.approved
            # Find next stage
            next_stages = [s for s in req.stages if s.stage_index == stage.stage_index + 1]
            if next_stages:
                next_stage = next_stages[0]
                next_stage.status = ApprovalStageStatus.active
                req.current_stage_index = next_stage.stage_index
            else:
                # Last stage passed — request fully approved
                req.status = ApprovalRequestStatus.approved
                req.completed_at = _now()
                run.approval_state = ApprovalState.approved

    else:  # rejected
        stage.status = ApprovalStageStatus.rejected
        if req.current_stage_index > 0:
            # Bounce back to previous stage: reset it so approvers re-vote
            prev_stages = [s for s in req.stages if s.stage_index == stage.stage_index - 1]
            if prev_stages:
                prev_stage = prev_stages[0]
                _activate_stage(prev_stage)
                req.current_stage_index = prev_stage.stage_index
                # Also reset current stage to pending for potential future re-entry
                stage.status = ApprovalStageStatus.pending
        else:
            # Stage 0 rejection — back to submitter
            req.status = ApprovalRequestStatus.rejected
            req.completed_at = _now()
            run.approval_state = ApprovalState.changes_requested

    db.commit()
    db.refresh(req)
    return req
