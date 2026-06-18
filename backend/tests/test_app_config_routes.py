"""Tests for /app-config CRUD endpoints (admin only)."""
import pytest
from app.services import auth_service


def _admin_headers(client, db_session):
    auth_service.create_user(db_session, email="admin@test.com", password="pass123",
                              full_name="Admin", role="admin")
    r = client.post("/auth/login", data={"username": "admin@test.com", "password": "pass123"})
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def _user_headers(client, db_session):
    auth_service.create_user(db_session, email="user@test.com", password="pass123",
                              full_name="User", role="end_user")
    r = client.post("/auth/login", data={"username": "user@test.com", "password": "pass123"})
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}"}


def test_get_empty(client, db_session):
    hdrs = _admin_headers(client, db_session)
    r = client.get("/app-config", headers=hdrs)
    assert r.status_code == 200
    assert r.json() == []


def test_put_and_get(client, db_session):
    hdrs = _admin_headers(client, db_session)
    payload = {"items": [
        {"id": None, "key": "company_name", "label": "Company Name", "value": "ACME",
         "field_type": "text", "required": True, "enabled": True, "sort_order": 0}
    ]}
    r = client.put("/app-config", json=payload, headers=hdrs)
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["key"] == "company_name"
    assert items[0]["value"] == "ACME"

    r2 = client.get("/app-config", headers=hdrs)
    assert r2.status_code == 200
    assert r2.json()[0]["value"] == "ACME"


def test_delete_non_required(client, db_session):
    hdrs = _admin_headers(client, db_session)
    payload = {"items": [
        {"id": None, "key": "phone", "label": "Phone", "value": "+1-555",
         "field_type": "text", "required": False, "enabled": True, "sort_order": 2}
    ]}
    r = client.put("/app-config", json=payload, headers=hdrs)
    row_id = r.json()[0]["id"]

    r2 = client.delete(f"/app-config/{row_id}", headers=hdrs)
    assert r2.status_code == 204

    r3 = client.get("/app-config", headers=hdrs)
    assert r3.json() == []


def test_delete_required_returns_409(client, db_session):
    hdrs = _admin_headers(client, db_session)
    payload = {"items": [
        {"id": None, "key": "company_name", "label": "Company Name", "value": "ACME",
         "field_type": "text", "required": True, "enabled": True, "sort_order": 0}
    ]}
    r = client.put("/app-config", json=payload, headers=hdrs)
    row_id = r.json()[0]["id"]

    r2 = client.delete(f"/app-config/{row_id}", headers=hdrs)
    assert r2.status_code == 409


def test_requires_admin(client, db_session):
    hdrs = _user_headers(client, db_session)
    r = client.get("/app-config", headers=hdrs)
    assert r.status_code == 403
