QUOTATION FORMAT RULES

The quotation JSON must contain these top-level keys:

1. header
2. offer_details
3. covering_letter
4. equipment
5. general_notes
6. pricing_table
7. terms_and_conditions
8. footer

Optional but useful when data exists:
- revision_history

HEADER

Use ACME-style letterhead metadata:
- company_name: "ACME PROCESS SYSTEMS PVT LTD, PUNE (INDIA)"
- company_address: "Plot No. E6, E-Block, Bhosari Industrial Area, Opposite NARI, Bhosari, Pune - 411026, Maharashtra, INDIA."
- certifications:
  - "CERTIFIED COMPANY BY THE AMERICAN SOCIETY OF MECHANICAL ENGINEERS (ASME U STAMP)"
  - "ISO 9001:2015 CERTIFIED COMPANY BY TUV NORD GERMANY"

OFFER DETAILS

Must include:
- offer_number
- offer_date
- prepared_by
- contact_person
- customer_name
- subject
- document_no
- issue_or_version

Offer number style:
- Prefer RFQ/reference value when available.
- Otherwise use "APSPL/<customer-code>/<sequence>/<financial-year>/R0".

Offer date style:
- Use DD-MM-YYYY, matching the sample quotations.
- Do not use ISO dates such as 2026-05-07 unless the RFQ explicitly requires that exact format.

Subject style:
- "TECHNO-COMMERCIAL OFFER FOR <EQUIPMENT/SYSTEM>"
- Use the real equipment or package name, for example "COLUMN", "REACTOR WITH AGITATOR", "COLUMN & CONDENSERS", or "TURNKEY PLANT SUPPLY".

COVERING LETTER

Create covering_letter with:
- to
- kind_attention
- subject
- salutation
- body

Use ACME sample wording:
- thank the client for the enquiry
- state that the offer is based on data / enquiry documents provided by the client
- say the detailed Techno-Commercial offer is attached / below
- close by inviting queries from the undersigned

EQUIPMENT ARRAY

Create one equipment object per distinct quoted line item or technical specification group. For grouped tag numbers with identical design, keep one equipment object and preserve the full tag list.

Each equipment item should contain:
- name
- tag_no
- moc
- capacity_or_size, if applicable
- process_and_mechanical_details
- vessel_details
- material_of_construction
- nozzle_schedule
- supports
- accessories
- surface_finish
- agitator_details, if applicable
- limpet_or_jacket_details, if applicable
- instrumentation, if applicable
- quantity

Do not include a section key with value "NA" when the whole section is not applicable. For example:
- Plain vessel: omit agitator_details.
- No automation scope: omit instrumentation.
- No limpet/jacket: omit limpet_or_jacket_details.

TABULAR DATA STYLE

The DOCX exporter renders objects as two-column tables. Therefore:
- Use concise, human-readable keys matching sample headings.
- Preserve sample-like labels such as "Operating Temperature in deg C", "Design Pressure kg/cm2 g", "Hydrotest Pressure kg/cm2 g", "Shell Inside Diameter", and "Thickness (Shell/Top/Bottom)".
- For shell/limpet or shell/tube dual conditions, include values as "Shell: ...; Limpet: ..." or use nested labels only if the downstream renderer supports them.
- Keep units inside labels or values consistently.

NOZZLE SCHEDULE

If a full nozzle table is available, use an array of objects with:
- nozzle
- description
- size_nb
- rating
- schedule_or_thickness
- quantity
- remarks

If the RFQ only says "as per MDS" or references a datasheet, set nozzle_schedule to:
- {"Nozzle Schedule": "As per MDS"}

Do not fabricate nozzle counts or sizes unless the RFQ clearly asks ACME to define the nozzle schedule. For normal generated offers, prefer "As per MDS" over invented inlet/outlet/drain/vent rows.

GENERAL NOTES

Use one or more sections:
- {"heading": "A) COLUMN:", "items": [...]}
- {"heading": "A) AGITATOR:", "items": [...]}
- {"heading": "B) VESSEL:", "items": [...]}

Generate notes that match the quoted equipment. Avoid generic notes that mention the wrong equipment type.

PRICING TABLE

Must include:
- items
- subtotal
- total_in_words

Each pricing row should include:
- sr_no
- description
- capacity, if relevant
- moc
- unit_price
- quantity
- total_price

Use Indian currency style when possible:
- "INR 11,67,000/-"
- subtotal as "INR 11,67,000/-"
- total_in_words as "RUPEES ELEVEN LAKHS SIXTY SEVEN THOUSAND ONLY"

TERMS AND CONDITIONS

Use a list of label/value objects where possible:
- {"label": "Price basis", "value": "FOR, Pithampur"}
- {"label": "Packing & Forwarding", "value": "Inclusive"}

This matches the pricing page rendering better than long free-form paragraphs.

FORMATTING CONVENTIONS

Use engineering terminology and ASME/ASTM naming conventions.

Consistent units:
- Temperature: deg C
- Pressure: kg/cm2 g or bar g, matching RFQ
- Thickness: mm
- Capacity: KL, L, M3, or M2 as applicable
- Pipe size: NB
- Flange rating: 150#, 300#, 600#

Missing value policy:
- Use "Client to confirm" for process values the client must provide.
- Use "In client scope" for excluded scope.
- Use "As per MDS" when the sample/RFQ points to an MDS.
- Use "NA" for not applicable hardware.
- Use "TBD" only when no better commercial placeholder is appropriate.

Never fabricate:
- process guarantee
- regulatory certification
- site performance guarantee
- exact nozzle schedule
- exact motor/gearbox model
- exact bought-out make
- exact delivery commitment outside normal guidance

Preserve professional techno-commercial tone.
