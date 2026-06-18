# Plan: RFQ Metadata Capture, Product Data Completeness Check, Rich Text Editor & Word Export

## Context

The current system takes a document submission and fires a full Celery pipeline immediately with no user input. Users cannot see or correct what was extracted (company name, product, RFQ number, date), there is no validation that all product-specific required data points are present, the generated quote is stored as raw JSON with no way to edit it, and there is no Word download. This plan adds:

1. A **three-step submission flow**:
   - **Step 1 — Extract**: lightweight LLM call extracts 4 metadata fields from the document
   - **Step 2 — Confirm metadata**: user reviews/edits company name, product, RFQ date, RFQ number
   - **Step 3 — Data completeness check**: system checks required fields for that product against what was found in the document; flags missing fields for user to fill in; only then does full pipeline run
2. **Per-product required field definitions** stored in Postgres (admin-configurable), different for each product
3. **Metadata + data points stored in Postgres** and shown on the Dashboard
4. A **TipTap rich-text editor** for the generated quote (in-browser editing, auto-save)
5. **Word (.docx) export** via `python-docx`

**Updated pipeline (2026-06-13):** Docling replaces PyMuPDF/pdfplumber as the document parser. Ollama/Qwen 14B is added as a dev/test LLM provider alongside Bedrock/OpenAI. No structural changes to the three-step flow.

User-confirmed decisions: three-step flow, TipTap rich text editor, per-product required fields in DB, Docling parser (Option A — drop-in, markdown export), Ollama for dev/Bedrock for prod.

---

## Part 0: Parser Swap + Dev LLM Provider (implement first)

### 0.1 — Replace `parser.py` with Docling

**Why:** Docling produces structure-aware markdown from PDF/DOCX — tables are preserved as markdown tables, headings and bullet lists intact. This gives the downstream LLM (Qwen or Bedrock) significantly better input than PyMuPDF's raw text dump, especially for RFQ PDFs with specification tables.

**What changes:**

`backend/app/services/parser.py` — replace PyMuPDF/python-docx implementation:

```python
def extract_text(file_path: str) -> str:
    """Parse document to markdown-formatted text using Docling."""
    lower = file_path.lower()

    # TXT: no layout to recover — read directly (faster, no ML models needed)
    if lower.endswith('.txt'):
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    # PDF / DOCX: Docling handles both; exports as markdown preserving tables/headings
    from docling.document_converter import DocumentConverter  # lazy — heavy ML deps
    converter = DocumentConverter()
    result = converter.convert(file_path)
    return result.document.export_to_markdown()
```

The return type stays `str`. Nothing downstream changes — `source_text` stored in DB is now richer markdown instead of flat text.

**Docling model download:** On first run, Docling downloads its layout detection models (~1.5 GB) to `~/.cache/docling`. Subsequent runs are fast (models cached). This happens in the Celery worker process on first document submission.

**`requirements.txt` changes:**
- Remove: `pymupdf`, `pdfplumber`
- Add: `docling`

`python-docx` stays — it is still used by `docx_export.py` for Word generation.

### 0.2 — Ollama/Qwen 14B as dev/test LLM provider

**Why:** Bedrock and OpenAI have per-token costs. During development and testing, all LLM calls route to a local Ollama instance running Qwen2.5:14b — zero cost, no internet needed.

**No code changes to `llm.py`** — the `ollama` provider branch is already implemented.

**`backend/.env.example`** — add new commented section:

```ini
# ── Dev/test: local Ollama with Qwen 14B (zero cost) ──────────────────────────
# Start Ollama: ollama serve
# Pull model:   ollama pull qwen2.5:14b
# Then set:
# EXTRACTOR_PROVIDER=ollama
# GENERATOR_PROVIDER=ollama
# OLLAMA_HOST=http://localhost:11434
# OLLAMA_MODEL=qwen2.5:14b
# OLLAMA_TIMEOUT=120

# ── Production: AWS Bedrock ────────────────────────────────────────────────────
# EXTRACTOR_PROVIDER=bedrock
# GENERATOR_PROVIDER=bedrock
# BEDROCK_REGION=us-east-1
# BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
```

**Verify:** `config.py` must expose `ollama_model: str = ""` in `Settings`. Check that `get_llm("extractor")` and `get_llm("generator")` both use `ollama_model` when provider is `ollama`. If `llm.py` currently hardcodes a model name for Ollama, add `model` parameter pass-through (one-line fix).

