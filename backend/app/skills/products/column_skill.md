COLUMN ENGINEERING RULES

Applicable for:
- distillation columns
- stripping columns
- absorption columns
- packed columns
- process towers
- vacuum columns

COLUMN DESIGN LOGIC

Columns are vertical cylindrical process vessels used for separation, distillation, absorption, stripping, and solvent recovery.

Typical construction:
- vertical cylindrical shell
- tori spherical top dish
- tori spherical or flanged bottom
- lug support mounted
- high height-to-diameter ratio

MANDATORY COLUMN SECTIONS

Include:
- process_and_mechanical_details
- vessel_details
- material_of_construction
- nozzle_schedule
- supports
- internals
- surface_finish
- quantity

PROCESS & MECHANICAL RULES

Use RFQ/MDS values exactly when available.

Typical defaults only when needed:
- Design Code: ASME SEC. VIII DIV. 1
- Joint Efficiency: Spot RT: 0.85; Full RT: 1.0
- Hydrotest Pressure: 1.3 x design pressure
- Corrosion Allowance: SS: NIL; CS: 1.5 mm
- Operating pressure: FV / ATM
- Design pressure: FV / 3.5 kg/cm2 g
- Design temperature: 150 deg C to 250 deg C

Use "Client to confirm" for fluid, flow rate, density, viscosity, and working capacity when absent.

COLUMN GEOMETRY RULES

Preserve:
- gross capacity
- working capacity
- tank shape
- orientation
- column inside diameter
- column height TL-TL
- top/bottom end type
- shell/top/bottom thickness
- minimum top dish end thickness

Typical dimensions:
- Diameter: 300 mm to 3000 mm
- Height: 3 m to 30 m
- Shell thickness: 5 mm to 12 mm unless RFQ says otherwise
- Dish thickness: shell + 1 mm minimum when estimating

INTERNALS RULES

Possible internals:
- liquid distributor
- liquid collector
- packing support grid
- random packing
- structured packing
- bed limiter
- demister pad
- internals

If RFQ says internals/packing are in client scope, preserve that explicitly:
- "SA240 Gr 304 (In client scope)"
- "Packing: In client scope"

If RFQ does not explicitly include internals:
- state "In client scope" rather than fabricating packing type.

SUPPORT RULES

Preferred support:
- lug support

Typical values:
- 4 to 8 lug supports
- LUG supports (EXT): IS2062 Gr B
- Lifting Lugs: IS2062 Gr B
- Earthing Boss: SA479 Gr 304
- Foundation bolts: commercial CS bolts
- Lug supports: MS + SS RF pad

FLANGE & NOZZLE RULES

Typical materials:
- Nozzle Neck: SA312 TP304/TP316
- Nozzle Flanges: SA182 F304/F316
- Body Flange: SA516 Gr 70 + SS liner
- Body Flange Gasket: PTFE
- Body Flange Bolts & Nuts: SA193 Gr B7 / SA194 Gr 2H galvanized

Flange rating guidance:
- design pressure <= 10 kg/cm2 g: 150#
- design pressure <= 25 kg/cm2 g: 300#
- design pressure <= 40 kg/cm2 g: 600#

Typical nozzles:
- feed inlet
- reflux inlet/outlet
- vent
- drain
- pressure gauge
- temperature element
- manhole
- packing charging nozzle
- sampling nozzle
- level gauge / sight glass

If nozzle schedule is unavailable and RFQ says MDS, output "As per MDS".

MATERIAL OF CONSTRUCTION RULES

Typical fields:
- Main Shell
- Body Flange
- Body Flange Gasket
- Body Flange Bolts & Nuts
- Nozzle Neck
- Nozzle Flanges
- Liquid Distributor & Collector
- Packing support Grid
- Packing
- Bolts/Nuts External
- Gasket
- LUG supports (EXT)
- Lifting Lugs
- Earthing Boss
- Internals
- RF Pad
- Insulation Nuts
- Bed Limiter
- Clits
- Foundation bolts
- LUG supports
- Manhole
- LG/SG

SURFACE FINISH RULES

Typical:
- SS Internal/External: Pickling and passivation, as per MDS
- MS: Sand blasting and painting, as per MDS
- Pharma/hygienic service: electropolishing only if specified

VACUUM SERVICE RULES

If operating/design pressure contains FV, vacuum, or torr:
- preserve full vacuum notation
- include RF pads and reinforced nozzle assumptions when listed
- avoid reducing thickness below sample/RFQ values
- include stiffening rings only if specified or clearly required and marked subject to final design

GENERAL NOTES

Create a "A) COLUMN:" notes section covering:
- vessel shall be provided with all nozzles mentioned in datasheet/MDS
- internal/external surface finish
- nozzle size/projection/orientation confirmation before order finalization and during drawing approval
- compatibility of MOC with in-column contents in client scope
- process guarantee in client scope and mechanical guarantee in ACME scope
- offer based on shared MDS/datasheet/drawings
- column packing/trays/internals in client scope when not quoted
- insulation in client scope
- material test certificates and non-Chinese origin when applicable
- installation and commissioning in client scope
- third-party inspection in client scope
- warranty 18 months from shipment or 12 months from installation, whichever is earlier
- post-order requirement/design change may lead to price implication

Never fabricate packing type, process guarantees, or detailed nozzle schedule when not provided.
