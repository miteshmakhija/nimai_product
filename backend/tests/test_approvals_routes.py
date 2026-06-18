"""Integration tests for approval workflow routes."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

import uuid
import pytest
from app.models.db import User, UserRole, RfqRun, RunStatus, InputType
from app.core.security import create_access_token


def _seed_user(db, email, role=UserRole.end_user, can_approve=False, password_hash="x"):
    u = User(id=uuid.uuid4(), email=email, full_name="T", password_hash=password_hash,
             role=role, is_active=True, can_approve=can_approve, auth_provider="local")
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _seed_run(db, user):
    run = RfqRun(id=uuid.uuid4(), submitted_by=user.id,
                 input_type=InputType.text, status=RunStatus.done)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _token(user):
    return create_access_token({"sub": str(user.id)})


def _auth(user):
    return {"Authorization": f"Bearer {_token(user)}"}


# ── submit-approval ────────────────────────────────────────────────────────────

def test_submit_approval_creates_request(client, db_session):
    submitter = _seed_user(db_session, "sub@r.com")
    approver = _seed_user(db_session, "app@r.com", can_approve=True)
    run = _seed_run(db_session, submitter)

    resp = client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "Review", "required_count": 1, "approver_ids": [str(approver.id)]}]
    }, headers=_auth(submitter))

    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "in_review"
    assert len(data["stages"]) == 1
    assert data["stages"][0]["status"] == "active"


def test_submit_approval_rejects_non_approver(client, db_session):
    submitter = _seed_user(db_session, "sub2@r.com")
    non_approver = _seed_user(db_session, "noapp@r.com", can_approve=False)
    run = _seed_run(db_session, submitter)

    resp = client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "S", "required_count": 1, "approver_ids": [str(non_approver.id)]}]
    }, headers=_auth(submitter))

    assert resp.status_code == 422


def test_submit_approval_bad_quorum(client, db_session):
    submitter = _seed_user(db_session, "sub3@r.com")
    approver = _seed_user(db_session, "app3@r.com", can_approve=True)
    run = _seed_run(db_session, submitter)

    resp = client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "S", "required_count": 5, "approver_ids": [str(approver.id)]}]
    }, headers=_auth(submitter))

    assert resp.status_code == 422


# ── queue scoping ──────────────────────────────────────────────────────────────

def test_queue_only_returns_my_pending(client, db_session):
    submitter = _seed_user(db_session, "sub4@r.com")
    a1 = _seed_user(db_session, "a1@r.com", can_approve=True)
    a2 = _seed_user(db_session, "a2@r.com", can_approve=True)
    run = _seed_run(db_session, submitter)

    client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "S", "required_count": 1, "approver_ids": [str(a1.id), str(a2.id)]}]
    }, headers=_auth(submitter))

    # a1 sees 1 item in queue
    resp = client.get("/approvals/queue", headers=_auth(a1))
    assert resp.status_code == 200
    assert len(resp.json()) == 1

    # submitter sees nothing (not an approver)
    resp2 = client.get("/approvals/queue", headers=_auth(submitter))
    assert resp2.status_code == 403


# ── decide authorization ───────────────────────────────────────────────────────

def test_non_assignee_cannot_decide(client, db_session):
    submitter = _seed_user(db_session, "sub5@r.com")
    approver = _seed_user(db_session, "app5@r.com", can_approve=True)
    intruder = _seed_user(db_session, "bad@r.com", can_approve=True)
    run = _seed_run(db_session, submitter)

    resp = client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "S", "required_count": 1, "approver_ids": [str(approver.id)]}]
    }, headers=_auth(submitter))
    assignment_id = resp.json()["stages"][0]["assignments"][0]["id"]

    # intruder tries to decide
    resp2 = client.post(f"/approvals/{assignment_id}/decide",
                        json={"decision": "approved"}, headers=_auth(intruder))
    assert resp2.status_code == 403


def test_happy_path_full_approval(client, db_session):
    submitter = _seed_user(db_session, "sub6@r.com")
    approver = _seed_user(db_session, "app6@r.com", can_approve=True)
    run = _seed_run(db_session, submitter)

    req_resp = client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "Final", "required_count": 1, "approver_ids": [str(approver.id)]}]
    }, headers=_auth(submitter))
    assert req_resp.status_code == 201

    assignment_id = req_resp.json()["stages"][0]["assignments"][0]["id"]
    decide_resp = client.post(f"/approvals/{assignment_id}/decide",
                              json={"decision": "approved", "comment": "LGTM"},
                              headers=_auth(approver))
    assert decide_resp.status_code == 200
    assert decide_resp.json()["status"] == "approved"

    # Run approval_state updated
    run_resp = client.get(f"/rfqs/{run.id}", headers=_auth(submitter))
    assert run_resp.json()["approval_state"] == "approved"


def test_resubmit_creates_new_request(client, db_session):
    submitter = _seed_user(db_session, "sub7@r.com")
    approver = _seed_user(db_session, "app7@r.com", can_approve=True)
    run = _seed_run(db_session, submitter)

    # First submission
    r1 = client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "S", "required_count": 1, "approver_ids": [str(approver.id)]}]
    }, headers=_auth(submitter))
    assert r1.status_code == 201
    req1_id = r1.json()["id"]

    # Resubmit — creates a new request, old is cancelled
    r2 = client.post(f"/rfqs/{run.id}/submit-approval", json={
        "stages": [{"name": "S2", "required_count": 1, "approver_ids": [str(approver.id)]}]
    }, headers=_auth(submitter))
    assert r2.status_code == 201
    assert r2.json()["id"] != req1_id
