"""Unit tests for the approval workflow engine."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import uuid
import pytest
from app.models.db import (
    User, UserRole, RfqRun, RunStatus, InputType, ApprovalState,
    ApprovalRequestStatus, ApprovalStageStatus, ApprovalDecision,
)
from app.models.schemas import ApprovalStageIn
from app.services import approval_service


def _make_user(db, email="approver@test.com", can_approve=True, role=UserRole.end_user):
    u = User(
        id=uuid.uuid4(), email=email, full_name="Test", password_hash="x",
        role=role, is_active=True, can_approve=can_approve, auth_provider="local",
    )
    db.add(u)
    db.flush()
    return u


def _make_run(db, submitter_id):
    run = RfqRun(
        id=uuid.uuid4(),
        submitted_by=submitter_id,
        input_type=InputType.text,
        status=RunStatus.done,
    )
    db.add(run)
    db.flush()
    return run


def _make_request(db, run, submitter_id, approvers, required_count=1):
    stages = [ApprovalStageIn(name="Stage 1", required_count=required_count,
                              approver_ids=[str(a.id) for a in approvers])]
    return approval_service.create_request(run, str(submitter_id), stages, db)


# ── create_request ─────────────────────────────────────────────────────────────

def test_create_request_activates_stage_0(db_session):
    submitter = _make_user(db_session, "sub@t.com", can_approve=False)
    approver = _make_user(db_session, "app@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)

    req = _make_request(db_session, run, submitter.id, [approver])

    assert req.status == ApprovalRequestStatus.in_review
    assert len(req.stages) == 1
    assert req.stages[0].status == ApprovalStageStatus.active
    assert run.approval_state == ApprovalState.in_review


def test_create_request_rejects_non_done_run(db_session):
    from fastapi import HTTPException
    submitter = _make_user(db_session, "sub2@t.com", can_approve=False)
    run = _make_run(db_session, submitter.id)
    run.status = RunStatus.generating
    db_session.flush()
    approver = _make_user(db_session, "app2@t.com", can_approve=True)

    with pytest.raises(HTTPException, match="done"):
        approval_service.create_request(run, str(submitter.id),
                                        [ApprovalStageIn(name="S", required_count=1,
                                                         approver_ids=[str(approver.id)])],
                                        db_session)


def test_create_request_rejects_bad_quorum(db_session):
    from fastapi import HTTPException
    submitter = _make_user(db_session, "sub3@t.com", can_approve=False)
    approver = _make_user(db_session, "app3@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)

    with pytest.raises(HTTPException):
        approval_service.create_request(run, str(submitter.id),
                                        [ApprovalStageIn(name="S", required_count=5,
                                                         approver_ids=[str(approver.id)])],
                                        db_session)


# ── approve / quorum ───────────────────────────────────────────────────────────

def test_single_approver_approve_finalizes(db_session):
    submitter = _make_user(db_session, "sub4@t.com", can_approve=False)
    approver = _make_user(db_session, "app4@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)
    req = _make_request(db_session, run, submitter.id, [approver])

    assignment_id = str(req.stages[0].assignments[0].id)
    req = approval_service.record_decision(assignment_id, approver, "approved", None, db_session)

    assert req.status == ApprovalRequestStatus.approved
    assert run.approval_state == ApprovalState.approved


def test_quorum_partial_vote_does_not_advance(db_session):
    submitter = _make_user(db_session, "sub5@t.com", can_approve=False)
    a1 = _make_user(db_session, "a1@t.com", can_approve=True)
    a2 = _make_user(db_session, "a2@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)

    stages = [ApprovalStageIn(name="S", required_count=2, approver_ids=[str(a1.id), str(a2.id)])]
    req = approval_service.create_request(run, str(submitter.id), stages, db_session)

    # Only a1 votes — quorum not met
    aid = str(next(a for a in req.stages[0].assignments if a.approver_id == a1.id).id)
    req = approval_service.record_decision(aid, a1, "approved", None, db_session)

    assert req.status == ApprovalRequestStatus.in_review
    assert req.stages[0].status == ApprovalStageStatus.active


def test_quorum_met_advances_to_next_stage(db_session):
    submitter = _make_user(db_session, "sub6@t.com", can_approve=False)
    a1 = _make_user(db_session, "b1@t.com", can_approve=True)
    a2 = _make_user(db_session, "b2@t.com", can_approve=True)
    a3 = _make_user(db_session, "b3@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)

    stages = [
        ApprovalStageIn(name="Stage1", required_count=2, approver_ids=[str(a1.id), str(a2.id)]),
        ApprovalStageIn(name="Stage2", required_count=1, approver_ids=[str(a3.id)]),
    ]
    req = approval_service.create_request(run, str(submitter.id), stages, db_session)

    # Both a1 and a2 approve stage 0
    for a in [a1, a2]:
        aid = str(next(x for x in req.stages[0].assignments if x.approver_id == a.id).id)
        req = approval_service.record_decision(aid, a, "approved", None, db_session)

    # Stage 0 approved; stage 1 now active
    assert req.stages[0].status == ApprovalStageStatus.approved
    assert req.stages[1].status == ApprovalStageStatus.active
    assert req.current_stage_index == 1
    assert req.status == ApprovalRequestStatus.in_review


# ── reject / bounce ────────────────────────────────────────────────────────────

def test_stage0_reject_ends_as_changes_requested(db_session):
    submitter = _make_user(db_session, "sub7@t.com", can_approve=False)
    approver = _make_user(db_session, "app7@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)
    req = _make_request(db_session, run, submitter.id, [approver])

    aid = str(req.stages[0].assignments[0].id)
    req = approval_service.record_decision(aid, approver, "rejected", "Bad terms", db_session)

    assert req.status == ApprovalRequestStatus.rejected
    assert run.approval_state == ApprovalState.changes_requested


def test_stage1_reject_bounces_back_to_stage0(db_session):
    submitter = _make_user(db_session, "sub8@t.com", can_approve=False)
    a1 = _make_user(db_session, "c1@t.com", can_approve=True)
    a2 = _make_user(db_session, "c2@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)

    stages = [
        ApprovalStageIn(name="S0", required_count=1, approver_ids=[str(a1.id)]),
        ApprovalStageIn(name="S1", required_count=1, approver_ids=[str(a2.id)]),
    ]
    req = approval_service.create_request(run, str(submitter.id), stages, db_session)

    # Advance stage 0
    aid0 = str(req.stages[0].assignments[0].id)
    req = approval_service.record_decision(aid0, a1, "approved", None, db_session)
    assert req.current_stage_index == 1

    # Reject stage 1 — should bounce back to stage 0
    aid1 = str(req.stages[1].assignments[0].id)
    req = approval_service.record_decision(aid1, a2, "rejected", "Nope", db_session)

    assert req.current_stage_index == 0
    assert req.stages[0].status == ApprovalStageStatus.active
    # Stage 0 assignments reset to pending
    assert all(a.decision == ApprovalDecision.pending for a in req.stages[0].assignments)
    assert req.status == ApprovalRequestStatus.in_review
    assert run.approval_state == ApprovalState.in_review


def test_already_decided_raises_409(db_session):
    from fastapi import HTTPException
    submitter = _make_user(db_session, "sub9@t.com", can_approve=False)
    approver = _make_user(db_session, "app9@t.com", can_approve=True)
    run = _make_run(db_session, submitter.id)
    req = _make_request(db_session, run, submitter.id, [approver])

    aid = str(req.stages[0].assignments[0].id)
    approval_service.record_decision(aid, approver, "approved", None, db_session)

    with pytest.raises(HTTPException) as exc:
        approval_service.record_decision(aid, approver, "approved", None, db_session)
    assert exc.value.status_code == 409
