from app.services import auth_service
from app.models.db import UserRole


def _auth(client, db_session, role, email="a@x.com"):
    auth_service.create_user(db_session, email, "pw12345", role=role)
    r = client.post("/auth/login", data={"username": email, "password": "pw12345"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_metrics_empty(client, db_session):
    h = _auth(client, db_session, UserRole.admin)
    r = client.get("/metrics", headers=h)
    assert r.status_code == 200
    assert r.json()["total"] == 0
    assert r.json()["success_rate"] == 0.0
