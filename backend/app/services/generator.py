# app/services/generator.py
import json
from app.services.prompt_loader import load_prompt, load_skill
from app.services.skill_selector import select_skills


def generate_quote_from_structured(rfq: dict, context_docs: list,
                                   system_prompt_override: str = None) -> dict:
    from app.core.llm import get_llm
    prompt = _build_structured_prompt(rfq, context_docs,
                                      system_prompt_override=system_prompt_override)
    response = get_llm("generator").invoke(prompt)
    return _parse_quote_json(response.content)


def generate_quote_with_template(
    rfq_data: dict,
    similar_docs: list[dict],
    template: dict,
    llm
) -> dict:
    """
    Generate structured quote data for DOCX export.

    Returns:
        Dictionary matching create_quote_docx input format
    """
    prompt = _build_structured_prompt(rfq_data, similar_docs, template)

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        return _parse_quote_json(content)
    except Exception as e:
        raise RuntimeError(f"Quote generation failed: {e}")


def _parse_quote_json(content: str) -> dict:
    """Parse LLM JSON output, stripping markdown fences if present."""
    text = content.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"equipment": [], "general_notes": [], "pricing_table": {"items": []}, "terms_and_conditions": []}


def _build_structured_prompt(
    rfq_data: dict,
    context_docs: list,
    template: dict = None,
    system_prompt_override: str = None,
) -> str:

    rfq_str = json.dumps(rfq_data, indent=2, default=str)

    system_prompt = (system_prompt_override
                     if system_prompt_override is not None
                     else load_prompt("system_prompt.md"))

    format_skill = load_skill("format", "quotation_format_skill")

    product_skills = [
        load_skill("products", "vessel_skill")
    ]

    commercial_skills = [
        load_skill("commercial", "pricing_skill")
    ]

 # ----------------------------------------
    # SKILL SELECTION
    # ----------------------------------------

    selected = select_skills(rfq_data)

    product_skills = [
        load_skill("products", skill)
        for skill in selected["product_skills"]
    ]

    commercial_skills = [
        load_skill("commercial", skill)
        for skill in selected["commercial_skills"]
    ]

    similar_str = ""
    if context_docs:
        similar_str = "\nREFERENCE QUOTES:\n"
        for i, doc in enumerate(context_docs[:3], 1):
            content = doc.get("content", str(doc))[:1200]
            similar_str += f"\nREFERENCE {i}:\n{content}\n"

    # ----------------------------------------
    # FINAL PROMPT
    # ----------------------------------------
    prompt = f"""
{system_prompt}

==================================================
FORMAT SKILL
==================================================

{format_skill}

==================================================
PRODUCT SKILLS
==================================================

{"".join(product_skills)}

==================================================
COMMERCIAL SKILLS
==================================================

{"".join(commercial_skills)}

==================================================
RFQ INPUT
==================================================

{rfq_str}

==================================================
REFERENCE DOCUMENTS
==================================================

{similar_str}

==================================================
TASK
==================================================

Generate the complete quotation JSON.

Output ONLY valid JSON.
No markdown.
No explanations.
"""

    return prompt