### 0.3 — Summary of file changes for Part 0

| File | Change |
|------|--------|
| `backend/app/services/parser.py` | Replace PyMuPDF/python-docx with Docling; keep TXT fast-path |
| `backend/requirements.txt` | Remove `pymupdf`, `pdfplumber`; add `docling` |
| `backend/.env.example` | Add Ollama/Qwen dev block + production Bedrock block |
| `backend/app/core/config.py` | Verify `ollama_model` field exists in `Settings`; add if missing |
| `backend/app/core/llm.py` | Verify Ollama branch uses `settings.ollama_model`; fix if hardcoded |

### 0.4 — Verification for Part 0

```powershell
# Install new deps
cd backend
pip install docling

# Smoke test parser
python -c "from app.services.parser import extract_text; print(extract_text('path/to/test.pdf')[:500])"

# Start Ollama and pull model (one-time)
ollama pull qwen2.5:14b

# Set EXTRACTOR_PROVIDER=ollama in .env, then start API
uvicorn app.api.main:app --reload --port 8000

# Submit a test PDF via the UI — confirm source_text in DB is markdown
```

---

## Part 1: Database Schema Changes

### New table: `product_required_fields`

Stores the set of required data point keys for each product type. Admins configure this via a new UI screen.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `product_name` | VARCHAR(255) NOT NULL | Matches `meta_product` value; unique |
| `fields` | JSONB NOT NULL | List of field definitions: `[{key, label, required, field_type}]` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

`field_type` is one of: `text`, `number`, `date`, `select` (with `options` list). `required: true` means the pipeline cannot start without it.

Index: `ix_product_required_fields_product_name` (unique).

### New table: `rfq_data_points`

Stores the actual collected data point values for a specific RFQ run.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `run_id` | UUID FK → `rfq_runs.id` | |
| `field_key` | VARCHAR(100) NOT NULL | Matches key in `product_required_fields.fields` |
| `field_label` | VARCHAR(255) | Human-readable label at time of capture |
| `value` | TEXT NULL | User-entered or LLM-extracted value |
| `source` | VARCHAR(20) | `"extracted"` or `"user_input"` |
| `created_at` | TIMESTAMP | |

Index: `ix_rfq_data_points_run_id`.

### New columns on `rfq_runs` (all non-breaking: nullable or server_default)

| Column | Type | Notes |
|--------|------|-------|
| `meta_company_name` | VARCHAR(255) NULL | Extracted or user-entered company |
| `meta_product` | VARCHAR(255) NULL | Equipment/product name |
| `meta_rfq_date` | VARCHAR(50) NULL | ISO date string |
| `meta_rfq_number` | VARCHAR(100) NULL | Customer's own RFQ ref |
| `meta_confirmed` | BOOLEAN NOT NULL DEFAULT FALSE | Flips to true after Step 2 |
| `data_confirmed` | BOOLEAN NOT NULL DEFAULT FALSE | Flips to true after Step 3 (all required fields filled) |
| `edited_content` | TEXT NULL | TipTap HTML, saved after user edits |
| `similar_run_ids` | JSONB NULL | List of run IDs retrieved as similar during generation; populated by Celery task after retrieval step. Enables future "show similar RFQs" UI without re-querying FAISS. |

Indexes: `ix_rfq_runs_meta_company_name`, `ix_rfq_runs_meta_product`.

### New `RunStatus` enum values

Add two new values in `db.py`:

```python
class RunStatus(str, enum.Enum):
    queued               = "queued"
    parsing              = "parsing"
    extracting           = "extracting"
    pending_confirmation = "pending_confirmation"   # NEW — awaiting Step 2 (metadata)
    pending_data         = "pending_data"           # NEW — awaiting Step 3 (data completeness)
    retrieving           = "retrieving"
    generating           = "generating"
    done                 = "done"
    failed               = "failed"
```

SQLite (tests) handles both via `create_all()` rebuild. Postgres gets them via:
```sql
ALTER TYPE run_status ADD VALUE IF NOT EXISTS 'pending_confirmation' AFTER 'extracting';
ALTER TYPE run_status ADD VALUE IF NOT EXISTS 'pending_data' AFTER 'pending_confirmation';
```

### Alembic migration

