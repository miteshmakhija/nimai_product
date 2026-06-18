"""Tests for _run_pipeline: metadata overlay, data-point overlay, similar IDs saved."""
from unittest import mock
import uuid
from app.services import rfq_service
from app.models.db import InputType, RunStatus


def _make_user(db):
    user_id = uuid.uuid4()
    from app.models.db import User, UserRole
    user = User(id=user_id, email=f"{user_id}@test.com", full_name="T", password_hash="x",
                role=UserRole.end_user)
    db.add(user)
    db.commit()
    return user


def _run(db_session, run_id):
    """Helper: run _run_pipeline with the test db session injected via mock."""
    from app.worker.tasks import _run_pipeline
    with mock.patch("app.worker.tasks.SessionLocal", return_value=db_session):
        # Prevent SessionLocal.close() from breaking the shared test session
        with mock.patch.object(db_session, "close"):
            return _run_pipeline(run_id=run_id)


def test_pipeline_uses_confirmed_metadata(db_session):
    """When meta_confirmed=True, structured_rfq should get the user-confirmed values."""
    user = _make_user(db_session)
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test text")
    rfq_service.save_metadata(db_session, run.id, {
        "meta_company_name": "Override Corp",
        "meta_product": None,
        "meta_rfq_date": None,
        "meta_rfq_number": None,
    })
    rfq_service.set_confirmed(db_session, run.id)
    db_session.commit()

    captured = {}

    def fake_generate(rfq, docs, system_prompt_override=None):
        captured["rfq"] = rfq
        return {"result": "ok"}

    with mock.patch("app.worker.tasks.extract_rfq_structured",
                    return_value={"customer_name": "Original Corp"}), \
         mock.patch("app.worker.tasks.retrieve_similar_structured", return_value=[]), \
         mock.patch("app.worker.tasks.generate_quote_from_structured", side_effect=fake_generate), \
         mock.patch("app.worker.tasks.prompt_service.get_active_content", return_value=None):
        _run(db_session, str(run.id))

    assert captured["rfq"]["customer_name"] == "Override Corp"


def test_pipeline_overlays_data_points(db_session):
    """When data_confirmed=True, data point values should be injected into structured_rfq."""
    user = _make_user(db_session)
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test text")
    rfq_service.save_data_points(db_session, run.id, [
        {"key": "operating_pressure", "label": "Pressure", "value": "100 bar", "source": "user_input"},
    ])
    rfq_service.set_data_confirmed(db_session, run.id)
    db_session.commit()

    captured = {}

    def fake_generate(rfq, docs, system_prompt_override=None):
        captured["rfq"] = rfq
        return {"result": "ok"}

    with mock.patch("app.worker.tasks.extract_rfq_structured",
                    return_value={"customer_name": "Test"}), \
         mock.patch("app.worker.tasks.retrieve_similar_structured", return_value=[]), \
         mock.patch("app.worker.tasks.generate_quote_from_structured", side_effect=fake_generate), \
         mock.patch("app.worker.tasks.prompt_service.get_active_content", return_value=None):
        _run(db_session, str(run.id))

    assert captured["rfq"]["operating_pressure"] == "100 bar"


def test_pipeline_reads_source_text_from_db(db_session):
    """When source_text is stored in DB, extract_text should NOT be called."""
    user = _make_user(db_session)
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="stored text")
    db_session.commit()

    with mock.patch("app.worker.tasks.extract_text") as mock_extract, \
         mock.patch("app.worker.tasks.extract_rfq_structured", return_value={}), \
         mock.patch("app.worker.tasks.retrieve_similar_structured", return_value=[]), \
         mock.patch("app.worker.tasks.generate_quote_from_structured", return_value={}), \
         mock.patch("app.worker.tasks.prompt_service.get_active_content", return_value=None):
        _run(db_session, str(run.id))

    mock_extract.assert_not_called()


def test_pipeline_saves_similar_ids(db_session):
    """After retrieval, similar run IDs should be persisted to rfq_runs.similar_run_ids."""
    user = _make_user(db_session)
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test text")
    similar_id = str(uuid.uuid4())

    with mock.patch("app.worker.tasks.extract_rfq_structured", return_value={}), \
         mock.patch("app.worker.tasks.retrieve_similar_structured",
                    return_value=[{"run_id": similar_id}]), \
         mock.patch("app.worker.tasks.generate_quote_from_structured", return_value={}), \
         mock.patch("app.worker.tasks.prompt_service.get_active_content", return_value=None):
        _run(db_session, str(run.id))

    db_session.refresh(run)
    assert run.similar_run_ids == [similar_id]
