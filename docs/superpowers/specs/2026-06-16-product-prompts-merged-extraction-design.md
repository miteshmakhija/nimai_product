# Per-Product Prompts, Merged Extraction & Quotation Rename — Design

**Date:** 2026-06-16
**Status:** Approved for planning

## Problem

Three issues, one spec:

1. **Too many LLM calls.** A full run fires 3 LLM calls: `extract_rfq_structured` (generic structured extraction) and `extract_data_points` (product-specific fields) run back-to-back at Step 1, then `generate_quote_from_structured` at generate time. The two extraction calls are redundant — both read the same source text.

2. **No per-product generation prompts.** All runs use a single global prompt keyed `"generation"`. Different products (Pressure Vessel, Reactor, Pump) need different quotation styles, but there is no way to define a prompt per product. Product is currently *auto-detected* from extraction, never chosen by the user.

3. **Branding.** The product should read as a "Quotation" tool in the UI, not "RFQ", except where a label literally refers to the uploaded request document.

## Goals

- Collapse the two extraction calls into **one** LLM call. Net per run: 2 calls (1 extract + 1 generate), down from 3.
- Let the user **pick a product** (searchable, optional) at the Generate step. Blank is allowed.
- Store and edit a **generation prompt per product**, with a **default** used when no product is selected or the product has no prompt.
- Rename user-visible **"RFQ" → "Quotation"** in the UI, keeping "RFQ" only where the label means the uploaded source doc.

## Non-Goals

