"""Unit tests for app_config_service (no HTTP — direct service calls)."""
import pytest
from app.services import app_config_service
from app.models.db import AppConfig


def test_get_all_empty(db_session):
    rows = app_config_service.get_all(db_session)
    assert rows == []


def test_bulk_upsert_insert(db_session):
    items = [
        {"id": None, "key": "company_name", "label": "Company Name", "value": "ACME",
         "field_type": "text", "required": True, "enabled": True, "sort_order": 0},
    ]
    rows = app_config_service.bulk_upsert(db_session, items)
    assert len(rows) == 1
    assert rows[0].key == "company_name"
    assert rows[0].value == "ACME"


def test_bulk_upsert_update(db_session):
    items = [
        {"id": None, "key": "company_name", "label": "Company Name", "value": "ACME",
         "field_type": "text", "required": True, "enabled": True, "sort_order": 0},
    ]
    rows = app_config_service.bulk_upsert(db_session, items)
    row_id = str(rows[0].id)

    updated = [
        {"id": row_id, "key": "company_name", "label": "Company Name", "value": "NEWCO",
         "field_type": "text", "required": True, "enabled": True, "sort_order": 0},
    ]
    rows2 = app_config_service.bulk_upsert(db_session, updated)
    assert rows2[0].value == "NEWCO"


def test_delete_non_required(db_session):
    items = [
        {"id": None, "key": "phone", "label": "Phone", "value": "+1-555",
         "field_type": "text", "required": False, "enabled": True, "sort_order": 2},
    ]
    rows = app_config_service.bulk_upsert(db_session, items)
    row_id = str(rows[0].id)
    result = app_config_service.delete_item(db_session, row_id)
    assert result is True
    assert app_config_service.get_all(db_session) == []


def test_delete_required_raises(db_session):
    items = [
        {"id": None, "key": "company_name", "label": "Company Name", "value": "ACME",
         "field_type": "text", "required": True, "enabled": True, "sort_order": 0},
    ]
    rows = app_config_service.bulk_upsert(db_session, items)
    row_id = str(rows[0].id)
    with pytest.raises(ValueError, match="required"):
        app_config_service.delete_item(db_session, row_id)


def test_get_company_context(db_session):
    import json
    items = [
        {"id": None, "key": "company_name", "label": "Company Name", "value": "ACME",
         "field_type": "text", "required": True, "enabled": True, "sort_order": 0},
        {"id": None, "key": "certifications", "label": "Certifications",
         "value": json.dumps(["ISO 9001", "ASME"]),
         "field_type": "list", "required": False, "enabled": True, "sort_order": 4},
        {"id": None, "key": "phone", "label": "Phone", "value": "+1-555",
         "field_type": "text", "required": False, "enabled": False, "sort_order": 2},
    ]
    app_config_service.bulk_upsert(db_session, items)
    ctx = app_config_service.get_company_context(db_session)
    assert ctx["company_name"] == "ACME"
    assert ctx["certifications"] == ["ISO 9001", "ASME"]
    assert "phone" not in ctx  # disabled row excluded