New file: `backend/alembic/versions/<hash>_add_metadata_datapoints_and_content.py`  
Revises: `27c9e7a3bfc9`  
Creates: `product_required_fields`, `rfq_data_points` tables; adds 8 new columns to `rfq_runs` (7 metadata/content + `similar_run_ids`); adds 2 enum values.  
Downgrade drops new tables and columns (enum values cannot be removed — harmless in Postgres).

---

## Part 2: Backend Services

### `backend/app/services/extractor.py` — add lightweight function

```python
def extract_rfq_metadata(rfq_text: str) -> dict:
    """Lightweight pass — returns only {customer_name, rfq_number, rfq_date, equipment_type}."""
    from app.core.llm import get_llm   # lazy import preserved
    ...
```

Uses a short focused prompt (cheaper/faster than `extract_rfq_structured`).

### `backend/app/services/extractor.py` — add data point extraction function

```python
def extract_data_points(rfq_text: str, required_fields: list[dict]) -> dict[str, str | None]:
    """
    Given the document text and a list of required field definitions,
    attempt to extract values for each field from the document.
    Returns {field_key: extracted_value_or_None}.
    """
    from app.core.llm import get_llm   # lazy import preserved
    ...
```

Prompt instructs LLM to return a JSON object with keys matching `field.key`. Values are `null` when not found. This runs synchronously in the `/rfqs/{run_id}/confirm` handler (after metadata confirmation).

### `backend/app/services/product_service.py` — new file

CRUD for `product_required_fields`:
- `get_product_fields(db, product_name) -> ProductRequiredFields | None`
- `upsert_product_fields(db, product_name, fields: list[dict]) -> ProductRequiredFields`
- `list_products(db) -> list[ProductRequiredFields]`
- `delete_product(db, product_name) -> None`

### `backend/app/services/rfq_service.py` — add helpers

- `save_metadata(db, run_id, meta: dict) -> None`
- `set_confirmed(db, run_id) -> None`  — sets `meta_confirmed=True`
- `save_data_points(db, run_id, data_points: list[dict]) -> None`  — bulk upsert into `rfq_data_points`
- `set_data_confirmed(db, run_id) -> None`  — sets `data_confirmed=True`
- `save_content(db, run_id, content: str) -> None`
- `get_data_points(db, run_id) -> list[RfqDataPoint]`
- `save_similar_ids(db, run_id, ids: list[str]) -> None`  — stores retrieved similar run IDs for future UI use

### `backend/app/services/docx_export.py` — new file

Two public functions:
- `generate_docx_from_html(html: str, run: RfqRun) -> bytes` — parses TipTap HTML with stdlib `html.parser`, emits python-docx constructs (headings, paragraphs, tables, bullet/numbered lists). `python-docx` is already in `requirements.txt`.
- `generate_docx_from_result_json(result_json: dict, run: RfqRun) -> bytes` — fallback when user has never opened the editor; produces docx directly from structured JSON.

---

## Part 3: Backend API Endpoints

### New endpoints in `backend/app/api/routers/rfqs.py`

#### `POST /rfqs/extract`  *(Step 1)*

- Accepts multipart file OR JSON `{text}`
- Creates `RfqRun` (status=`parsing`)
- Calls `parser.extract_text()` → stores in `run.source_text`
- Calls `extract_rfq_metadata(raw_text)` synchronously (~5–15s)
- Sets status=`pending_confirmation`, stores 4 metadata fields
- Returns `RfqExtractResponse` (202): run_id, status, all 4 meta fields

No Celery task enqueued yet.

#### `POST /rfqs/{run_id}/confirm`  *(Step 2 → triggers Step 3)*

Request body: `RfqConfirmRequest {meta_company_name, meta_product, meta_rfq_date, meta_rfq_number}`

- Guard: status must be `pending_confirmation` → else 409
- Guard: user must own run → else 403
- Saves confirmed metadata + sets `meta_confirmed=True`
- Looks up `product_required_fields` for confirmed `meta_product`
- If product has required field definitions: calls `extract_data_points(run.source_text, required_fields)` synchronously, saves extracted data points, sets status=`pending_data`, returns with `data_points` list
- If no product definition exists yet: sets status=`queued`, enqueues `process_rfq_task.delay(run_id=run_id)` (lazy import), returns immediately
- Returns `RfqConfirmResponse` (200): run_id, status, data_points (list of {key, label, value, source, required})

#### `POST /rfqs/{run_id}/submit-data`  *(Step 3 — user fills missing fields)*

Request body: `RfqDataSubmitRequest {data_points: [{key, value}]}`

