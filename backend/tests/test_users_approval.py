"""Tests for user can_approve / auth_provider fields and /users/approvers endpoint."""
import os
os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

from app.services import auth_service


def _admin_headers(client, db_session):
    auth_service.create_user(db_session, email="sa@test.com", password="pass123",
                              full_name="SA", role="super_admin")
    r = client.post("/auth/login", data={"username": "sa@test.com", "password": "pass123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _user_headers(client, db_session):
    auth_service.create_user(db_session, email="u@apptest.com", password="pass123",
                              full_name="U", role="end_user")
    r = client.post("/auth/login", data={"username": "u@apptest.com", "password": "pass123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_create_user_with_can_approve(client, db_session):
    headers = _admin_headers(client, db_session)
    resp = client.post("/users", json={
        "email": "approver@test.com", "password": "pass123",
        "full_name": "Approver", "role": "end_user", "can_approve": True,
    }, headers=headers)
    assert resp.status_code == 201
    assert resp.json()["can_approve"] is True


def test_patch_can_approve(client, db_session):
    headers = _admin_headers(client, db_session)
    # Create a plain user
    create = client.post("/users", json={
        "email": "plain@test.com", "password": "pass123",
        "full_name": "Plain", "role": "end_user",
    }, headers=headers)
    user_id = create.json()["id"]

    # Grant approver capability
    resp = client.patch(f"/users/{user_id}", json={"can_approve": True}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["can_approve"] is True

    # Revoke it
    resp2 = client.patch(f"/users/{user_id}", json={"can_approve": False}, headers=headers)
    assert resp2.json()["can_approve"] is False


def test_approvers_endpoint_returns_eligible_users(client, db_session):
    admin_headers = _admin_headers(client, db_session)
    user_headers = _user_headers(client, db_session)

    # Create an approver
    client.post("/users", json={
        "email": "elig@test.com", "password": "pass123",
        "full_name": "Elig", "role": "end_user", "can_approve": True,
    }, headers=admin_headers)

    # Any logged-in user can see the approvers list
    resp = client.get("/users/approvers", headers=user_headers)
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    # The super_admin and elig are approvers; the plain end_user is not
    assert "elig@test.com" in emails
    assert "sa@test.com" in emails
    assert "u@apptest.com" not in emails


def test_approvers_endpoint_requires_auth(client, db_session):
    resp = client.get("/users/approvers")
    assert resp.status_code == 401
