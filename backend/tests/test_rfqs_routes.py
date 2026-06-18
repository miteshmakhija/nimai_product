"""Tests for the new /rfqs endpoints (extract, confirm, submit-data, content, export)."""
from unittest import mock
from app.services import auth_service, rfq_service
from app.models.db import InputType, RunStatus


def _user_headers(client, db_session):
    auth_service.create_user(db_session, email="u@test.com", password="pass123",
                              full_name="User", role="end_user")
    r = client.post("/auth/login", data={"username": "u@test.com", "password": "pass123"})
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def _make_pending_confirmation_run(db_session, user_id):
    run = rfq_service.create_run(db_session, submitted_by=user_id, input_type=InputType.text,
                                  source_text="test rfq")
    rfq_service.set_status(db_session, run.id, RunStatus.pending_confirmation)
    db_session.refresh(run)
    return run


def _make_pending_data_run(db_session, user_id):
    run = rfq_service.create_run(db_session, submitted_by=user_id, input_type=InputType.text,
                                  source_text="test rfq")
    rfq_service.save_metadata(db_session, run.id, {
        "meta_company_name": "Acme",
        "meta_product": "Pump",
        "meta_rfq_date": None,
        "meta_rfq_number": None,
    })
    rfq_service.set_status(db_session, run.id, RunStatus.pending_data)
    rfq_service.save_data_points(db_session, run.id, [
        {"key": "pressure", "label": "Pressure", "value": None, "source": "extracted"},
    ])
    db_session.refresh(run)
    return run


def _make_approved_run(db_session, user_id):
    from app.models.db import ApprovalState
    run = rfq_service.create_run(db_session, submitted_by=user_id, input_type=InputType.text,
                                  source_text="test rfq")
    rfq_service.complete_run(db_session, run.id, {"quote": "test"})
    run.approval_state = ApprovalState.approved
    db_session.commit()
    db_session.refresh(run)
    return run


def _make_sent_run(db_session, user_id):
    from app.models.db import ApprovalState
    run = _make_approved_run(db_session, user_id)
    run.approval_state = ApprovalState.sent_to_customer
    db_session.commit()
    db_session.refresh(run)
    return run