- Guard: status must be `pending_data` → else 409
- Guard: user must own run
- Validates all required fields are now filled (from extracted + user-submitted combined)
- If any required field still missing → 422 with list of still-missing keys
- Saves user-input data points (`source="user_input"`), sets `data_confirmed=True`
- Enqueues `process_rfq_task.delay(run_id=run_id)` (lazy import inside handler)
- Sets status=`queued`
- Returns `RfqRunOut` (200)

#### `PATCH /rfqs/{run_id}/content`

Request body: `RfqContentUpdate {content: str}` (HTML string)

- Guard: status must be `done` → else 409
- Guard: user must own run
- Calls `rfq_service.save_content()`
- Returns `{run_id, status}` (200)

#### `GET /rfqs/{run_id}/export`

- Guard: status must be `done`
- If `run.edited_content` → `generate_docx_from_html(edited_content, run)`
- Else → `generate_docx_from_result_json(run.result_json, run)`
- Returns bytes with `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `Content-Disposition: attachment; filename="quote_{run_id[:8]}.docx"`

### New router: `backend/app/api/routers/products.py`

Admin-only CRUD for `product_required_fields`. Role guard: `require_role(UserRole.admin, UserRole.super_admin)`.

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/products` | List all product definitions |
| `GET` | `/products/{product_name}` | Get field definitions for one product |
| `PUT` | `/products/{product_name}` | Create or replace field definitions |
| `DELETE` | `/products/{product_name}` | Delete product definition |

Request/response uses `ProductFieldsIn` / `ProductFieldsOut` schemas. Registered in `main.py` under `/products`.

### Schema updates in `backend/app/models/schemas.py`

New schemas: `RfqExtractResponse`, `RfqConfirmRequest`, `RfqConfirmResponse`, `RfqDataSubmitRequest`, `RfqContentUpdate`, `DataPointOut`, `ProductFieldsIn`, `ProductFieldsOut`.

Update `RfqRunOut`: add 7 new fields (`meta_*`, `data_confirmed`, `edited_content`). All existing consumers receive extra fields (ignored safely).

### New SQLAlchemy models in `backend/app/models/db.py`

- `ProductRequiredFields` model (maps `product_required_fields` table)
- `RfqDataPoint` model (maps `rfq_data_points` table)
- Both use the existing `PortableUUID` and `PortableJSONB` TypeDecorators — never bare `postgresql.UUID/JSONB`

---

## Part 4: Backend Worker Changes (`tasks.py`)

### Modified `_run_pipeline(run_id: str)`

Task signature changes: only `run_id` is required (text/file_path now read from DB).  
Old positional signature `(file_path=, text=, run_id=)` is kept as a shim for in-flight tasks.

```python
def _run_pipeline(run_id: str) -> dict:
    run = rfq_service.get_run(db, rid)

    # Parsing: text already stored from extract step; skip file re-read if present
    rfq_service.set_status(db, rid, RunStatus.parsing)
    raw_text = run.source_text or extract_text(settings.uploads_dir / run.source_filename)

    # Full extraction
    rfq_service.set_status(db, rid, RunStatus.extracting)
    structured_rfq = extract_rfq_structured(raw_text)

    # Overlay confirmed metadata (user edits win — Step 2)
    if run.meta_confirmed:
        for field, col in [
            ('customer_name', run.meta_company_name),
            ('subject',       run.meta_product),
            ('rfq_date',      run.meta_rfq_date),
            ('rfq_number',    run.meta_rfq_number),
        ]:
            if col:
                structured_rfq[field] = col

    # Overlay collected data points into structured_rfq (user-confirmed values win — Step 3)
    if run.data_confirmed:
        data_points = rfq_service.get_data_points(db, run_id)
        for dp in data_points:
            structured_rfq[dp.field_key] = dp.value

    # Retrieve similar past quotes
    rfq_service.set_status(db, rid, RunStatus.retrieving)
    similar_results = retrieve_similar_structured(structured_rfq)
    # Persist similar run IDs now so future UI can show them without re-querying FAISS
    similar_ids = [r["run_id"] for r in similar_results if "run_id" in r]
    rfq_service.save_similar_ids(db, rid, similar_ids)

    # Generate → Done (unchanged)
    ...
```

---

## Part 5: Frontend Changes

### New dependencies (npm)

```
@tiptap/react @tiptap/starter-kit
@tiptap/extension-table @tiptap/extension-table-row
@tiptap/extension-table-cell @tiptap/extension-table-header
```
All must be `@tiptap/...@^2.x` at matching versions.

