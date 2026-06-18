VESSEL / TANK ENGINEERING RULES

Applicable for:
- storage tanks
- process vessels
- receivers
- flash vessels
- vertical cylindrical tanks
- solvent storage tanks

MANDATORY SECTIONS

Include:
- process_and_mechanical_details
- vessel_details
- material_of_construction
- nozzle_schedule
- accessories
- supports
- surface_finish
- quantity

Do not include agitator_details for a plain vessel/tank. Omit non-applicable optional sections instead of setting them to "NA".

PROCESS & MECHANICAL DETAILS

Use RFQ/MDS values exactly when provided.

Typical defaults only when not specified:
- Design Code: ASME SEC. VIII DIV. 1 for pressure vessels
- API 650 along with PESO norms for large atmospheric solvent storage tanks when applicable
- Corrosion Allowance: SS: NIL; CS: 1.5 mm
- Joint Efficiency: Spot RT: 0.85; Full RT: 1.0
- Hydrotest Pressure: 1.3 x design pressure for pressure vessels; Full of water for atmospheric tanks

Use "Client to confirm" for fluid, density, viscosity, and working capacity when absent.

VESSEL DETAILS

Preserve:
- gross capacity
- working capacity
- tank shape
- orientation
- inside diameter
- shell height / TL-to-TL
- shell thickness
- top and bottom dish type
- top and bottom dish thickness

Typical geometry:
- Cylindrical / Vertical
- Tori spherical ends for pressure vessels
- Conical top / flat bottom possible for storage tanks

MATERIAL OF CONSTRUCTION

Convert common grades:
- SS304 -> SA240 Gr 304
- SS316 -> SA240 Gr 316
- SS316L -> SA240 Gr 316L
- CS pressure parts -> SA516 Gr 70 where appropriate

Typical vessel materials:
- Shell: same as primary MOC
- Top/Bottom Dish End: same as primary MOC
- Nozzle Neck: SA312 TP304/TP316 seamless up to 150 NB
- Nozzle Flanges: SA182 F304/F316, SORF/BLRF as required
- Nozzle pipe above 150 NB: plate nozzle in matching plate grade where applicable
- Gasket: PTFE for solvent/stainless service; CAF for utility service
- External bolts/nuts: SA193 Gr B8 / SA194 Gr 8 for stainless service
- Supports: IS2062 Gr B or MS with SS RF pad
- Earthing Boss: SA479 Gr 304
- RF Pad: matching shell MOC

NOZZLE RULES

If RFQ provides a nozzle table, preserve all nozzles with size, rating, schedule/thickness, quantity, and remarks.

If RFQ states "As per MDS", use:
- {"Nozzle Schedule": "As per MDS"}

Typical nozzles only when the RFQ explicitly asks ACME to define them:
- manhole
- inlet
- outlet
- vent
- drain
- level gauge / sight glass
- pressure gauge
- temperature element
- spare

Flange rating guidance:
- design pressure <= 10 kg/cm2 g: 150#
- design pressure <= 25 kg/cm2 g: 300#
- design pressure <= 40 kg/cm2 g: 600#

ACCESSORIES & SUPPORTS

Common accessories:
- lifting lugs
- earthing boss
- lug supports
- skirt support for large vertical storage tanks
- insulation cleats when insulation is expected
- foundation bolts

SURFACE FINISH

SS industrial:
- Internal: Pickling and passivation or 180/240 grit matt finish as RFQ states
- External: Pickling and passivation, 120 grit matt finish, or as MDS

MS/CS:
- Sand blasting and painting as per MDS

GENERAL NOTES

Include vessel-specific notes:
- vessel shall be provided with all nozzles mentioned in datasheet/MDS
- nozzle orientation/size/projection to be confirmed before order finalization and finalized during drawing approval
- compatibility of MOC with process contents in client scope
- process guarantee in client scope and mechanical guarantee in ACME scope
- insulation, ladder/platform, installation, commissioning, and third-party inspection in client scope unless included
- material test certificates shall be provided; non-Chinese origin when required by sample/RFQ
- warranty 18 months from shipment or 12 months from installation/commissioning, whichever is earlier
- post-order changes may lead to price implication

Never fabricate process guarantees, exact nozzle schedules, or site performance guarantees.
