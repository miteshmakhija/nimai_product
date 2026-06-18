PRICING RULES

Generate commercially realistic Indian process-equipment pricing, calibrated against reference quotations when available.

REFERENCE QUOTE USAGE

If reference quotes exist:
- Use them for price range, row style, currency style, and commercial wording.
- Do not copy a reference price blindly unless the equipment, capacity, MOC, pressure, and scope are materially the same.
- For revisions such as "best price", "no regret price", or "rock bottom price", treat the latest revision as an aggressive commercial price.

PRICE DRIVERS

Consider:
- equipment type and capacity
- quantity
- MOC and grade
- shell/dish thickness
- design pressure and full vacuum service
- ASME/API/PESO compliance
- radiography and inspection scope
- internals, packing, trays, demister, distributors
- agitator motor power, seal, gearbox, shaft, impellers
- limpet, jacket, coil, insulation cleats, RF pads
- surface finish and polishing
- automation, instruments, PLC/SCADA, panels, cables
- turnkey scope, erection, commissioning, piping, skid, FAT/SAT
- freight/insurance inclusion

Relative pricing:
- SS316L > SS316 > SS304 > CS
- ASME stamped/code vessels > non-code vessels
- full vacuum vessels > atmospheric vessels
- jacketed/limpet vessels > plain vessels
- reactors with agitator > plain vessels
- polished pharma finish > industrial pickling/passivation
- automation-heavy turnkey systems > mechanical-only systems
- multi-equipment packages should include package-level logistics and integration cost

ROW FORMAT

For pricing_table.items, output rows like:
- sr_no: "01"
- description: tag number or equipment list, for example "C-1301" or "V-9301A & V-9301B"
- capacity: "10 KL" or "20.0 M2" when relevant
- moc: "SS316"
- unit_price: "INR 24,20,000/-"
- quantity: "02"
- total_price: "INR 48,40,000/-"

For package quotes with many identical tags, preserve the full tag list in description and use the aggregate quantity.

TOTALS

Always calculate:
- unit price
- quantity
- total price per row
- subtotal / TOTAL (FOR)
- amount in words

Use Indian numbering and words:
- 1,76,70,000
- RUPEES ONE CRORE SEVENTY SIX LAKHS SEVENTY THOUSAND ONLY

If exact pricing cannot be estimated safely:
- still provide a realistic budgetary price
- include "Subject to final technical confirmation" in the relevant commercial term or note

Do not output zero, blank, or "TBD" pricing unless the RFQ explicitly requests a non-priced technical offer.
