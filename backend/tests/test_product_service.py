"""Tests for product_service CRUD."""
from app.services import product_service


def test_upsert_and_get(db_session):
    row = product_service.upsert_product_fields(db_session, "Centrifugal Pump", [
        {"key": "pressure", "label": "Pressure", "field_type": "number", "required": True},
    ])
    assert row.product_name == "Centrifugal Pump"
    fetched = product_service.get_product_fields(db_session, "Centrifugal Pump")
    assert fetched is not None
    assert len(fetched.fields) == 1
    assert fetched.fields[0]["key"] == "pressure"


def test_upsert_overwrites(db_session):
    product_service.upsert_product_fields(db_session, "Pump", [{"key": "a", "label": "A", "field_type": "text", "required": True}])
    product_service.upsert_product_fields(db_session, "Pump", [{"key": "b", "label": "B", "field_type": "text", "required": False}])
    row = product_service.get_product_fields(db_session, "Pump")
    assert len(row.fields) == 1
    assert row.fields[0]["key"] == "b"


def test_list_products(db_session):
    product_service.upsert_product_fields(db_session, "Reactor", [])
    product_service.upsert_product_fields(db_session, "Vessel", [])
    rows = product_service.list_products(db_session)
    names = [r.product_name for r in rows]
    assert "Reactor" in names
    assert "Vessel" in names


def test_delete_product(db_session):
    product_service.upsert_product_fields(db_session, "ToDelete", [])
    product_service.delete_product(db_session, "ToDelete")
    assert product_service.get_product_fields(db_session, "ToDelete") is None