### New files

| File | Purpose |
|------|---------|
| `frontend/src/pages/RfqConfirm.tsx` | Step 2: Metadata confirmation form, pre-filled from router state or GET /rfqs/:id |
| `frontend/src/pages/RfqDataCheck.tsx` | Step 3: Data completeness form — shows extracted values, highlights missing required fields, lets user fill them in |
| `frontend/src/pages/RunDetail.tsx` | TipTap editor, auto-save, Download button |
| `frontend/src/components/TipTapEditor.tsx` | Reusable `useEditor` wrapper, DaisyUI toolbar |
| `frontend/src/utils/quoteJsonToHtml.ts` | `result_json → HTML` for TipTap initial load |
| `frontend/src/pages/ProductFields.tsx` | Admin page: configure required field definitions per product (CRUD) |

### `RfqConfirm.tsx` flow  *(Step 2)*

1. On mount: read metadata from router state (set by `GenerateRFQ` on navigate); fallback: `GET /rfqs/:runId`
2. Form: 4 fields (company name, product, date, RFQ number) — pre-filled, all editable
3. Submit → `rfqApi.confirm(runId, meta)`:
   - If response `status === 'pending_data'` → navigate to `/generate/data/:runId` (Step 3)
   - If response `status === 'queued'` → navigate to `/runs/:runId` (no product definition, skip to processing)
4. Uses DaisyUI `input input-bordered input-sm` + `btn btn-primary btn-sm`

### `RfqDataCheck.tsx` flow  *(Step 3)*

1. On mount: `GET /rfqs/:runId` to load `data_points` and `meta_product`
2. Renders a form grouped by field definitions:
   - Pre-fills extracted values (`source === 'extracted'`) in gray/muted style with label "Extracted from document"
   - Highlights missing required fields with `border-error` / red label "Required — not found in document"
   - Optional fields with no value shown as empty inputs
3. User fills in missing fields (or overrides extracted values)
4. Submit → `rfqApi.submitData(runId, {data_points: [{key, value}]})` → navigate to `/runs/:runId`
5. Shows progress indicator at top: `Step 3 of 3 — Confirm Data Points`
6. Uses DaisyUI `input input-bordered input-sm`, `badge badge-error badge-sm` for missing required

### `RunDetail.tsx` flow

1. `GET /rfqs/:runId` on mount + poll every 3s until status=`done`
2. Shows metadata header: company, product, date, RFQ number, status badge
3. Shows collected data points in a collapsible section (read-only, for reference during editing)
4. When `status === 'done'`:
   - If `edited_content` exists → load into TipTap
   - Else → `quoteJsonToHtml(result_json)` → load into TipTap
5. Editor changes → debounced (2s) `PATCH /rfqs/:runId/content`
6. Download button → `GET /rfqs/:runId/export` → blob → `<a download>`
7. Shows spinner/stepper while still processing (reuses `StatusBadge`)

### `TipTapEditor.tsx`

```tsx
// Props: content: string, onChange: (html: string) => void, editable?: boolean
// Extensions: StarterKit + Table + TableRow + TableCell + TableHeader
// Toolbar: Bold | Italic | BulletList | OrderedList | InsertTable (DaisyUI btn btn-ghost btn-xs)
```

### `ProductFields.tsx` flow  *(Admin only)*

1. Lists all products with configured required fields
2. Select a product (or create new): shows list of field definitions
3. Each field has: key (slug), label, type (text/number/date/select), required toggle, options (if select)
4. Add/remove/reorder fields with move-up/down buttons
5. Save → `PUT /products/:productName` — upserts the field list
6. Uses DaisyUI `table table-sm`, `input input-bordered input-sm`, `select select-bordered select-sm`, `toggle`

### Modified files

| File | Change |
|------|--------|
| `GenerateRFQ.tsx` | Submit calls `rfqApi.extract()` → on success navigate to `/generate/confirm/:runId` with state |
| `Dashboard.tsx` | Recent Runs table adds `Company` and `Product` columns |
| `Runs.tsx` | Row click navigates to `/runs/:runId` (removes inline panel) |
| `App.tsx` | Add routes: `generate/confirm/:runId`, `generate/data/:runId`, `runs/:runId`, `admin/products` (RequireRole admin) |
| `api.ts` | Add `extract()`, `confirm()`, `submitData()`, `saveContent()`, `exportDocx()` to `rfqApi`; add `productsApi` |
| `types.ts` | Add `pending_confirmation`, `pending_data` to `RunStatus`; add 7 new fields to `RfqRun`; add `DataPoint`, `ProductField`, `ProductFieldDef` interfaces |
| `StatusBadge.tsx` | `pending_confirmation` → amber "Awaiting Confirmation"; `pending_data` → orange "Data Required" (both with pulse dot) |
| `Layout.tsx` | Add "Product Fields" nav item under admin section (hidden for `end_user`) |

