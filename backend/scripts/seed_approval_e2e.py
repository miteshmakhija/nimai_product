"""Seed a deterministic approval request for the live Playwright E2E test.

Creates (idempotently) a single `done` RFQ run submitted by Grace, with a
one-stage approval request assigned to Alice Finance. Re-running first removes
the previous E2E run (cascade drops its approval request) so the queue is clean.

Run from the backend/ dir with the venv python:
    .venv\\Scripts\\python.exe scripts\\seed_approval_e2e.py

Prints the created run id and Alice's pending assignment id as JSON.
"""
import json
import sys
import uuid
from pathlib import Path

# Allow running as a plain script: ensure backend/ (the package root) is on path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import SessionLocal
from app.models.db import (
    RfqRun, RunStatus, InputType, ApprovalState, User, ApprovalRequest,
)
from app.models.schemas import ApprovalStageIn
from app.services import approval_service

MARKER = "E2E-APPROVAL"
SUBMITTER_EMAIL = "grace.submitter@nimai.ai"
APPROVER_EMAIL = "alice.finance@nimai.ai"


def main() -> int:
    db = SessionLocal()
    try:
        grace = db.query(User).filter(User.email == SUBMITTER_EMAIL).first()
        alice = db.query(User).filter(User.email == APPROVER_EMAIL).first()
        if not grace or not alice:
            print(
                json.dumps({
                    "error": "Seed users missing. Start backend once so "
                             "seed_test_users runs.",
                }),
                file=sys.stderr,
            )
            return 1

        # Remove prior E2E runs (cascade removes their approval requests).
        old = db.query(RfqRun).filter(RfqRun.meta_rfq_number == MARKER).all()
        for run in old:
            db.delete(run)
        db.commit()

        run = RfqRun(
            id=uuid.uuid4(),
            submitted_by=grace.id,
            input_type=InputType.text,
            source_text="E2E approval fixture — pump assembly RFQ.",
            status=RunStatus.done,
            result_json={"quote": {"total": 12345, "currency": "USD"}},
            meta_company_name="Acme Pumps Ltd",
            meta_product="Centrifugal Pump CP-200",
            meta_rfq_number=MARKER,
            meta_confirmed=True,
            data_confirmed=True,
            approval_state=ApprovalState.none,
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        req = approval_service.create_request(
            run,
            str(grace.id),
            [ApprovalStageIn(
                name="Finance Sign-off",
                required_count=1,
                approver_ids=[str(alice.id)],
            )],
            db,
        )

        # Find Alice's assignment id in stage 0.
        stage0 = next(s for s in req.stages if s.stage_index == 0)
        assignment = next(
            a for a in stage0.assignments if str(a.approver_id) == str(alice.id)
        )

        print(json.dumps({
            "run_id": str(run.id),
            "request_id": str(req.id),
            "assignment_id": str(assignment.id),
            "approver_email": APPROVER_EMAIL,
        }))
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