- Merging generation into the extraction call. Generation stays a separate LLM call (different task, and the confirm → data-check → generate review flow must be preserved).
- Renaming backend identifiers, API paths (`/rfqs`), routes (`/generate`, `/runs`), DB tables, or code variables. UI text only.
- Per-product *extraction* prompts. Only the **generation** prompt is product-scoped. Extraction prompt stays hardcoded in `extractor.py`.
- Touching the existing migrations `27c9e7a3bfc9`, `a1b2c3d4e5f6` (hard rule #5).

---

## Part A — Merge the two extraction calls

### Current flow

`backend/app/api/routers/rfqs.py::_build_sections()` (lines 42-98):
1. Receives already-computed `structured` (from `extract_rfq_structured`, called in the route at lines 262 / 310).
2. If `run.meta_product` is set, calls `extract_data_points(source_text, product_def.fields)` — a **second** LLM call.

So Step 1 = 2 LLM calls whenever a product is detected.

### New flow

Add one function to `backend/app/services/extractor.py`:

```python
def extract_combined(rfq_text: str, product_fields: list | None = None) -> dict:
    """Single LLM call. Returns the full structured extraction dict, plus a
    'required_product_details' sub-dict holding the product's specific fields
    (empty/absent when product_fields is None or empty)."""
```

- Builds **one** prompt = the existing `_extract_detailed` body **plus** an injected `required_product_details` block listing each product field (key + label + type) when `product_fields` is non-empty.
- One `llm.invoke`. Parses one JSON response.
- Returns the structured dict; `required_product_details` is a top-level key holding `{field_key: value_or_null}`.

`_build_sections` is refactored to **not** call the LLM. It takes the already-extracted `structured` dict (which now includes `required_product_details`) and reads product field values from `structured["required_product_details"]` instead of calling `extract_data_points`.

The route handlers (`extract_route`, `extract_text_route`) change from:
```python
structured = extract_rfq_structured(raw_text)   # call 1
... _build_sections (calls extract_data_points)  # call 2
```
to:
```python
product_def = product_service.get_product_fields(db, product_name) if product_name else None
fields = product_def.fields if product_def else None
structured = extract_combined(raw_text, fields)   # single call
... _build_sections (no LLM)
```

### Backward-compatible cleanup

- `extract_rfq_structured` and `extract_data_points` become unused by the main flow. `extract_data_points` is still imported by the live test. **Keep both functions** (live test depends on them; removing is out of scope). `extract_combined` is additive.
- The Celery pipeline (`tasks.py:42-45`) already reuses the cached extraction via the `_extraction_only` flag, so no second extraction there. Verify the cached dict now carries `required_product_details` so generation sees product values. No new call introduced.

### Edge cases

- **No product / blank:** `product_fields = None` → prompt omits the required block → behaves like today's structured-only extraction. `_build_sections` Section 2 stays empty.
- **Product set but field absent in doc:** value comes back `null`, same as today.
- **Malformed JSON:** existing try/except fallback in extractor returns a minimal dict; `required_product_details` absent → Section 2 empty, no crash.

---

## Part B — Product picker at the Generate step

### Frontend (`frontend/src/pages/GenerateRFQ.tsx`)

- Add a **searchable product dropdown** above the submit button. Source: `productsApi.list()` (already exists).
- Optional: a "— No product (use default) —" choice; blank is valid.
- On submit, pass the chosen `product_name` (or empty) to the extract call.

A lightweight searchable select: a text input that filters an absolute-positioned list of product names on type. No new dependency — match the app's existing component style (Tailwind + lucide `ChevronDown`, `Search`). Keep it a small local component in the page file or `components/`.

### API client (`frontend/src/api.ts`)

- `rfqApi.extractText(text, productName?)` → body `{ text, product_name }`.
- `rfqApi.extract(file, productName?)` → multipart field `product_name`.

### Backend (`backend/app/api/routers/rfqs.py`)

- `TextRfqRequest` schema gains optional `product_name: str | None = None`.
- `extract_route` (file) accepts a `product_name: str | None = Form(None)`.
- Both set `run.meta_product = product_name` **before** extraction (replacing the current behaviour where `meta_product` is derived from `structured["equipment_type"]` after extraction).
- **Fallback:** if `product_name` is blank, keep deriving `meta_product` from `structured.get("equipment_type")` after extraction, exactly as today — so auto-detect still works when the user doesn't pick.

### Order of operations

Because the product determines which fields go into the combined prompt, the product must be known **before** `extract_combined`. When the user picks a product, that is satisfied. When blank, we run `extract_combined(raw_text, None)` and derive `meta_product` afterward (no product fields extracted in that pass — acceptable; matches the "default" path).

---

## Part C — Per-product generation prompts (storage + lookup)

### DB change

New nullable column on `prompts`:

```python
product_name = Column(String(255), nullable=True, index=True)  # NULL = default/global prompt
```

- The existing default generation prompt: `key="generation"`, `product_name=NULL`.
- A product prompt: `key="generation"`, `product_name="Pressure Vessel"`.
- Uniqueness is now `(key, product_name)` rather than `key` alone. **Drop** the existing unique constraint on `prompts.key`; add a composite unique on `(key, product_name)`.

### Alembic migration

New revision, parent = `c3d4e5f6a7b8` (current head). Steps:
1. `add_column('prompts', Column('product_name', String(255), nullable=True))`
2. Drop unique index on `key`, create unique index on `(key, product_name)`, plus a plain index on `product_name`.

> **SQLite test note:** the `db.py` `UUID`/`JSONB` TypeDecorators and SQLite-based tests still apply. SQLite ALTER is limited; if a test DB is built from `Base.metadata.create_all` (not migrations), the model change alone suffices there. Confirm tests don't run Alembic; if they do, use `batch_alter_table` for the constraint swap.

### Model (`backend/app/models/db.py`)

- Add the `product_name` column to `Prompt`.
- Change the `key` column: remove `unique=True`; add `UniqueConstraint('key', 'product_name', name='uq_prompt_key_product')` in `__table_args__`. (TypeDecorator hard rules untouched.)

### Service (`backend/app/services/prompt_service.py`)

New lookups that respect product scoping:

```python
def get_active_content_for(db, key: str, product_name: str | None) -> str | None:
    """Return product-specific prompt content if it exists, else the default
    (product_name IS NULL) for that key."""
```

- Existing functions (`create_prompt`, `add_version`, `set_active`, `get_active_content`, `list_versions`) gain an optional `product_name` arg (default `None` = the existing global prompt), so the global path is unchanged.
- `_get_prompt` becomes `_get_prompt(db, key, product_name=None)` filtering on both columns.

### Generation (`backend/app/worker/tasks.py`)

Line 94 currently:
```python
active_prompt = prompt_service.get_active_content(db, "generation")
```
becomes:
```python
active_prompt = prompt_service.get_active_content_for(db, "generation", run.meta_product)
```
Falls back to the default prompt when the product has none.

---

## Part D — Prompts UI (ProductFields-style)

Rebuild `frontend/src/pages/PromptsEditor.tsx` to mirror the `ProductFields.tsx` two-pane layout.

### Layout

- **Left sidebar:** list of prompt scopes.
  - First row: **"Default"** (the `product_name=NULL` generation prompt).
  - One row per product that has a generation prompt.
  - **"New product prompt"** button → opens a searchable product picker (reuse the Generate dropdown component) → creates an empty product-scoped prompt.
- **Right pane:** the existing editor — textarea + change-note + Save & Activate + version history table. Unchanged behaviour, just scoped to the selected (key, product_name).

### API client (`frontend/src/api.ts` `promptApi`)

Add optional `productName` to the relevant calls:
- `promptApi.list()` → returns prompts including `product_name`.
- `promptApi.versions(key, productName?)`
- `promptApi.addVersion(key, content, note, productName?)`
- `promptApi.activate(key, versionId, productName?)`

### Backend router (`backend/app/api/routers/prompts.py`)

- Endpoints accept an optional `product_name` query/body param and pass it through to the service.
- `GET /prompts` returns `product_name` per prompt.

### Types (`frontend/src/types.ts`)

- `Prompt` gains `product_name: string | null`.

---

## Part E — RFQ → Quotation UI rename

**Scope: user-visible React strings only.** No routes, API paths, identifiers, or DB changes.

### Rule

- Replace "RFQ" → "Quotation" where it refers to the **app / product / output**:
  - "Generate RFQ" → "Generate Quotation"
  - "RFQ Repository" / "RFQ Library" → "Quotation Hub"
  - Nav labels, page `<h1>`s, card titles, buttons.
- **Keep "RFQ"** where the label means the **uploaded source request document**:
  - "Paste RFQ text", "Upload RFQ", "RFQ text" textarea label, "Paste your RFQ document text here…" placeholder.

### Files (user-facing strings)

`frontend/src/pages/*.tsx` (RfqRepository, GenerateRFQ, RfqConfirm, RfqDataCheck, RunDetail, Runs, Dashboard, Approvals), `frontend/src/components/Layout.tsx` (nav), plus any title/heading constants. Identify each string case-by-case against the rule above. Component filenames and route paths stay as-is.

### Acceptance for rename

- No route, import, or API call changes.
- Source-document labels still say "RFQ".
- All app/output labels say "Quotation"; the main library page header reads "Quotation Hub".

---

## Testing

- **Extraction merge:** unit-test `extract_combined` parsing with a mocked LLM (no live call) — assert `required_product_details` populated when fields passed, absent/empty when not. Existing `test_extraction_live.py` continues to cover the live path.
- **`_build_sections` no longer calls LLM:** test that it reads from `structured["required_product_details"]` and builds the 3 sections without invoking `get_llm`.
- **Prompt lookup:** unit-test `get_active_content_for` — returns product prompt when present, falls back to default when not.
- **Migration:** confirm upgrade/downgrade runs against a scratch Postgres; confirm SQLite test suite still green (model-only path).
- **Product picker:** manual — pick product → correct fields appear at data-check; blank → default path + auto-detected product.
- **Rename:** manual visual pass; grep for residual "RFQ" in user-facing strings vs. the keep-list.

## Rollout / order of work

1. Backend extraction merge (`extract_combined`, refactor `_build_sections`, route wiring) — behaviour-preserving when no product.
2. Product picker (frontend + API + route param).
3. Prompt scoping (migration → model → service → tasks → router → API client → types).
4. Prompts UI rebuild.
5. RFQ→Quotation rename.

Each step is independently shippable and testable.

## Hard-rule compliance

- New Alembic revision only; existing protected migrations untouched (rule #5).
- `db.py` TypeDecorators preserved (rule #1).
- No `Settings()` direct calls; `get_settings()` only.
- LLM stays lazy (`get_llm()` inside functions).
- No bcrypt/pydantic/langchain version changes.
