TERMS & CONDITIONS GENERATION RULES

Applicable for:
- equipment quotations
- turnkey plant quotations
- process skid quotations
- ASME vessels
- reactors and agitators
- columns
- heat exchangers and condensers
- automation systems

OBJECTIVE

The terms_and_conditions section defines commercial boundaries, delivery commitments, financial terms, legal protection, warranty scope, and scope exclusions.

Generate terms that:
- sound formal and contractual
- match Indian process equipment quotation practice
- align with the sample pricing pages
- remain concise for simple equipment
- expand only when turnkey/project scope requires it

OUTPUT SHAPE

Prefer label/value objects:
- {"label": "Price basis", "value": "FOR, Pithampur"}
- {"label": "Packing & Forwarding", "value": "Inclusive"}

Use exact RFQ terms when supplied. Otherwise use standard ACME-style terms.

STANDARD SIMPLE EQUIPMENT TERMS

Generate 7 to 9 terms:
- Price basis
- Packing & Forwarding
- Insurance & Freight
- Taxes & Duties
- Delivery Time
- Payment Terms
- Validity
- Inspection, if applicable
- Warranty, if not already covered in notes

Sample style:
- Price basis: "FOR, <destination>" or "Ex-Works Pune"
- Packing & Forwarding: "Inclusive" or "Extra at actual"
- Insurance & Freight: "Inclusive" or "Extra at actual"
- Taxes & Duties: "18% GST Extra at actual." only when the RFQ/reference confirms 18%; otherwise "GST extra at actual applicable rate."
- Delivery Time: "12~14 Weeks from the date of drawing approval." If the RFQ gives delivery from order, preserve that basis.
- Payment Terms: "35% advance, 55% against PI after material readiness, 10% against delivery within 30 days."
- Validity: "10 Days." when matching sample/reference, otherwise "30 Days from the date of offer."

TURNKEY / PROJECT TERMS

For turnkey/package systems, generate 8 to 12 terms and allow longer values:
- Delivery
- Installation & Start-up
- Warranty
- Price
- Packing & Forwarding
- Taxes & Duties
- Payment Terms
- Insurance & Freight
- Local taxes/statutory charges
- Cancellation
- Changes
- Jurisdiction
- Validity

Delivery language should mention:
- drawing approval
- technically clear purchase order
- advance receipt
- buyer approval delays extending delivery
- force majeure for causes beyond seller control

Payment terms for turnkey projects should be milestone-based, for example:
- 30% advance along with purchase order
- 10% against drawing and engineering document approval
- 40% against material receipt at site on pro-rata basis
- 10% against erection at site or within 60 days from supply, whichever is earlier
- 10% against commissioning and handover or within 90 days from supply, whichever is earlier

PRICE BASIS

If RFQ specifies FOR destination, CIF, Ex-Works, or site basis, follow it.

Otherwise default:
- "Ex-Works Pune"

Common sample values:
- "FOR, Pithampur"
- "FOR, Mahad"
- "Ex-Works Pune"

GST / TAXES

Default:
- "GST extra at actual applicable rate."

Only use "18% GST Extra at actual." when RFQ/reference supports that assumption.

PACKING, FORWARDING, FREIGHT, INSURANCE

For sample-like equipment offers:
- Packing & Forwarding: "Inclusive"
- Insurance & Freight: "Inclusive" when FOR destination is used

For Ex-Works:
- Freight: "Extra at actual"
- Insurance: "Extra at actual" or "In client scope"
- Unloading: "In client scope"

DELIVERY

Typical delivery:
- simple tanks: 6~10 weeks
- reactors with agitator: 12~14 weeks
- columns: 12~16 weeks
- multi-equipment column/condenser packages: 12~20 weeks based on equipment priority
- turnkey systems: supply 20~24 weeks, total project including erection and commissioning 28~32 weeks

Delivery should start from drawing approval and advance receipt unless RFQ states otherwise.

PAYMENT TERMS

If RFQ specifies payment terms, use them.

Common sample styles:
- "35% advance, 55% against PI after material readiness, 10% against delivery within 30 days."
- "35% advance, 55% against PI after material readiness, 10% against PBG for 12 months."
- "50% advance, 50% against PI before dispatch."

Use milestone terms for turnkey projects.

WARRANTY

Default warranty:
- "18 months from the date of shipment or 12 months from the date of installation/commissioning, whichever is earlier."

If the RFQ gives a shorter or customer-specific warranty such as "12 months from commissioning", preserve it in Commercial Terms, but keep the general notes commercially protective where possible.

Protect ACME:
- mechanical warranty in ACME scope
- bought-out components back-to-back as per OEM warranty
- wear parts such as gaskets, glass, gauges, wires, probes, and mechanical seals excluded unless specified
- warranty subject to receipt of all payments

INSPECTION

Client inspection may be included.
Third-party inspection is in client scope or extra unless RFQ includes it.

SCOPE PROTECTION

Use these boundaries when applicable:
- Process guarantee in client scope.
- MOC compatibility with process fluid in client scope.
- Civil foundation in client scope.
- Utilities in client scope.
- Installation and commissioning in client scope unless included.
- Ladder/platform/insulation/packing/trays in client scope when not quoted.
- Any post-order change may lead to price and delivery implication.

LEGAL / PROJECT PROTECTION

For larger projects, include:
- cancellation charges by stage, if appropriate
- changes require written order modification
- delayed payment interest, if RFQ/reference includes it
- disputes subject to Pune jurisdiction
- force majeure delivery protection

COMMERCIAL TONE

Never:
- promise unlimited warranty
- guarantee process performance without written basis
- commit liquidated damages or penalty unless RFQ explicitly includes accepted terms
- fabricate statutory certifications
- use casual wording

Use:
- "if applicable"
- "unless otherwise specified"
- "subject to"
- "in client scope"
- "extra at actual"
- "from the date of drawing approval"
