# app/services/extractor.py
import json


def extract_rfq_metadata(rfq_text: str) -> dict:
    """Lightweight pass — extracts only 4 key metadata fields.

    Returns: {customer_name, rfq_number, rfq_date, equipment_type}
    """
    from app.core.llm import get_llm
    llm = get_llm("extractor")
    prompt = f"""Extract only these 4 fields from the RFQ document. Output ONLY valid JSON, no markdown, no explanation.

{{
  "customer_name": "company name of the customer sending the RFQ, or null",
  "rfq_number": "RFQ reference number, or null",
  "rfq_date": "date on the RFQ as ISO string (YYYY-MM-DD) or as found, or null",
  "equipment_type": "type of equipment/product being requested (e.g. Centrifugal Pump, Pressure Vessel), or null"
}}

RFQ TEXT:
{rfq_text[:8000]}"""

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        return json.loads(text)
    except Exception:
        return {"customer_name": None, "rfq_number": None, "rfq_date": None, "equipment_type": None}


def extract_data_points(rfq_text: str, required_fields: list) -> dict:
    """Extract values for each required field from the document text.

    Returns {field_key: extracted_value_or_None}.
    """
    from app.core.llm import get_llm
    llm = get_llm("extractor")

    fields_spec = "\n".join(
        f'  "{f["key"]}": "{f.get("label", f["key"])} ({f.get("field_type", "text")})"'
        for f in required_fields
    )
    prompt = f"""Extract the following data fields from the RFQ document. Output ONLY valid JSON.
Use null for any field not found in the document. Do not invent values.

Expected fields:
{{
{fields_spec}
}}

RFQ TEXT:
{rfq_text[:12000]}"""

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        extracted = json.loads(text)
        # Ensure all requested keys are present
        return {f["key"]: extracted.get(f["key"]) for f in required_fields}
    except Exception:
        return {f["key"]: None for f in required_fields}


def extract_rfq_structured(rfq_text: str) -> dict:
    from app.core.llm import get_llm
    return _extract_detailed(rfq_text, get_llm("extractor"))


def extract_combined(rfq_text: str, product_fields: list | None = None) -> dict:
    """Single LLM call: full structured extraction PLUS a required_product_details
    sub-dict for the product's specific fields. When product_fields is falsy the
    product block is omitted and the result has no required_product_details key."""
    from app.core.llm import get_llm
    llm = get_llm("extractor")

    product_block = ""
    if product_fields:
        spec = "\n".join(
            f'    "{f["key"]}": "{f.get("label", f["key"])} '
            f'({f.get("field_type", "text")}) — exact value or null"'
            for f in product_fields
        )
        product_block = (
            ',\n  "required_product_details": {\n' + spec + "\n  }"
        )

    prompt = f"""Extract ALL technical and commercial details from this RFQ document into structured JSON.
You must capture EVERY specification mentioned - do not summarize or skip any values.

Output ONLY valid JSON (no markdown, no explanation):

{{
  "customer_name": "company name of the customer sending the RFQ",
  "customer_address": "customer address if mentioned",
  "contact_person": "name of contact person if mentioned",
  "rfq_number": "RFQ reference number",
  "rfq_date": "date on the RFQ",
  "subject": "subject/title of the RFQ",
  "equipment_type": "type of equipment",
  "quantity": "number of units requested",
  "process_and_mechanical_details": {{}},
  "vessel_details": {{}},
  "material_of_construction": {{}},
  "nozzle_details": {{}},
  "surface_treatment": {{}},
  "agitator_details": {{}},
  "inspection_requirements": [],
  "delivery_requirements": {{}},
  "commercial_terms": {{}},
  "additional_requirements": [],
  "notes": "any other important information"{product_block}
}}

IMPORTANT:
- Extract EXACT values as written in the RFQ.
- Use null for fields not mentioned. Do NOT invent values.
- Preserve units as stated (mm, deg C, bar, kg/cm2, etc.).

RFQ TEXT:
{rfq_text}"""

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error in extract_combined: {e}")
        return {"notes": "Failed to parse RFQ", "equipment_type": "Unknown"}


