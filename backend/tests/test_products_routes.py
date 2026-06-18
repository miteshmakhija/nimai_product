"""Tests for /products CRUD endpoints (admin only)."""
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


def test_put_and_get(client, db_session):
    hdrs = _admin_headers(client, db_session)
    r = client.put("/products/Pump", json={"fields": [
        {"key": "pressure", "label": "Pressure", "field_type": "number", "required": True}
    ]}, headers=hdrs)
    assert r.status_code == 200
    assert r.json()["product_name"] == "Pump"

    r2 = client.get("/products/Pump", headers=hdrs)
    assert r2.status_code == 200
    assert r2.json()["fields"][0]["key"] == "pressure"


def test_list_products(client, db_session):
    hdrs = _admin_headers(client, db_session)
    client.put("/products/A", json={"fields": []}, headers=hdrs)
    client.put("/products/B", json={"fields": []}, headers=hdrs)
    r = client.get("/products", headers=hdrs)
    assert r.status_code == 200
    names = [p["product_name"] for p in r.json()]
    assert "A" in names and "B" in names


def test_delete_product(client, db_session):
    hdrs = _admin_headers(client, db_session)
    client.put("/products/ToGo", json={"fields": []}, headers=hdrs)
    r = client.delete("/products/ToGo", headers=hdrs)
    assert r.status_code == 204
    r2 = client.get("/products/ToGo", headers=hdrs)
    assert r2.status_code == 404


def test_products_require_admin(client, db_session):
    hdrs = _user_headers(client, db_session)
    r = client.get("/products", headers=hdrs)
    assert r.status_code == 403