def _build_structured_prompt_old(
    rfq_data: dict,
    context_docs: list,
    template: dict = None
) -> str:
    """Build prompt that instructs LLM to output structured JSON for multi-page DOCX generation."""
    rfq_str = json.dumps(rfq_data, indent=2, default=str)

    similar_str = ""
    if context_docs:
        similar_str = "\n--- REFERENCE QUOTES (for pricing and format guidance) ---\n"
        for i, doc in enumerate(context_docs[:3], 1):
            content = doc.get("content", str(doc))[:1500]
            similar_str += f"\nReference Quote {i}:\n{content}\n"

    date_format = "DD-MMM-YYYY"
    currency = "INR"
    if template:
        date_format = template.get("format_examples", {}).get("date_format", date_format)
        currency = template.get("format_examples", {}).get("currency", currency)

    prompt = f"""You are a senior sales engineer at ACME Process Systems Pvt Ltd generating a Techno-Commercial Offer.

====== RFQ SPECIFICATIONS (PRIMARY INPUT - USE THESE VALUES) ======
{rfq_str}

{similar_str}
====== END OF INPUT DATA ======

TASK: Generate a professional quotation JSON based on the RFQ specifications above.

STEP 1 - ANALYZE THE RFQ:
Before generating, identify from the RFQ data above:
- Equipment type and capacity
- All temperatures, pressures, dimensions (copy exact values)
- Material grades specified (convert to ASTM: SS 316L→SA240 Gr 316, SS 304→SA240 Gr 304, CS→SA516 Gr 70)
- Nozzle sizes and configurations
- Customer name, delivery, and commercial terms
- Any agitator or internals requirements

STEP 2 - OUTPUT JSON:
Output ONLY valid JSON (no markdown fences, no explanation) with this structure.
Every field below marked <DERIVE> must be populated from the RFQ data or your engineering knowledge for this specific equipment. Do NOT copy example text verbatim.

{{
  "header": {{
    "company_name": "ACME PROCESS SYSTEMS PVT LTD, PUNE (INDIA)",
    "company_address": "Plot No. E6, E-Block, Bhosari Industrial Area, Opposite NARI, Bhosari, Pune - 411026, Maharashtra, INDIA",
    "phone": "+91-20-2712-XXXX",
    "email": "sales@acmeprocess.net",
    "certifications": [
      "CERTIFIED COMPANY BY THE AMERICAN SOCIETY OF MECHANICAL ENGINEERS (ASME U STAMP)",
      "ISO 9001:2015 CERTIFIED COMPANY BY TUV NORD GERMANY"
    ]
  }},
  "offer_details": {{
    "offer_number": "<DERIVE: APSPL/[customer-code]/[seq]/25-26/R0>",
    "offer_date": "<DERIVE: today's date in {date_format}>",
    "prepared_by": "Application Engineering Team",
    "customer_name": "<DERIVE: from RFQ customer_name>",
    "subject": "<DERIVE: TECHNO COMMERCIAL OFFER FOR [actual equipment from RFQ]>"
  }},
  "equipment": [
    {{
      "name": "<DERIVE: actual equipment name+capacity from RFQ, e.g. '10 KL SS316 REACTOR'>",
      "tag_no": "<DERIVE: from RFQ or generate based on equipment type (V-xxx, R-xxx, C-xxx)>",
      "moc": "<DERIVE: primary MOC from RFQ material_of_construction>",
      "process_and_mechanical_details": {{
        "Process Fluid": "<DERIVE: from RFQ or 'Client to confirm'>",
        "Flow Rate": "<DERIVE: from RFQ or 'Client to confirm'>",
        "Operating Temperature in deg C": "<DERIVE: exact value from RFQ>",
        "Design Temperature in deg C": "<DERIVE: exact value from RFQ>",
        "Operating Pressure in kg/cm2 g": "<DERIVE: exact value from RFQ, convert units if needed>",
        "Design Pressure kg/cm2 g": "<DERIVE: exact value from RFQ>",
        "Hydrotest Pressure kg/cm2 g": "<DERIVE: calculate as 1.3 × design pressure>",
        "Corrosion Allowance in mm": "<DERIVE: from RFQ, or NIL for SS / 1.5mm for CS based on MOC>",
        "MOC": "<DERIVE: from RFQ material_of_construction>",
        "Joint Efficiency (Shell/Dish) %": "<DERIVE: based on radiography from RFQ and design code>",
        "Radiography (Shell/Head)": "<DERIVE: from RFQ inspection_requirements>",
        "Density kg/m3": "<DERIVE: from RFQ or 'Client to confirm'>",
        "Viscosity cP": "<DERIVE: from RFQ or 'Client to confirm'>",
        "Design Code": "<DERIVE: from RFQ, e.g. ASME SEC. VIII DIV. 1>"
      }},
      "vessel_details": {{
        "Gross Capacity": "<DERIVE: from RFQ vessel_details>",
        "Working Capacity": "<DERIVE: from RFQ vessel_details>",
        "Tank Shape": "<DERIVE: from RFQ>",
        "Tank Orientation": "<DERIVE: from RFQ>",
        "Inside Diameter": "<DERIVE: from RFQ in mm>",
        "Height/Length (TL-TL)": "<DERIVE: from RFQ in mm>",
        "Top/Bottom End Type": "<DERIVE: from RFQ head type>",
        "Thickness (Shell/Top/Bottom)": "<DERIVE: from RFQ or calculate per design code>",
        "Min Dish End Thickness": "<DERIVE: from RFQ or calculate>"
      }},
      "material_of_construction": {{
        "Main Shell": "<DERIVE: ASTM grade matching RFQ MOC>",
        "Top/Bottom Dish End": "<DERIVE: ASTM grade matching RFQ MOC>",
        "Baffles": "<DERIVE: or NA if not applicable>",
        "Nozzle Neck": "<DERIVE: seamless pipe grade matching MOC>",
        "Nozzle Flanges": "<DERIVE: forging grade matching MOC>",
        "Nozzle Dip Pipe": "<DERIVE: or NA>",
        "Nozzle Gaskets": "<DERIVE: appropriate for temp/pressure>",
        "Bolts Nuts (External)": "<DERIVE: appropriate for MOC and service>",
        "Body Flange": "<DERIVE: or NA>",
        "Body Flange Gasket": "<DERIVE>",
        "Body Flange Bolts & Nuts": "<DERIVE>",
        "Manhole": "<DERIVE: matching MOC>",
        "Lug Support": "<DERIVE: based on orientation>",
        "Lifting Lug": "<DERIVE>",
        "Earthing Boss": "<DERIVE>",
        "RF Pad": "<DERIVE: matching MOC>",
        "Internals": "<DERIVE: if applicable>",
        "Insulation Nuts": "<DERIVE>",
        "Foundation Bolts": "<DERIVE>",
        "Gasket": "<DERIVE: appropriate for service conditions>"
      }},
      "nozzle_schedule": {{
        "Inlet": "<DERIVE: size, flange rating, type from RFQ>",
        "Outlet": "<DERIVE: size, flange rating, type from RFQ>",
        "Drain": "<DERIVE: size, flange rating, type>",
        "Vent": "<DERIVE: size, flange rating, type>",
        "Manhole": "<DERIVE: size and flange details from RFQ>",
        "Others": "<DERIVE: any additional nozzles from RFQ>"
      }},
      "surface_finish": {{
        "Internal": "<DERIVE: based on MOC and process fluid>",
        "External": "<DERIVE: based on MOC>"
      }},
      "quantity": "<DERIVE: from RFQ>"
    }}
  ],
  "general_notes": [
    {{
      "heading": "<DERIVE: section heading relevant to the equipment type, e.g. 'A) REACTOR:' or 'A) COLUMN:'>",
      "items": ["<DERIVE: 8-15 notes specific to this equipment type covering: nozzle scope, surface finish, MOC compatibility, process/mechanical guarantee split, scope exclusions, inspection, warranty (18 months from shipment or 12 months from installation), post-order changes>"]
    }}
  ],
  "pricing_table": {{
    "items": [
      {{
        "sr_no": "01",
        "description": "<DERIVE: tag_no + equipment name>",
        "moc": "<DERIVE: primary MOC>",
        "unit_price": "<DERIVE: realistic price in {currency} based on equipment size, MOC, complexity, and reference quotes>",
        "quantity": "<DERIVE: from RFQ>",
        "total_price": "<DERIVE: unit_price × quantity>"
      }}
    ],
    "subtotal": "<DERIVE: sum of all items>",
    "total_in_words": "<DERIVE: RUPEES [amount in words] ONLY>"
  }},
  "terms_and_conditions": [
    "<DERIVE: 6-8 terms covering: price basis, packing, freight, GST, delivery timeline (based on equipment complexity), payment terms, validity - use RFQ commercial_terms where specified, otherwise use standard terms appropriate for the equipment size/value>"
  ],
  "footer": {{
    "authorized_signatory": "APPLICATION ENGINEERING TEAM",
    "title": "Sr. Engineer - Application & Sales",
    "email": "sales@acmeprocess.net",
    "phone": "+91-XXXX-XXXXXX"
  }}
}}

RULES:
1. Every <DERIVE> field MUST be replaced with an actual value from the RFQ data or your engineering domain knowledge. No placeholders in output.
2. material_of_construction: Convert RFQ grades to ASTM (SS 316L→SA240 Gr 316, SS 304→SA240 Gr 304). Select bolt/gasket/support materials appropriate for the service temperature and pressure.
3. Hydrotest = 1.3 × design pressure. Show the calculated value.
4. general_notes: Write notes specific to the equipment type from this RFQ. Do NOT use generic boilerplate. Reference the actual MOC, equipment type, and scope boundaries.
5. pricing: Derive realistic {currency} pricing based on equipment size, MOC, manufacturing complexity. Use reference quotes above for calibration. If no reference, estimate based on Indian process equipment market rates for the given tonnage/MOC.
6. terms_and_conditions: If the RFQ specifies delivery timeline or payment terms, use those. Otherwise estimate delivery based on complexity (simple vessel: 8-10 weeks, reactor/column: 12-16 weeks, large/complex: 16-20 weeks).
7. nozzle_schedule: Include ALL nozzles from the RFQ with actual sizes. Assign flange ratings based on design pressure (≤10 kg/cm2g→150#, ≤25→300#, ≤40→600#).
8. If the RFQ mentions an agitator, add "agitator_details" object to the equipment item with type, power, speed, impeller, seal details.
9. Use {currency} for prices, {date_format} for dates.
10. Output ONLY the JSON object. No explanation, no markdown fences."""

    return prompt