def _extract_detailed(rfq_text: str, llm_instance) -> dict:
    """
    Core extraction: pulls all technical details from RFQ into structured format
    that directly feeds the quotation generator.
    """
    prompt = f"""Extract ALL technical and commercial details from this RFQ document into structured JSON.
You must capture EVERY specification mentioned - do not summarize or skip any values.

Output ONLY valid JSON (no markdown, no explanation):

{{
  "customer_name": "company name of the customer sending the RFQ",
  "customer_address": "customer address if mentioned",
  "contact_person": "name of contact person if mentioned",
  "rfq_number": "RFQ reference number",
  "rfq_date": "date on the RFQ",
  "subject": "subject/title of the RFQ (e.g. Pressure Vessel, Reactor, Column)",
  "equipment_type": "type of equipment (Reactor, Column, Condenser, Pressure Vessel, Heat Exchanger, etc.)",
  "quantity": "number of units requested",
  "process_and_mechanical_details": {{
    "Process Fluid": "exact value from RFQ or null",
    "Flow Rate": "exact value or null",
    "Operating Temperature in deg C": "exact value",
    "Design Temperature in deg C": "exact value",
    "Operating Pressure": "exact value with units",
    "Design Pressure": "exact value with units",
    "Corrosion Allowance": "exact value or null",
    "Design Code": "ASME/IS code mentioned",
    "Radiography": "requirement mentioned",
    "Hydrotest": "requirement mentioned",
    "Joint Efficiency": "value if mentioned or null"
  }},
  "vessel_details": {{
    "Type": "vessel type (Vertical/Horizontal/Cylindrical etc.)",
    "Capacity": "volume/capacity",
    "Internal Diameter": "exact dimension",
    "Length/Height (TL-TL)": "exact dimension",
    "Shell Thickness": "exact value",
    "Head Type": "Torispherical/Hemispherical/Flat",
    "Orientation": "Vertical/Horizontal"
  }},
  "material_of_construction": {{
    "Shell": "material grade",
    "Heads": "material grade",
    "Nozzles": "material grade",
    "Flanges": "material grade if mentioned",
    "Internals": "material if mentioned",
    "Support": "material if mentioned"
  }},
  "nozzle_details": {{
    "Inlet": "size and details",
    "Outlet": "size and details",
    "Drain": "size and details",
    "Vent": "size and details",
    "Manhole": "size and details",
    "Others": "any other connections mentioned"
  }},
  "surface_treatment": {{
    "Internal": "treatment specified",
    "External": "treatment specified"
  }},
  "agitator_details": {{
    "Required": true/false,
    "Type": "if mentioned",
    "Power": "if mentioned",
    "Speed": "if mentioned",
    "Impeller": "if mentioned",
    "Seal Type": "if mentioned"
  }},
  "inspection_requirements": [
    "list each inspection/testing/documentation requirement"
  ],
  "delivery_requirements": {{
    "Timeline": "delivery period mentioned",
    "Location": "delivery location",
    "Packing": "packing requirements"
  }},
  "commercial_terms": {{
    "Payment Terms": "exact terms from RFQ",
    "Warranty": "warranty requirement",
    "Price Validity": "validity period"
  }},
  "additional_requirements": [
    "list any other requirements mentioned (MTC, QAP, WPS, drawings, etc.)"
  ],
  "notes": "any other important information not captured above"
}}

IMPORTANT:
- Extract EXACT values as written in the RFQ (temperatures, pressures, dimensions, material grades)
- Do NOT invent or assume values - use null for fields not mentioned in the RFQ
- If multiple equipment items are mentioned, include all details for the primary item
- Preserve units as stated (mm, deg C, bar, kg/cm2, etc.)
- For material_of_construction, use exact grades mentioned (SS 316L, SA240 Gr 316, CS, etc.)

RFQ TEXT:
{rfq_text}"""

    try:
        response = llm_instance.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)

        # Strip markdown fences if present
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        parsed = json.loads(text)
        return parsed
    except Exception as e:
        print(f"Error extracting RFQ data: {e}")
        try:
            return json.loads(content)
        except:
            return {"notes": "Failed to parse RFQ", "equipment_type": "Unknown"}


