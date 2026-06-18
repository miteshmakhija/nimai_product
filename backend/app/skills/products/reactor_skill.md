REACTOR / AGITATED VESSEL ENGINEERING RULES

Applicable for:
- reactors
- agitated vessels
- reactors with agitator
- limpet coil reactors
- jacketed vessels

MANDATORY SECTIONS

Include all vessel/tank sections plus:
- agitator_details when agitator is in RFQ
- limpet_or_jacket_details when limpet, jacket, or coil is in RFQ
- baffles and internals in material_of_construction when applicable

REACTOR PROCESS DETAILS

Preserve RFQ values for:
- operating temperature
- design temperature
- operating pressure
- design pressure
- full vacuum / FV condition
- hydrotest pressure
- corrosion allowance
- density
- viscosity
- design code

Use "Client to confirm" for process fluid when absent.

Typical defaults:
- Design Code: ASME SEC. VIII DIV. 1
- Joint Efficiency: 0.85/1 for spot shell and full dish/T-joints when consistent with RFQ
- Hydrotest Pressure: 1.3 x design pressure
- Corrosion Allowance: follow RFQ; otherwise SS: NIL or 1 mm when RFQ/sample indicates

AGITATOR DETAILS

If agitator is specified, add agitator_details with as many known values as possible:
- Agitator Model
- Motor Rating & make
- Gearbox Model & Make
- Reduction Ratio
- Safety Factor
- Impeller Type
- Impeller Diameter
- RPM
- Tip Speed
- Shaft Diameter
- Shaft Length
- Shaft Sealing / Make
- Rigid Coupling
- Flexible Coupling
- Bearing Housing
- Lantern Stool
- MOC

Do not invent exact model numbers, bought-out makes, motor make, gearbox make, seal make, or shaft dimensions. Use "TBD" or "Client to confirm" when absent.

Agitator selection guidance only when RFQ asks ACME to propose:
- Low viscosity: pitched blade turbine
- Medium viscosity: hydrofoil or PBT
- High viscosity: anchor agitator
- Solvent/hazardous service: FLP motor and suitable mechanical seal

Seal guidance:
- Solvent/hazardous service: double mechanical seal unless RFQ specifies single mechanical seal
- Nonhazardous service: single mechanical seal

LIMPET / JACKET RULES

If limpet is specified, include:
- Limpet OD
- Limpet pitch
- Limpet thickness
- Number of turns
- Limpet MOC
- Limpet nozzle pipe/flange
- limpet design temperature/pressure if RFQ gives separate shell/limpet conditions

If limpet is excluded, state "Limpet is not considered in above offer" in general notes.

REACTOR MATERIALS

Typical fields:
- Shell
- Top/Bottom Dish End
- Baffles
- Limpet Coil
- Nozzle Neck
- Nozzle Flanges
- Nozzle dip pipe
- Nozzle Gaskets
- Body Flange
- Manhole
- Lug support
- Wing Nuts & Bolts
- RF Pad
- Internals
- Lifting Lug
- Earthing Boss
- Insulation cladding
- Insulation
- Foundation Bolt
- Gasket

SURFACE FINISH

Typical:
- SS Internal/External: 240 grit / pickling and passivation, or as MDS
- MS: sand blasting and painting

GENERAL NOTES

When agitator is included, create an "A) AGITATOR:" section with notes covering:
- top entry center mounting
- motor rating / FLP / VFD assumptions if supplied
- gearbox type and make if supplied
- shaft seal type and responsibility limits
- field wiring, control panel, and termination in client scope unless quoted
- first fill gearbox oil in ACME scope when offered

Create a vessel/reactor notes section covering:
- nozzles as per datasheet/MDS
- nozzle projection/orientation confirmation
- MOC compatibility in client scope
- process design guarantee in client scope
- mechanical guarantee in ACME scope
- insulation/limpet/control panel exclusions when applicable
- installation and commissioning in client scope unless included
- supervision extra on per man-day basis only if RFQ/reference requires it
- warranty and post-order change price implication
