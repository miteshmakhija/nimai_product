from unittest.mock import MagicMock, patch
from app.api.routers import rfqs


def test_build_sections_reads_product_details_without_llm():
    db = MagicMock()
    run = MagicMock()
    run.meta_product = "Pressure Vessel"
    run.source_text = "irrelevant"
    structured = {
        "customer_name": "Acme",
        "rfq_number": "R-1",
        "required_product_details": {"design_pressure": "10 bar"},
        "vessel_details": {"Type": "Vertical"},
    }
    product_def = MagicMock()
    product_def.fields = [
        {"key": "design_pressure", "label": "Design Pressure", "required": True}
    ]
    with patch("app.api.routers.rfqs.product_service.get_product_fields",
               return_value=product_def), \
         patch("app.core.llm.get_llm") as gl:
        rows = rfqs._build_sections(db, run, structured)
    gl.assert_not_called()
    req = [r for r in rows if r["key"] == "required__design_pressure"]
    assert req and req[0]["value"] == "10 bar"
