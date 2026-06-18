TURNKEY / SKID / PLANT PACKAGE RULES

Applicable for:
- turnkey plant supply
- process skids
- modular systems
- integrated equipment packages
- automation packages
- solvent storage and handling systems

PACKAGE STRUCTURE

A turnkey quote should behave like a project package, not a single equipment quote.

Group equipment by system when possible, for example:
- Solvent Storage Tank System
- Reactor System
- Column/Condenser System
- Utility System
- Piping and Valve Package
- Instrumentation and Automation

Each major equipment group should still create equipment objects when technical tables are available.

INSTRUMENTATION RULES

Generate a grouped instrumentation section when RFQ includes instruments.

Typical instruments:
- pressure gauge
- temperature gauge
- pressure transmitter
- level transmitter
- flow transmitter
- load cell
- control valve actuator

Typical makes only when RFQ requests vendor proposal or sample includes them:
- Yokogawa
- Vega
- Endress+Hauser
- Siemens

Explosion-proof systems:
- use FLP-compatible instruments and panels only when solvent/hazardous area is specified.

AUTOMATION RULES

If RFQ references PLC, SCADA, automation, batch system, or control panel, include:
- PLC panel
- HMI
- SCADA workstation
- field instruments
- junction boxes
- cable trays
- cabling/termination scope split

Typical PLC makes only when needed:
- Siemens
- Allen Bradley
- Delta

Do not fabricate automation logic or recipes.

SURFACE FINISH RULES

Typical finishes:
- Internal SS: pickling and passivation, 180/240 grit matt finish, or electropolishing when specified
- External SS: matt finish or pickling and passivation
- MS/CS external: sand blasting and painting
- Pharma systems: electropolishing only if RFQ specifies hygienic/pharma finish

VACUUM & SOLVENT SYSTEM RULES

If service contains solvent, DMF, ACN, vacuum, FV, torr, or hazardous area language:
- preserve solvent names and design conditions
- use PTFE gaskets for wetted stainless joints unless RFQ states otherwise
- include earthing bosses
- consider FLP compatibility for electricals when RFQ requires it
- do not invent PESO scope unless RFQ/sample explicitly calls for it

ACCESSORY RULES

Typical accessories:
- lifting lugs
- lug supports
- skirt supports
- earthing bosses
- platforms and ladders, if included
- insulation supports/cleats
- RF pads
- foundation bolts

SCOPE SPLIT RULES

Always distinguish:

ACME Scope:
- fabrication quality
- pressure integrity
- dimensional compliance
- mechanical guarantee for ACME-manufactured equipment
- quoted erection/commissioning when included

Client Scope:
- process guarantee
- MOC compatibility with process fluid
- utility availability
- civil work/foundations
- statutory approvals unless included
- installation consumables
- site readiness
- unloading/storage/security

GENERAL NOTES

Generate turnkey-specific notes covering:
- offer basis: RFQ, MDS, drawings, discussions, and shared datasheets
- mechanical guarantee and process guarantee split
- utilities required for operation in client scope
- site readiness before erection/start-up
- civil foundation in client scope
- installation and commissioning scope
- MOC compatibility
- insulation, painting, ladder/platform, and piping scope
- instrument calibration and control panel scope
- third-party inspection and statutory compliance
- transportation quantity assumptions
- post-order changes causing price/delivery implication

DELIVERY RULES

Delivery estimation should consider:
- equipment count
- automation scope
- piping scope
- ASME/API/PESO compliance
- skid assembly complexity
- site erection and commissioning

Typical delivery:
- small turnkey skid: 12~16 weeks
- medium plant: 16~24 weeks
- large integrated plant: 24~40 weeks
- sample-like turnkey supply: 22 weeks ex-works after drawing approval and advance; total project including erection and commissioning about 30 weeks

PRICING RULES

Pricing should consider:
- equipment quantity
- piping tonnage
- instrumentation count
- automation complexity
- polishing requirements
- FAT/SAT scope
- ASME/API/PESO compliance
- modularization complexity
- erection and commissioning
- freight/insurance basis

Relative pricing:
- automation-heavy systems > mechanical-only systems
- SS316/SS316L > SS304
- pharma systems > industrial systems
- explosion-proof systems > standard systems
- turnkey systems > loose equipment supply

TURNKEY OUTPUT EXPECTATIONS

The generated quotation must:
- preserve system hierarchy
- avoid duplicated utility descriptions
- group reusable commercial sections
- maintain clear scope split
- avoid mixing client/vendor responsibilities
- avoid fabricated process guarantees
- mark unknowns as "Client to confirm", "In client scope", "Subject to final engineering", or "TBD"