---

## Part 6: Future-Proofing — Similar RFQs Feature

This section documents what is being done **now** to make the future "Show Similar RFQs" feature easy to add, without implementing the UI yet.

### What is stored now

- `rfq_runs.similar_run_ids` (JSONB) — populated by the Celery task immediately after the FAISS retrieval step. Contains a list of run IDs of past completed runs that were retrieved as similar context for the generator.
- `rfq_runs.source_text` (TEXT) — the raw parsed document text, already planned. This is the input that should be embedded for similarity, not `result_json`. Ensures old runs can be re-indexed if needed.
- `ix_rfq_runs_meta_product` index — enables fast pre-filter "find similar RFQs for the same product" before doing expensive vector comparison.

### What to build when ready (NOT in this plan)

1. `GET /rfqs/{run_id}/similar` — reads `similar_run_ids`, joins to `rfq_runs` for metadata (`meta_company_name`, `meta_product`, `meta_rfq_date`, `status`), returns list. No FAISS call needed.
2. A `SimilarRfqs` panel on `RunDetail.tsx` — shown after generation completes, lists similar past runs with links to their detail pages.
3. If re-ranking is needed: a new `POST /rfqs/search` endpoint that embeds query text on the fly and queries FAISS — but `similar_run_ids` covers the common case for free.

### Key design decision

Similarity is computed against the **RFQ input** (`source_text`), not the generated quote (`result_json`). This means users submitting a new pump RFQ will find other pump RFQs — which is the right behaviour. The generator already uses `result_json` of similar runs for context; this future feature surfaces the *input* similarity to the user.

---

## Part 7: Testing

All new tests live in `backend/tests/`. Pattern: mock LLM at the service boundary, never make real LLM calls.

### `test_rfq_service.py`
- `test_save_metadata`: creates run → `save_metadata()` → assert columns set
- `test_set_confirmed`: assert `meta_confirmed` flips to True
- `test_save_data_points`: creates run → `save_data_points()` → `get_data_points()` → assert returned
- `test_set_data_confirmed`: assert `data_confirmed` flips to True
- `test_save_content`: saves HTML → reads back
- `test_save_similar_ids`: saves `["uuid-1", "uuid-2"]` → reads back from `run.similar_run_ids`

### `test_product_service.py`
- `test_upsert_product_fields`: create → `get_product_fields()` → assert returned
- `test_upsert_overwrites`: upsert twice → only latest fields stored
- `test_list_products`: create 2 products → `list_products()` → both returned
- `test_delete_product`: create → delete → `get_product_fields()` returns None

### `test_rfqs_routes.py`
- `test_extract_text_route`: monkeypatch `extract_rfq_metadata` → 202, `pending_confirmation`
- `test_confirm_route_no_product_def`: no product fields in DB → monkeypatch task → 200, status=`queued`
- `test_confirm_route_with_product_def`: product fields in DB, monkeypatch `extract_data_points` → 200, status=`pending_data`, returns data_points list
- `test_confirm_wrong_status`: run at `done` → 409
- `test_submit_data_route`: run at `pending_data` → submit all required fields → monkeypatch task → 200, status=`queued`
- `test_submit_data_missing_required`: missing a required field → 422
- `test_submit_data_wrong_status`: run at `done` → 409
- `test_save_content`: PATCH content on done run → 200
- `test_export_docx`: GET export on done run with result_json → 200, docx content-type

### `test_products_routes.py`
- `test_put_get_product`: PUT fields → GET → returned correctly (admin auth)
- `test_list_products`: multiple products → all returned
- `test_delete_product`: PUT → DELETE → GET → 404
- `test_products_require_admin`: end_user token → 403

