"""Tests for the new rfq_service helpers."""
import uuid
from app.services import rfq_service
from app.models.db import InputType


def _make_run(db):
    user_id = uuid.uuid4()
    from app.models.db import User, UserRole
    user = User(id=user_id, email=f"{user_id}@test.com", full_name="T", password_hash="x",
                role=UserRole.end_user)
    db.add(user)
    db.commit()
    return rfq_service.create_run(db, submitted_by=user_id, input_type=InputType.text,
                                  source_text="test rfq text")


def test_save_metadata(db_session):
    run = _make_run(db_session)
    rfq_service.save_metadata(db_session, run.id, {
        "meta_company_name": "Acme Corp",
        "meta_product": "Centrifugal Pump",
        "meta_rfq_date": "2026-01-01",
        "meta_rfq_number": "RFQ-001",
    })
    db_session.refresh(run)
    assert run.meta_company_name == "Acme Corp"
    assert run.meta_product == "Centrifugal Pump"
    assert run.meta_rfq_date == "2026-01-01"
    assert run.meta_rfq_number == "RFQ-001"


def test_set_confirmed(db_session):
    run = _make_run(db_session)
    assert run.meta_confirmed is False
    rfq_service.set_confirmed(db_session, run.id)
    db_session.refresh(run)
    assert run.meta_confirmed is True


def test_save_data_points(db_session):
    run = _make_run(db_session)
    rfq_service.save_data_points(db_session, run.id, [
        {"key": "pressure", "label": "Operating Pressure", "value": "10 bar", "source": "extracted"},
        {"key": "flow_rate", "label": "Flow Rate", "value": None, "source": "extracted"},
    ])
    dps = rfq_service.get_data_points(db_session, run.id)
    assert len(dps) == 2
    keys = {dp.field_key for dp in dps}
    assert "pressure" in keys
    assert "flow_rate" in keys


def test_set_data_confirmed(db_session):
    run = _make_run(db_session)
    assert run.data_confirmed is False
    rfq_service.set_data_confirmed(db_session, run.id)
    db_session.refresh(run)
    assert run.data_confirmed is True


def test_save_content(db_session):
    run = _make_run(db_session)
    rfq_service.complete_run(db_session, run.id, {"result": "test"})
    rfq_service.save_content(db_session, run.id, "<p>Hello</p>")
    db_session.refresh(run)
    assert run.edited_content == "<p>Hello</p>"


def test_save_similar_ids(db_session):
    run = _make_run(db_session)
    ids = [str(uuid.uuid4()), str(uuid.uuid4())]
    rfq_service.save_similar_ids(db_session, run.id, ids)
    db_session.refresh(run)
    assert run.similar_run_ids == ids
