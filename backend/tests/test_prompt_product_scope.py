from app.services import prompt_service


def test_product_prompt_overrides_default(db_session):
    prompt_service.create_prompt(db_session, key="generation", name="Default",
                                 content="DEFAULT")
    prompt_service.create_prompt(db_session, key="generation", name="PV",
                                 content="PV-SPECIFIC", product_name="Pressure Vessel")

    assert prompt_service.get_active_content_for(db_session, "generation", "Pressure Vessel") == "PV-SPECIFIC"


def test_falls_back_to_default_when_no_product_prompt(db_session):
    prompt_service.create_prompt(db_session, key="generation", name="Default",
                                 content="DEFAULT")
    assert prompt_service.get_active_content_for(db_session, "generation", "Unknown Product") == "DEFAULT"
    assert prompt_service.get_active_content_for(db_session, "generation", None) == "DEFAULT"