def test_mark_sent_happy_path(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = _make_approved_run(db_session, user.id)
    r = client.post(f"/rfqs/{run.id}/mark-sent", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["approval_state"] == "sent_to_customer"


def test_mark_sent_wrong_state(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test rfq")
    r = client.post(f"/rfqs/{run.id}/mark-sent", headers=hdrs)
    assert r.status_code == 400
    assert "internally approved" in r.json()["detail"]


def test_mark_customer_approved_happy_path(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = _make_sent_run(db_session, user.id)
    r = client.post(f"/rfqs/{run.id}/mark-customer-approved", headers=hdrs, json={
        "customer_approved_at": "2026-06-15",
        "customer_po_reference": "PO-1234",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["approval_state"] == "customer_approved"
    assert data["customer_po_reference"] == "PO-1234"
    assert "2026-06-15" in data["customer_approved_at"]


def test_mark_customer_approved_wrong_state(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = _make_approved_run(db_session, user.id)
    r = client.post(f"/rfqs/{run.id}/mark-customer-approved", headers=hdrs, json={
        "customer_approved_at": "2026-06-15",
    })
    assert r.status_code == 400
    assert "sent to customer" in r.json()["detail"]


def test_extract_text_route(client, db_session):
    hdrs = _user_headers(client, db_session)
    structured = {"customer_name": "Acme", "rfq_number": "001",
                  "rfq_date": "2026-01-01", "equipment_type": "Pump"}
    with mock.patch("app.services.extractor.extract_combined", return_value=structured), \
         mock.patch("app.api.routers.rfqs._build_sections", return_value=[]):
        r = client.post("/rfqs/extract-text", json={"text": "Sample RFQ text"}, headers=hdrs)
    assert r.status_code == 202
    data = r.json()
    assert data["status"] == "pending_confirmation"
    assert data["meta_company_name"] == "Acme"
    assert data["meta_product"] == "Pump"


def test_confirm_route_no_product_def(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    user = db_session.query(User).filter_by(email="u@test.com").first()
    run = _make_pending_confirmation_run(db_session, user.id)

    with mock.patch("app.worker.tasks.process_rfq_task") as mock_task:
        mock_task.delay.return_value = mock.Mock(id="celery-task-1")
        r = client.post(f"/rfqs/{run.id}/confirm", json={
            "meta_company_name": "Acme",
            "meta_product": "Unknown Product",
            "meta_rfq_date": None,
            "meta_rfq_number": None,
        }, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["status"] == "queued"
    assert r.json()["data_points"] == []


def test_confirm_route_with_product_def(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    from app.services import product_service
    user = db_session.query(User).filter_by(email="u@test.com").first()
    product_service.upsert_product_fields(db_session, "Pump", [
        {"key": "pressure", "label": "Pressure", "field_type": "number", "required": True},
    ])
    run = _make_pending_confirmation_run(db_session, user.id)

    with mock.patch("app.worker.tasks.process_rfq_task") as mock_task:
        mock_task.delay.return_value = mock.Mock(id="celery-task-3")
        r = client.post(f"/rfqs/{run.id}/confirm", json={
            "meta_company_name": "Acme",
            "meta_product": "Pump",
            "meta_rfq_date": None,
            "meta_rfq_number": None,
        }, headers=hdrs)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "queued"


def test_confirm_wrong_status(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    user = db_session.query(User).filter_by(email="u@test.com").first()
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test")
    rfq_service.complete_run(db_session, run.id, {})
    r = client.post(f"/rfqs/{run.id}/confirm", json={}, headers=hdrs)
    assert r.status_code == 409


def test_submit_data_route(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    from app.services import product_service
    user = db_session.query(User).filter_by(email="u@test.com").first()
    product_service.upsert_product_fields(db_session, "Pump", [
        {"key": "pressure", "label": "Pressure", "field_type": "number", "required": True},
    ])
    run = _make_pending_data_run(db_session, user.id)

    with mock.patch("app.worker.tasks.process_rfq_task") as mock_task:
        mock_task.delay.return_value = mock.Mock(id="celery-task-2")
        r = client.post(f"/rfqs/{run.id}/submit-data", json={
            "data_points": [{"key": "pressure", "value": "10 bar"}]
        }, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["status"] == "queued"


def test_submit_data_missing_required(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    from app.services import product_service
    user = db_session.query(User).filter_by(email="u@test.com").first()
    product_service.upsert_product_fields(db_session, "Pump", [
        {"key": "pressure", "label": "Pressure", "field_type": "number", "required": True},
    ])
    run = _make_pending_data_run(db_session, user.id)

    r = client.post(f"/rfqs/{run.id}/submit-data", json={
        "data_points": [{"key": "pressure", "value": None}]
    }, headers=hdrs)
    assert r.status_code == 422


def test_submit_data_wrong_status(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    user = db_session.query(User).filter_by(email="u@test.com").first()
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test")
    rfq_service.complete_run(db_session, run.id, {})
    r = client.post(f"/rfqs/{run.id}/submit-data", json={"data_points": []}, headers=hdrs)
    assert r.status_code == 409


def test_save_content(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    user = db_session.query(User).filter_by(email="u@test.com").first()
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test")
    rfq_service.complete_run(db_session, run.id, {"result": "ok"})
    r = client.patch(f"/rfqs/{run.id}/content", json={"content": "<p>Hi</p>"}, headers=hdrs)
    assert r.status_code == 200


def test_export_docx(client, db_session):
    import io
    hdrs = _user_headers(client, db_session)
    from app.models.db import User
    user = db_session.query(User).filter_by(email="u@test.com").first()
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test")
    rfq_service.complete_run(db_session, run.id, {"equipment": {"name": "Pump"}, "pricing_table": []})
    fake_buf = io.BytesIO(b"PK\x03\x04fake-docx-content")
    with mock.patch("app.services.docx_exporter.create_quote_docx", return_value=fake_buf):
        r = client.get(f"/rfqs/{run.id}/export", headers=hdrs)
    assert r.status_code == 200
    assert "wordprocessingml" in r.headers["content-type"]