def flatten_structured_to_data_points(structured: dict) -> list[dict]:
    """Convert the rich structured JSON from extract_rfq_structured() into a flat
    list of {key, label, value, source} data-point rows.

    Nested dicts (e.g. process_and_mechanical_details) are expanded as
    "section__key" entries so they can be shown/edited individually.
    Top-level scalar fields become direct rows.
    Meta fields (customer_name, rfq_number, rfq_date, equipment_type) are
    excluded because they live in the dedicated metadata columns.
    """
    META_KEYS = {"customer_name", "rfq_number", "rfq_date", "equipment_type",
                 "customer_address", "contact_person", "notes"}

    # Human-readable section labels
    SECTION_LABELS = {
        "process_and_mechanical_details": "Process & Mechanical",
        "vessel_details": "Vessel Details",
        "material_of_construction": "Material of Construction",
        "nozzle_details": "Nozzle Details",
        "surface_treatment": "Surface Treatment",
        "agitator_details": "Agitator Details",
        "inspection_requirements": "Inspection Requirements",
        "delivery_requirements": "Delivery",
        "commercial_terms": "Commercial Terms",
        "additional_requirements": "Additional Requirements",
    }

    rows = []

    def _humanize(key: str) -> str:
        return key.replace("_", " ").title()

    def _stringify(val) -> str | None:
        if val is None:
            return None
        if isinstance(val, (dict, list)):
            return json.dumps(val)
        return str(val)

    # Top-level scalar fields first (quantity, subject, etc.)
    SCALAR_TOP = ["subject", "quantity"]
    for k in SCALAR_TOP:
        v = structured.get(k)
        if v is not None:
            rows.append({"key": k, "label": _humanize(k), "value": _stringify(v), "source": "extracted"})

    # Nested section dicts
    for section_key, section_label in SECTION_LABELS.items():
        section = structured.get(section_key)
        if not section:
            continue
        if isinstance(section, dict):
            for sub_key, sub_val in section.items():
                if sub_val is None:
                    continue
                composite_key = f"{section_key}__{sub_key}"
                label = f"{section_label} — {_humanize(sub_key)}"
                rows.append({"key": composite_key, "label": label, "value": _stringify(sub_val), "source": "extracted"})
        elif isinstance(section, list):
            composite_key = section_key
            label = section_label
            rows.append({"key": composite_key, "label": label, "value": _stringify(section), "source": "extracted"})

    return rows


def completeness_score(rfq_data: dict, required_fields: list[str]) -> float:
    """Calculate percentage of required fields filled."""
    if not required_fields:
        return 1.0

    filled_count = 0

    for field in required_fields:
        value = rfq_data.get(field)
        if value is not None and value != "" and value != [] and value != {}:
            filled_count += 1

    return filled_count / len(required_fields)


def suggest_defaults(rfq_data: dict, similar_docs: list[dict]) -> dict:
    """Propose field values based on retrieved similar quotes."""
    suggestions = {}

    empty_fields = [k for k, v in rfq_data.items() if v is None or v == "" or v == []]

    if not similar_docs or not empty_fields:
        return suggestions

    for field in empty_fields:
        values = []

        for doc in similar_docs:
            structured_data = doc.get("structured_data", {})
            if field in structured_data:
                value = structured_data[field]
                if value is not None and value != "" and value != []:
                    values.append(str(value))

        if values:
            from collections import Counter
            most_common = Counter(values).most_common(1)[0][0]

            try:
                suggestions[field] = json.loads(most_common)
            except:
                suggestions[field] = most_common

    return suggestions