### `test_pipeline.py`
- `test_pipeline_uses_confirmed_metadata`: mock extractor returns `{customer_name: "Original"}`; run has `meta_company_name="Override"`, `meta_confirmed=True`; assert generator called with `"Override"`
- `test_pipeline_overlays_data_points`: run has `data_confirmed=True` + data points `[{key: "pressure", value: "100 bar"}]`; assert generator called with `structured_rfq["pressure"] == "100 bar"`
- `test_pipeline_reads_source_text_from_db`: run has `source_text` set; assert `parser.extract_text` not called
- `test_pipeline_saves_similar_ids`: mock `retrieve_similar_structured` returns `[{"run_id": "abc"}]`; assert `rfq_service.save_similar_ids` called with `["abc"]`

Monkeypatching pattern (lazy imports):
```python
mock.patch('app.services.extractor.extract_rfq_metadata', return_value={...})
mock.patch('app.services.extractor.extract_data_points', return_value={...})
mock.patch('app.worker.tasks.process_rfq_task')  # then .delay on the mock
```

---

## Implementation Order

**Part 0 — Parser + Dev LLM (do first, independently verifiable):**
0a. `requirements.txt` — remove `pymupdf`, `pdfplumber`; add `docling`
0b. `parser.py` — replace with Docling implementation (keep TXT fast-path)
0c. `config.py` + `llm.py` — verify/fix Ollama `ollama_model` pass-through
0d. `.env.example` — add Ollama/Qwen dev block
0e. Smoke test: parse a real PDF, confirm markdown output; test Ollama round-trip

**Backend (Parts 1–7):**
1. `db.py` — add 2 new models (`ProductRequiredFields`, `RfqDataPoint`) + 2 enum values + 8 new columns to `RfqRun`
2. Alembic migration — `alembic revision --autogenerate` then hand-edit to add the two `ALTER TYPE` statements and fix any autogenerate quirks
3. `rfq_service.py` — 7 new helpers (including `save_similar_ids`)
4. `product_service.py` — new file with CRUD helpers
5. `extractor.py` — `extract_rfq_metadata()` + `extract_data_points()`
6. `docx_export.py` — new file
7. `schemas.py` — all new request/response schemas + update `RfqRunOut`
8. `rfqs.py` — 5 new endpoints (extract, confirm, submit-data, PATCH content, GET export), update `_out()`
9. `products.py` router — new file with 4 CRUD endpoints
10. `main.py` — register `/products` router
11. `tasks.py` — modify `_run_pipeline()` to overlay data points and save similar IDs
12. Backend tests — write and run `pytest tests/ -v`

**Frontend:**
13. `npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header`
14. `types.ts` + `api.ts` (includes `productsApi`)
15. `quoteJsonToHtml.ts` + `TipTapEditor.tsx`
16. `RfqConfirm.tsx` + `RfqDataCheck.tsx` + `RunDetail.tsx` + `ProductFields.tsx`
17. Update `GenerateRFQ.tsx`, `Dashboard.tsx`, `Runs.tsx`, `App.tsx`, `StatusBadge.tsx`, `Layout.tsx`
18. Run `npm run build` — verify clean

---

## Verification

**Backend:**
```powershell
cd backend
alembic upgrade head          # apply migration to dev Postgres
.venv\Scripts\python.exe -m pytest tests/ -v   # all tests pass
uvicorn app.api.main:app --reload --port 8000   # start API
```

**Manual E2E:**
1. Log in as `admin@nimai.ai`
2. **Admin setup first**: go to Product Fields → create a product (e.g. "Centrifugal Pump") with required fields: operating_pressure (number, required), flow_rate (number, required), fluid_type (text, required)
3. Navigate to Generate RFQ → paste or upload an RFQ document mentioning the pump
4. **Step 1 complete**: POST /rfqs/extract fires → confirmation page (Step 2) appears pre-filled
5. **Step 2**: edit company name/product → click Confirm → if product definition exists, navigate to Step 3
6. **Step 3**: data check page shows extracted values (green) and missing fields (red). Fill in missing → click Submit
7. Runs page: run transitions through statuses; company name + product visible
8. Dashboard: Recent Runs table shows company and product
9. Click a done run → TipTap editor loads with the generated quote (which now includes confirmed data points)
10. Edit text → save (auto + manual)
11. Click Download → .docx file opens in Word

**Edge case — no product definition:**  
After Step 2 confirm, if the product has no required fields configured, status jumps directly to `queued` and user is sent to `/runs/:runId` — no Step 3 shown.

**Frontend:**
```powershell
cd frontend
npm run build   # must pass clean
```
