import json
from unittest.mock import patch, MagicMock
from app.services import extractor


def _mock_llm(payload: dict):
    llm = MagicMock()
    llm.invoke.return_value = MagicMock(content=json.dumps(payload))
    return llm


def test_extract_combined_includes_product_details_when_fields_passed():
    payload = {
        "customer_name": "Acme",
        "equipment_type": "Pressure Vessel",
        "required_product_details": {"design_pressure": "10 bar", "moc": None},
    }
    fields = [
        {"key": "design_pressure", "label": "Design Pressure", "field_type": "text"},
        {"key": "moc", "label": "Material", "field_type": "text"},
    ]
    with patch("app.core.llm.get_llm", return_value=_mock_llm(payload)):
        result = extractor.extract_combined("some rfq text", fields)
    assert result["customer_name"] == "Acme"
    assert result["required_product_details"]["design_pressure"] == "10 bar"
    assert result["required_product_details"]["moc"] is None


def test_extract_combined_single_llm_call():
    payload = {"customer_name": "Acme", "equipment_type": "Pump"}
    llm = _mock_llm(payload)
    with patch("app.core.llm.get_llm", return_value=llm):
        extractor.extract_combined("text", None)
    assert llm.invoke.call_count == 1


def test_extract_combined_no_fields_omits_product_block():
    payload = {"customer_name": "Acme", "equipment_type": "Pump"}
    with patch("app.core.llm.get_llm", return_value=_mock_llm(payload)):
        result = extractor.extract_combined("text", None)
    assert result.get("required_product_details", {}) == {}
