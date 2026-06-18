from app.services import prompt_service


def test_create_prompt_and_first_version(db_session):
    p = prompt_service.create_prompt(db_session, key="generation", name="Generation",
                                     content="v1 content")
    assert p.key == "generation"
    active = prompt_service.get_active_content(db_session, "generation")
    assert active == "v1 content"


def test_new_version_increments_and_activate(db_session):
    prompt_service.create_prompt(db_session, key="generation", name="Generation", content="v1")
    v2 = prompt_service.add_version(db_session, "generation", content="v2", note="tweak")
    assert v2.version == 2
    # still active = v1 until we activate
    assert prompt_service.get_active_content(db_session, "generation") == "v1"
    prompt_service.set_active(db_session, "generation", v2.id)
    assert prompt_service.get_active_content(db_session, "generation") == "v2"


def test_get_active_content_missing_returns_none(db_session):
    assert prompt_service.get_active_content(db_session, "nope") is None
