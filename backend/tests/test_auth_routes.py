from app.services import auth_service
from app.models.db import UserRole


def test_login_success_and_me(client, db_session):
    auth_service.create_user(db_session, "a@b.com", "pw12345", role=UserRole.admin)
    r = client.post("/auth/login", data={"username": "a@b.com", "password": "pw12345"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "a@b.com"
    assert me.json()["role"] == "admin"


def test_login_bad_password(client, db_session):
    auth_service.create_user(db_session, "a@b.com", "pw12345")
    r = client.post("/auth/login", data={"username": "a@b.com", "password": "wrong"})
    assert r.status_code == 401
