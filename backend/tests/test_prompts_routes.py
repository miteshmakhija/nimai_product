from app.services import auth_service, prompt_service
from app.models.db import UserRole


def _auth(client, db_session, role, email="u@x.com"):
    auth_service.create_user(db_session, email, "pw12345", role=role)
    r = client.post("/auth/login", data={"username": email, "password": "pw12345"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_end_user_cannot_list_prompts(client, db_session):
    h = _auth(client, db_session, UserRole.end_user)
    assert client.get("/prompts", headers=h).status_code == 403


def test_admin_can_create_version_and_activate(client, db_session):
    prompt_service.create_prompt(db_session, "generation", "Generation", "v1")
    h = _auth(client, db_session, UserRole.admin)
    r = client.post("/prompts/generation/versions",
                    json={"content": "v2", "note": "n"}, headers=h)
    assert r.status_code == 201
    vid = r.json()["id"]
    a = client.post("/prompts/generation/activate",
                    json={"version_id": vid}, headers=h)
    assert a.status_code == 200
