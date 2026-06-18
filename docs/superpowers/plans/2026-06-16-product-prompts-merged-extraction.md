# Per-Product Prompts, Merged Extraction & Quotation Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut a full run from 3 LLM calls to 2 by merging the two extraction calls, let users pick a product (with per-product generation prompts and a default fallback), and rename user-facing "RFQ" to "Quotation".

**Architecture:** A new `extract_combined()` service does structured + product-field extraction in one LLM call. The product is chosen at the Generate step and stored on the run before extraction. Generation prompts gain a nullable `product_name` column so a per-product prompt can override a global default. The Prompts admin page is rebuilt to mirror the two-pane ProductFields page. UI strings change "RFQ"→"Quotation" except where they name the uploaded source document.

**Tech Stack:** FastAPI + SQLAlchemy 2 + Alembic + Postgres (SQLite for tests) | React 19 + Vite + Tailwind + lucide-react | LLM via langchain.

**Spec:** `docs/superpowers/specs/2026-06-16-product-prompts-merged-extraction-design.md`

---

## Important pre-flight notes

- **Alembic head is `e5f6a7b8c9d0`** (chain: `27c9e7a3bfc9` → `a1b2c3d4e5f6` → `b2c3d4e5f6a7` → `c3d4e5f6a7b8` → `d4e5f6a7b8c9` → `e5f6a7b8c9d0`). The new migration's `down_revision` is `e5f6a7b8c9d0`. CLAUDE.md lists an older head — trust the code.
- **Hard rules:** never edit migrations `27c9e7a3bfc9` / `a1b2c3d4e5f6`; keep `db.py` UUID/JSONB TypeDecorators; tests use SQLite via `create_all` (not Alembic), so model changes alone make tests see the new column.
- **Run tests from `backend/`:** `.venv\Scripts\python.exe -m pytest tests/ -v`
- LLM is never called in tests — mock `get_llm`.

## File Structure

**Backend — create:**
- `backend/alembic/versions/f6a7b8c9d0e1_prompt_product_scope.py` — adds `prompts.product_name`, swaps unique constraint.
- `backend/tests/test_extract_combined.py` — unit tests for merged extraction (mocked LLM).
- `backend/tests/test_prompt_product_scope.py` — unit tests for product-scoped prompt lookup.

**Backend — modify:**
- `backend/app/services/extractor.py` — add `extract_combined()`.
- `backend/app/api/routers/rfqs.py` — refactor `_build_sections` (no LLM), wire `product_name` into both extract routes.
- `backend/app/models/schemas.py` — `TextRfqRequest.product_name`; `PromptOut.product_name`.
- `backend/app/models/db.py` — `Prompt.product_name` column + composite unique.
- `backend/app/services/prompt_service.py` — `product_name`-aware lookups.
- `backend/app/api/routers/prompts.py` — pass `product_name` through.
- `backend/app/worker/tasks.py` — product-scoped prompt at generate time.

**Frontend — modify:**
- `frontend/src/api.ts` — `rfqApi.extract*` accept product; `promptApi.*` accept productName.
- `frontend/src/types.ts` — `Prompt.product_name`.
- `frontend/src/pages/GenerateRFQ.tsx` — searchable product dropdown.
- `frontend/src/pages/PromptsEditor.tsx` — two-pane ProductFields-style rebuild.
- `frontend/src/components/ProductPicker.tsx` (create) — shared searchable product select.
- `frontend/src/components/Layout.tsx`, `frontend/src/pages/RfqRepository.tsx`, and other pages — "RFQ"→"Quotation" UI strings.

---

## Task 1: `extract_combined()` — single-call extraction

**Files:**
- Modify: `backend/app/services/extractor.py`
- Test: `backend/tests/test_extract_combined.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_extract_combined.py
import json
from unittest.mock import patch, MagicMock
from app.services import extractor


def _mock_llm(payload: dict):
    llm = MagicMock()
    llm.invoke.return_value = MagicMock(content=json.dumps(payload))
    return llm


def test_extract_combined_includes_product_details_when_fields_passed():
    payload = {
        "customer_name": "Acme",
        "equipment_type": "Pressure Vessel",
        "required_product_details": {"design_pressure": "10 bar", "moc": None},
    }
    fields = [
        {"key": "design_pressure", "label": "Design Pressure", "field_type": "text"},
        {"key": "moc", "label": "Material", "field_type": "text"},
    ]
    with patch("app.core.llm.get_llm", return_value=_mock_llm(payload)):
        result = extractor.extract_combined("some rfq text", fields)
    assert result["customer_name"] == "Acme"
    assert result["required_product_details"]["design_pressure"] == "10 bar"
    assert result["required_product_details"]["moc"] is None


def test_extract_combined_single_llm_call():
    payload = {"customer_name": "Acme", "equipment_type": "Pump"}
    llm = _mock_llm(payload)
    with patch("app.core.llm.get_llm", return_value=llm):
        extractor.extract_combined("text", None)
    assert llm.invoke.call_count == 1


def test_extract_combined_no_fields_omits_product_block():
    payload = {"customer_name": "Acme", "equipment_type": "Pump"}
    with patch("app.core.llm.get_llm", return_value=_mock_llm(payload)):
        result = extractor.extract_combined("text", None)
    # No product fields requested → caller treats missing key as empty
    assert result.get("required_product_details", {}) == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_extract_combined.py -v`
Expected: FAIL — `AttributeError: module 'app.services.extractor' has no attribute 'extract_combined'`

- [ ] **Step 3: Write minimal implementation**

Add to `backend/app/services/extractor.py` (after `_extract_detailed`, reuse its prompt body):

```python
def extract_combined(rfq_text: str, product_fields: list | None = None) -> dict:
    """Single LLM call: full structured extraction PLUS a required_product_details
    sub-dict for the product's specific fields. When product_fields is falsy the
    product block is omitted and the result has no required_product_details key."""
    from app.core.llm import get_llm
    llm = get_llm("extractor")

    product_block = ""
    if product_fields:
        spec = "\n".join(
            f'    "{f["key"]}": "{f.get("label", f["key"])} '
            f'({f.get("field_type", "text")}) — exact value or null"'
            for f in product_fields
        )
        product_block = (
            ',\n  "required_product_details": {\n' + spec + "\n  }"
        )

    prompt = f"""Extract ALL technical and commercial details from this RFQ document into structured JSON.
You must capture EVERY specification mentioned - do not summarize or skip any values.

Output ONLY valid JSON (no markdown, no explanation):

{{
  "customer_name": "company name of the customer sending the RFQ",
  "customer_address": "customer address if mentioned",
  "contact_person": "name of contact person if mentioned",
  "rfq_number": "RFQ reference number",
  "rfq_date": "date on the RFQ",
  "subject": "subject/title of the RFQ",
  "equipment_type": "type of equipment",
  "quantity": "number of units requested",
  "process_and_mechanical_details": {{}},
  "vessel_details": {{}},
  "material_of_construction": {{}},
  "nozzle_details": {{}},
  "surface_treatment": {{}},
  "agitator_details": {{}},
  "inspection_requirements": [],
  "delivery_requirements": {{}},
  "commercial_terms": {{}},
  "additional_requirements": [],
  "notes": "any other important information"{product_block}
}}

IMPORTANT:
- Extract EXACT values as written in the RFQ.
- Use null for fields not mentioned. Do NOT invent values.
- Preserve units as stated (mm, deg C, bar, kg/cm2, etc.).

RFQ TEXT:
{rfq_text}"""

    try:
        response = llm.invoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        text = content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
        return json.loads(text)
    except Exception as e:
        print(f"Error in extract_combined: {e}")
        return {"notes": "Failed to parse RFQ", "equipment_type": "Unknown"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python.exe -m pytest tests/test_extract_combined.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/extractor.py backend/tests/test_extract_combined.py
git commit -m "feat(extractor): add extract_combined single-call extraction"
```

---

## Task 2: Refactor `_build_sections` to not call the LLM

**Files:**
- Modify: `backend/app/api/routers/rfqs.py:42-98`
- Test: `backend/tests/test_build_sections.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_build_sections.py
from unittest.mock import MagicMock, patch
from app.api.routers import rfqs


def test_build_sections_reads_product_details_without_llm():
    db = MagicMock()
    run = MagicMock()
    run.meta_product = "Pressure Vessel"
    run.source_text = "irrelevant"
    structured = {
        "customer_name": "Acme",
        "rfq_number": "R-1",
        "required_product_details": {"design_pressure": "10 bar"},
        "vessel_details": {"Type": "Vertical"},
    }
    product_def = MagicMock()
    product_def.fields = [
        {"key": "design_pressure", "label": "Design Pressure", "required": True}
    ]
    with patch("app.api.routers.rfqs.product_service.get_product_fields",
               return_value=product_def), \
         patch("app.services.extractor.extract_data_points") as edp, \
         patch("app.core.llm.get_llm") as gl:
        rows = rfqs._build_sections(db, run, structured)
    # No LLM was used to build sections
    edp.assert_not_called()
    gl.assert_not_called()
    req = [r for r in rows if r["key"] == "required__design_pressure"]
    assert req and req[0]["value"] == "10 bar"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_build_sections.py -v`
Expected: FAIL — `edp.assert_not_called()` raises because current code calls `extract_data_points`.

- [ ] **Step 3: Write minimal implementation**

Replace the Section 2 block in `backend/app/api/routers/rfqs.py` (lines 70-86) with a read from `structured["required_product_details"]`:

```python
    # ── Section 2: Required Product Details (from product definition) ─────────
    product_def = None
    if run.meta_product:
        product_def = product_service.get_product_fields(db, run.meta_product)
    required_keys: set[str] = set()
    if product_def and product_def.fields:
        extracted_req = structured.get("required_product_details") or {}
        for f in product_def.fields:
            required_keys.add(f["key"])
            rows.append({
                "key": f"{SEC_REQUIRED}{f['key']}",
                "label": f.get("label", f["key"]),
                "value": _stringify(extracted_req.get(f["key"])),
                "source": "extracted",
                "required": f.get("required", True),
            })
```

Note: the `from app.services.extractor import extract_data_points` import inside the old block is removed.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python.exe -m pytest tests/test_build_sections.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/routers/rfqs.py backend/tests/test_build_sections.py
git commit -m "refactor(rfqs): _build_sections reads required_product_details, no LLM call"
```

---

## Task 3: Wire `product_name` into both extract routes

**Files:**
- Modify: `backend/app/models/schemas.py:154` (`TextRfqRequest`)
- Modify: `backend/app/api/routers/rfqs.py` (extract file route ~233-288, extract-text route ~291-330)

- [ ] **Step 1: Add `product_name` to the text request schema**

In `backend/app/models/schemas.py`, change:

```python
class TextRfqRequest(BaseModel):
    text: str
    product_name: Optional[str] = None
```

- [ ] **Step 2: Update the file extract route**

In `backend/app/api/routers/rfqs.py`, the `extract` route signature gains a form field, and uses `extract_combined`. Replace the route body's extraction section. Signature:

```python
from fastapi import Form  # add to existing fastapi import

@router.post("/extract", response_model=RfqExtractResponse, status_code=202)
def extract(
    file: UploadFile = File(None),
    product_name: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
```

After `run` is created and status set to extracting, replace the two-call block:

```python
    rfq_service.set_status(db, run.id, RunStatus.extracting)

    chosen_product = (product_name or "").strip() or None
    if chosen_product:
        run.meta_product = chosen_product
        db.commit()
        db.refresh(run)

    from app.services.extractor import extract_combined
    product_def = product_service.get_product_fields(db, chosen_product) if chosen_product else None
    fields = product_def.fields if product_def else None
    structured = extract_combined(raw_text, fields)

    meta = {
        "meta_company_name": structured.get("customer_name"),
        "meta_rfq_date": structured.get("rfq_date"),
        "meta_rfq_number": structured.get("rfq_number"),
    }
    # Only auto-detect product when the user didn't pick one
    if not chosen_product:
        meta["meta_product"] = structured.get("equipment_type")
    rfq_service.save_metadata(db, run.id, meta)
    rfq_service.save_extracted_json(db, run.id, structured)
    db.refresh(run)
```

(The subsequent `_build_sections` / `_persist_sections` / status / response lines stay as-is.)

- [ ] **Step 3: Update the extract-text route**

In the same file, `extract_text_route` mirrors the change. After `set_status(..., extracting)`:

```python
    chosen_product = (body.product_name or "").strip() or None
    if chosen_product:
        run.meta_product = chosen_product
        db.commit()
        db.refresh(run)

    from app.services.extractor import extract_combined
    product_def = product_service.get_product_fields(db, chosen_product) if chosen_product else None
    fields = product_def.fields if product_def else None
    structured = extract_combined(body.text, fields)

    meta = {
        "meta_company_name": structured.get("customer_name"),
        "meta_rfq_date": structured.get("rfq_date"),
        "meta_rfq_number": structured.get("rfq_number"),
    }
    if not chosen_product:
        meta["meta_product"] = structured.get("equipment_type")
    rfq_service.save_metadata(db, run.id, meta)
    rfq_service.save_extracted_json(db, run.id, structured)
    db.refresh(run)
```

- [ ] **Step 4: Run full backend suite to verify nothing broke**

Run: `.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: PASS (existing tests green; no live LLM call — these routes aren't exercised by unit tests, or are mocked).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/schemas.py backend/app/api/routers/rfqs.py
git commit -m "feat(rfqs): accept product_name at extract, single combined extraction call"
```

---

## Task 4: DB migration — `prompts.product_name` + composite unique

**Files:**
- Create: `backend/alembic/versions/f6a7b8c9d0e1_prompt_product_scope.py`
- Modify: `backend/app/models/db.py` (`Prompt` class, ~208-228)

- [ ] **Step 1: Add the column + composite unique to the model**

In `backend/app/models/db.py`, update the `Prompt` class. Change the `key` column to drop `unique=True`, add the `product_name` column, and add `__table_args__`:

```python
from sqlalchemy import UniqueConstraint  # ensure imported

class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(64), nullable=False, index=True)
    product_name = Column(String(255), nullable=True, index=True)  # NULL = default/global
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    active_version_id = Column(
        UUID(as_uuid=True),
        ForeignKey("prompt_versions.id", use_alter=True, name="fk_prompt_active_version"),
        nullable=True,
    )
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    versions = relationship(
        "PromptVersion",
        back_populates="prompt",
        foreign_keys="PromptVersion.prompt_id",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("key", "product_name", name="uq_prompt_key_product"),
    )
```

- [ ] **Step 2: Write the migration**

```python
# backend/alembic/versions/f6a7b8c9d0e1_prompt_product_scope.py
"""prompt product scope

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-16
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('prompts', sa.Column('product_name', sa.String(length=255), nullable=True))
    op.create_index('ix_prompts_product_name', 'prompts', ['product_name'])
    # Swap unique(key) -> unique(key, product_name)
    with op.batch_alter_table('prompts') as batch:
        batch.drop_constraint('prompts_key_key', type_='unique')
    op.create_unique_constraint('uq_prompt_key_product', 'prompts', ['key', 'product_name'])


def downgrade():
    op.drop_constraint('uq_prompt_key_product', 'prompts', type_='unique')
    op.drop_index('ix_prompts_product_name', table_name='prompts')
    op.create_unique_constraint('prompts_key_key', 'prompts', ['key'])
    op.drop_column('prompts', 'product_name')
```

> If the auto-named unique constraint on `key` differs from `prompts_key_key`, find it with `\d prompts` in psql and substitute the real name. Postgres default for `key = Column(..., unique=True)` is `prompts_key_key`.

- [ ] **Step 3: Verify migration applies on Postgres**

Run (from `backend/`): `.venv\Scripts\python.exe -m alembic upgrade head`
Expected: completes; `prompts` has `product_name` column and `uq_prompt_key_product`.
Then verify downgrade once: `.venv\Scripts\python.exe -m alembic downgrade -1` then `upgrade head` again.

- [ ] **Step 4: Verify SQLite test suite still builds the model**

Run: `.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: PASS — tests use `create_all`, so the new column exists; no migration run in tests.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/db.py backend/alembic/versions/f6a7b8c9d0e1_prompt_product_scope.py
git commit -m "feat(db): add prompts.product_name + composite unique (migration f6a7b8c9d0e1)"
```

---

## Task 5: Product-scoped prompt lookup in `prompt_service`

**Files:**
- Modify: `backend/app/services/prompt_service.py`
- Test: `backend/tests/test_prompt_product_scope.py` (create)

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_prompt_product_scope.py
from app.services import prompt_service


def test_product_prompt_overrides_default(db_session):
    prompt_service.create_prompt(db_session, key="generation", name="Default",
                                 content="DEFAULT")
    prompt_service.create_prompt(db_session, key="generation", name="PV",
                                 content="PV-SPECIFIC", product_name="Pressure Vessel")

    assert prompt_service.get_active_content_for(db_session, "generation", "Pressure Vessel") == "PV-SPECIFIC"


def test_falls_back_to_default_when_no_product_prompt(db_session):
    prompt_service.create_prompt(db_session, key="generation", name="Default",
                                 content="DEFAULT")
    assert prompt_service.get_active_content_for(db_session, "generation", "Unknown Product") == "DEFAULT"
    assert prompt_service.get_active_content_for(db_session, "generation", None) == "DEFAULT"
```

> Uses the existing `db_session` fixture in `backend/tests/conftest.py`. If the fixture has a different name, match it (check conftest).

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_prompt_product_scope.py -v`
Expected: FAIL — `create_prompt() got an unexpected keyword argument 'product_name'` / no `get_active_content_for`.

- [ ] **Step 3: Write minimal implementation**

Edit `backend/app/services/prompt_service.py`. Add `product_name` params and the new lookup:

```python
def create_prompt(db: Session, key: str, name: str, content: str,
                  description: str = "", created_by: UUID = None,
                  product_name: str = None) -> Prompt:
    prompt = Prompt(key=key, name=name, description=description, product_name=product_name)
    db.add(prompt)
    db.flush()
    v1 = PromptVersion(prompt_id=prompt.id, version=1, content=content, created_by=created_by)
    db.add(v1)
    db.flush()
    prompt.active_version_id = v1.id
    db.commit()
    db.refresh(prompt)
    return prompt


def _get_prompt(db: Session, key: str, product_name: str = None):
    return (db.query(Prompt)
              .filter(Prompt.key == key, Prompt.product_name == product_name)
              .first())


def add_version(db: Session, key: str, content: str, note: str = "",
                created_by: UUID = None, product_name: str = None) -> PromptVersion:
    prompt = _get_prompt(db, key, product_name)
    if not prompt:
        raise ValueError(f"Prompt '{key}' (product={product_name}) not found")
    last = (db.query(PromptVersion)
              .filter(PromptVersion.prompt_id == prompt.id)
              .order_by(PromptVersion.version.desc()).first())
    next_version = (last.version + 1) if last else 1
    ver = PromptVersion(prompt_id=prompt.id, version=next_version, content=content,
                        note=note, created_by=created_by)
    db.add(ver)
    db.commit()
    db.refresh(ver)
    return ver


def set_active(db: Session, key: str, version_id: UUID, product_name: str = None) -> Prompt:
    prompt = _get_prompt(db, key, product_name)
    if not prompt:
        raise ValueError(f"Prompt '{key}' (product={product_name}) not found")
    prompt.active_version_id = version_id
    db.commit()
    db.refresh(prompt)
    return prompt


def get_active_content(db: Session, key: str, product_name: str = None):
    prompt = _get_prompt(db, key, product_name)
    if not prompt or not prompt.active_version_id:
        return None
    ver = db.query(PromptVersion).filter(PromptVersion.id == prompt.active_version_id).first()
    return ver.content if ver else None


def get_active_content_for(db: Session, key: str, product_name: str = None):
    """Product-specific content if it exists, else the default (product_name IS NULL)."""
    if product_name:
        content = get_active_content(db, key, product_name)
        if content is not None:
            return content
    return get_active_content(db, key, None)


def list_versions(db: Session, key: str, product_name: str = None):
    prompt = _get_prompt(db, key, product_name)
    if not prompt:
        return []
    return (db.query(PromptVersion)
              .filter(PromptVersion.prompt_id == prompt.id)
              .order_by(PromptVersion.version.desc()).all())
```

(`list_prompts` stays unchanged — it lists all rows including product ones.)

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv\Scripts\python.exe -m pytest tests/test_prompt_product_scope.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/prompt_service.py backend/tests/test_prompt_product_scope.py
git commit -m "feat(prompts): product-scoped lookup with default fallback"
```

---

## Task 6: Use product-scoped prompt at generate time

**Files:**
- Modify: `backend/app/worker/tasks.py:94`

- [ ] **Step 1: Change the generate-time prompt lookup**

In `backend/app/worker/tasks.py`, line 94:

```python
        active_prompt = prompt_service.get_active_content_for(db, "generation", run.meta_product if run else None)
```

(Replaces `prompt_service.get_active_content(db, "generation")`.)

- [ ] **Step 2: Run backend suite**

Run: `.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/worker/tasks.py
git commit -m "feat(worker): generation uses product-scoped prompt with fallback"
```

---

## Task 7: Prompts router + schema pass `product_name` through

**Files:**
- Modify: `backend/app/api/routers/prompts.py`
- Modify: `backend/app/models/schemas.py` (`PromptOut`)

- [ ] **Step 1: Add `product_name` to `PromptOut`**

In `backend/app/models/schemas.py`:

```python
class PromptOut(BaseModel):
    id: str
    key: str
    product_name: Optional[str] = None
    name: str
    description: str
    active_version_id: Optional[str] = None

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Update the router to read/forward `product_name`**

Replace `backend/app/api/routers/prompts.py` body so each endpoint accepts an optional `product_name` query param and the create-on-demand for a new product prompt is supported:

```python
# app/api/routers/prompts.py
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_role
from app.models.db import UserRole, User
from app.services import prompt_service
from app.models.schemas import PromptOut, PromptVersionOut, NewVersionRequest, SetActiveRequest

router = APIRouter(prefix="/prompts", tags=["prompts"])
ManagePrompts = require_role(UserRole.admin, UserRole.super_admin)


def _ver_out(v) -> PromptVersionOut:
    return PromptVersionOut(
        id=str(v.id), version=v.version, content=v.content,
        note=v.note or "", created_at=v.created_at.isoformat(),
    )


def _prompt_out(p) -> PromptOut:
    return PromptOut(
        id=str(p.id), key=p.key, product_name=p.product_name, name=p.name,
        description=p.description or "",
        active_version_id=str(p.active_version_id) if p.active_version_id else None,
    )


@router.get("", response_model=list[PromptOut])
def list_prompts(db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    return [_prompt_out(p) for p in prompt_service.list_prompts(db)]


@router.get("/{key}/versions", response_model=list[PromptVersionOut])
def list_versions(key: str, product_name: Optional[str] = Query(None),
                  db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    return [_ver_out(v) for v in prompt_service.list_versions(db, key, product_name)]


@router.post("/{key}/versions", response_model=PromptVersionOut, status_code=201)
def add_version(key: str, body: NewVersionRequest,
                product_name: Optional[str] = Query(None),
                db: Session = Depends(get_db), user: User = Depends(ManagePrompts)):
    # Create the (key, product_name) prompt on first save if it doesn't exist yet.
    if prompt_service._get_prompt(db, key, product_name) is None:
        name = f"Generation Prompt — {product_name}" if product_name else "Generation Prompt"
        return _ver_out(
            prompt_service.create_prompt(
                db, key=key, name=name, content=body.content,
                description=body.note or "", created_by=user.id,
                product_name=product_name,
            ).versions[0]
        )
    try:
        v = prompt_service.add_version(db, key, body.content, body.note,
                                       created_by=user.id, product_name=product_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _ver_out(v)


@router.post("/{key}/activate", response_model=PromptOut)
def activate(key: str, body: SetActiveRequest,
             product_name: Optional[str] = Query(None),
             db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    try:
        p = prompt_service.set_active(db, key, UUID(body.version_id), product_name)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _prompt_out(p)
```

> `create_prompt(...).versions[0]` returns the freshly-created v1 — works because the relationship is populated after `db.refresh`. If `versions` is empty due to lazy load, refetch with `prompt_service.list_versions(db, key, product_name)[0]`.

- [ ] **Step 3: Run backend suite**

Run: `.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/routers/prompts.py backend/app/models/schemas.py
git commit -m "feat(api): prompts endpoints accept product_name, auto-create product prompt"
```

---

## Task 8: Frontend API client + types

**Files:**
- Modify: `frontend/src/api.ts` (`rfqApi`, `promptApi`)
- Modify: `frontend/src/types.ts` (`Prompt`)

- [ ] **Step 1: Update `rfqApi` extract calls**

In `frontend/src/api.ts`:

```typescript
  extract: (file: File, productName?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (productName) fd.append('product_name', productName);
    return api.post('/rfqs/extract', fd);
  },
  extractText: (text: string, productName?: string) =>
    api.post('/rfqs/extract-text', { text, product_name: productName ?? null }),
```

- [ ] **Step 2: Update `promptApi`**

```typescript
export const promptApi = {
  list: () => api.get('/prompts'),
  versions: (key: string, productName?: string) =>
    api.get(`/prompts/${key}/versions`, { params: productName ? { product_name: productName } : {} }),
  addVersion: (key: string, content: string, note: string, productName?: string) =>
    api.post(`/prompts/${key}/versions`, { content, note },
      { params: productName ? { product_name: productName } : {} }),
  activate: (key: string, version_id: string, productName?: string) =>
    api.post(`/prompts/${key}/activate`, { version_id },
      { params: productName ? { product_name: productName } : {} }),
};
```

- [ ] **Step 3: Update the `Prompt` type**

In `frontend/src/types.ts`:

```typescript
export interface Prompt {
  id: string;
  key: string;
  product_name: string | null;
  name: string;
  description: string;
  active_version_id: string | null;
}
```

- [ ] **Step 4: Typecheck**

Run (from `frontend/`): `npm run build` (or `npx tsc --noEmit`)
Expected: no type errors from these files.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.ts frontend/src/types.ts
git commit -m "feat(frontend): api client + Prompt type support product scoping"
```

---

## Task 9: Shared `ProductPicker` searchable select

**Files:**
- Create: `frontend/src/components/ProductPicker.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/components/ProductPicker.tsx
import { useEffect, useRef, useState } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { productsApi } from '../api';
import type { ProductField } from '../types';

interface Props {
  value: string | null;            // selected product name, or null
  onChange: (name: string | null) => void;
  allowNone?: boolean;             // show "No product (use default)"
  placeholder?: string;
}

export default function ProductPicker({ value, onChange, allowNone = true, placeholder = 'Select product…' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductField[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    productsApi.list().then((r) => setProducts(r.data)).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = products.filter((p) =>
    p.product_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[42px] w-full items-center justify-between rounded-[11px] border border-border bg-input-background px-3.5 text-[13px] text-foreground outline-none transition-shadow focus:border-brand focus:shadow-[0_0_0_3px_rgba(54,148,252,0.15)]"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value ?? placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-[11px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {allowNone && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] text-muted-foreground hover:bg-accent/50"
              >
                No product (use default)
                {value === null && <Check className="h-3.5 w-3.5 text-brand" />}
              </button>
            )}
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.product_name); setOpen(false); }}
                className="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] text-foreground hover:bg-accent/50"
              >
                {p.product_name}
                {value === p.product_name && <Check className="h-3.5 w-3.5 text-brand" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3.5 py-3 text-center text-xs text-muted-foreground">No products found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProductPicker.tsx
git commit -m "feat(frontend): shared searchable ProductPicker component"
```

---

## Task 10: Product dropdown in GenerateRFQ

**Files:**
- Modify: `frontend/src/pages/GenerateRFQ.tsx`

- [ ] **Step 1: Add product state + picker**

Add the import and state near the other `useState` hooks:

```tsx
import ProductPicker from '../components/ProductPicker';
// ...
  const [product, setProduct] = useState<string | null>(null);
```

In `handleSubmit`, pass the product through:

```tsx
      if (mode === 'text') {
        resp = await rfqApi.extractText(text, product ?? undefined);
      } else if (file) {
        resp = await rfqApi.extract(file, product ?? undefined);
      } else {
        return;
      }
```

- [ ] **Step 2: Render the picker above the submit button**

Insert directly before the `{error && (...)}` block in the form:

```tsx
              {/* Product selection (optional) */}
              <div className="mt-5">
                <label className="mb-2 block text-[12.5px] font-semibold tracking-[-0.01em] text-foreground">
                  Product <span className="font-normal text-muted-foreground">(optional — uses default prompt if blank)</span>
                </label>
                <ProductPicker value={product} onChange={setProduct} />
              </div>
```

- [ ] **Step 3: Typecheck + manual smoke**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.
Manual: start frontend, open `/generate`, confirm dropdown lists products and is searchable; submitting with a product selected sends `product_name`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/GenerateRFQ.tsx
git commit -m "feat(generate): optional searchable product picker"
```

---

## Task 11: Rebuild PromptsEditor (ProductFields-style, per-product)

**Files:**
- Modify: `frontend/src/pages/PromptsEditor.tsx`

- [ ] **Step 1: Rewrite the page**

Two-pane layout: left list = "Default" + each product-scoped prompt + "New product prompt" (opens `ProductPicker`); right = existing editor + version history, scoped to selected `(key='generation', product_name)`.

```tsx
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FileText, Sparkles, Loader2, Plus } from 'lucide-react';
import { promptApi } from '../api';
import type { Prompt, PromptVersion } from '../types';
import ProductPicker from '../components/ProductPicker';

const BRAND_GRADIENT =
  'bg-[linear-gradient(135deg,#3fb6fb_0%,#2f8bf6_44%,#1f6fe6_100%)]';
const GENERATION = 'generation';

export default function PromptsEditor() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  // selected scope: null = Default (product_name NULL); string = product name
  const [scope, setScope] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => { refreshList(); }, []);

  async function refreshList() {
    const r = await promptApi.list();
    // only generation-keyed prompts are product-scoped in this UI
    setPrompts(r.data.filter((p: Prompt) => p.key === GENERATION));
  }

  useEffect(() => {
    loadVersions(scope);
  }, [scope]);

  async function loadVersions(productName: string | null) {
    try {
      const r = await promptApi.versions(GENERATION, productName ?? undefined);
      setVersions(r.data);
      setContent(r.data.length > 0 ? r.data[0].content : '');
    } catch {
      setVersions([]);
      setContent('');
    }
  }

  const currentPrompt = prompts.find(
    (p) => p.key === GENERATION && (p.product_name ?? null) === scope
  );
  const activeVersion = versions.find((v) => currentPrompt && v.id === currentPrompt.active_version_id);

  async function saveVersion(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const { data } = await promptApi.addVersion(GENERATION, content, note, scope ?? undefined);
      await promptApi.activate(GENERATION, data.id, scope ?? undefined);
      setNote('');
      setMsg('Saved and activated');
      await Promise.all([loadVersions(scope), refreshList()]);
    } catch {
      setMsg('Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function activateVersion(versionId: string) {
    try {
      await promptApi.activate(GENERATION, versionId, scope ?? undefined);
      await Promise.all([loadVersions(scope), refreshList()]);
      setMsg('Activated');
    } catch {
      setMsg('Activation failed');
    }
  }

  const productPrompts = prompts.filter((p) => p.product_name);

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1140px]">
        <header className="mb-[22px]">
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">Generation Prompts</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            One default prompt, plus an optional prompt per product. Runs use the product prompt when present, else the default.
          </p>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[248px_minmax(0,1fr)]">
          {/* Scope list */}
          <div className="rounded-2xl border border-border bg-card p-3.5 shadow-[var(--elevated-shadow)]">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-[13px] font-bold text-foreground">Prompts</span>
              <button
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1 rounded-[9px] bg-brand/10 px-2.5 py-1.5 text-[12px] font-semibold text-brand"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                New
              </button>
            </div>

            {adding && (
              <div className="mb-2.5 rounded-[10px] border border-border p-2">
                <ProductPicker
                  value={null}
                  allowNone={false}
                  placeholder="Pick a product…"
                  onChange={(name) => {
                    setAdding(false);
                    if (name) { setScope(name); setContent(''); setVersions([]); }
                  }}
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <button
                onClick={() => setScope(null)}
                className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left text-[13px] transition-colors ${
                  scope === null ? 'bg-brand/10 font-semibold text-brand'
                    : 'font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
              >
                <FileText className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} />
                Default
              </button>
              {productPrompts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setScope(p.product_name)}
                  className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-left text-[13px] transition-colors ${
                    scope === p.product_name ? 'bg-brand/10 font-semibold text-brand'
                      : 'font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  }`}
                >
                  <FileText className="h-[15px] w-[15px] shrink-0" strokeWidth={1.9} />
                  {p.product_name}
                </button>
              ))}
            </div>
          </div>

          {/* Editor + history */}
          <div className="flex min-w-0 flex-col gap-[18px]">
            <form
              onSubmit={saveVersion}
              className="rounded-[18px] border border-border bg-card p-5 shadow-[var(--elevated-shadow)]"
            >
              <div className="mb-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] font-bold tracking-[-0.01em] text-foreground">
                    {scope ? `Prompt — ${scope}` : 'Default prompt'}
                  </span>
                  {activeVersion && (
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                      active · v{activeVersion.version}
                    </span>
                  )}
                </div>
                {msg && (
                  <span className={`text-[11.5px] ${msg.includes('fail') ? 'text-error' : 'text-success'}`}>{msg}</span>
                )}
              </div>

              <textarea
                rows={12}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="System prompt content…"
                className="w-full resize-y rounded-[14px] border border-border bg-input-background px-[18px] py-4 font-mono text-[12.5px] leading-relaxed text-foreground outline-none transition-[border-color,box-shadow,background] focus:border-brand focus:bg-card focus:shadow-[0_0_0_4px_rgba(54,148,252,0.15)]"
              />

              <div className="mt-3.5 flex gap-3">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Change note (optional)"
                  className="h-[42px] flex-1 rounded-[11px] border border-border bg-input-background px-3.5 text-[13px] text-foreground outline-none transition-shadow focus:border-brand focus:bg-card focus:shadow-[0_0_0_3px_rgba(54,148,252,0.15)]"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className={`inline-flex h-[42px] items-center gap-2 whitespace-nowrap rounded-[11px] px-5 text-[13px] font-bold text-white shadow-[0_8px_20px_-8px_rgba(54,148,252,0.6),inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,filter] hover:-translate-y-px hover:saturate-[1.06] disabled:opacity-60 ${BRAND_GRADIENT}`}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {busy ? 'Saving…' : 'Save & Activate'}
                </button>
              </div>
            </form>

            {versions.length > 0 && (
              <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
                <div className="border-b border-border px-[22px] py-4 text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
                  Version history
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                      <th className="px-[22px] py-3 font-semibold">Version</th>
                      <th className="px-[22px] py-3 font-semibold">Note</th>
                      <th className="px-[22px] py-3 font-semibold">Created</th>
                      <th className="px-[22px] py-3 font-semibold">Active</th>
                      <th className="px-[22px] py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((v) => {
                      const isActive = currentPrompt?.active_version_id === v.id;
                      return (
                        <tr key={v.id} className="border-b border-border text-[13px] last:border-0 hover:bg-accent/40">
                          <td className="px-[22px] py-3.5 font-mono font-medium text-foreground">v{v.version}</td>
                          <td className="px-[22px] py-3.5 text-foreground">{v.note || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-[22px] py-3.5 text-[12.5px] text-muted-foreground">{new Date(v.created_at).toLocaleString()}</td>
                          <td className="px-[22px] py-3.5">
                            {isActive && (
                              <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">Active</span>
                            )}
                          </td>
                          <td className="px-[22px] py-3.5">
                            <div className="flex gap-3.5">
                              {!isActive && (
                                <button onClick={() => activateVersion(v.id)} className="text-[12px] font-semibold text-brand hover:underline">Activate</button>
                              )}
                              <button onClick={() => setContent(v.content)} className="text-[12px] text-muted-foreground hover:text-foreground">Load</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + manual smoke**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.
Manual: `/prompts` shows "Default" + product prompts; "New" → pick product → type content → Save creates a product prompt; switching back to Default still works.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/PromptsEditor.tsx
git commit -m "feat(prompts-ui): per-product prompt editor, ProductFields-style layout"
```

---

## Task 12: RFQ → Quotation UI rename

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/RfqRepository.tsx`
- Modify: `frontend/src/pages/GenerateRFQ.tsx`
- Audit: other `frontend/src/pages/*.tsx`

**Rule:** "RFQ"→"Quotation" for app/output labels; KEEP "RFQ" where it names the uploaded source document.

- [ ] **Step 1: Layout nav + footer**

In `frontend/src/components/Layout.tsx`:
- Line 35: `label: 'RFQ Hub'` → `label: 'Quotation Hub'`
- Line 36: `label: 'Generate RFQ'` → `label: 'Generate Quotation'`
- Line 47: `'/': ['Workspace', 'RFQ Hub']` → `['Workspace', 'Quotation Hub']`
- Line 48: `'/generate': ['Workspace', 'Generate RFQ']` → `['Workspace', 'Generate Quotation']`
- Line 90: `RFQ Generator` → `Quotation Generator`

- [ ] **Step 2: RfqRepository heading**

In `frontend/src/pages/RfqRepository.tsx` line 117-119:
`Welcome to your <span className="text-brand">RFQ Hub</span>` → `Welcome to your <span className="text-brand">Quotation Hub</span>`
(Line 409 "Techno-Commercial Quotation" already correct — leave it.)

- [ ] **Step 3: GenerateRFQ headings (keep input-doc labels)**

In `frontend/src/pages/GenerateRFQ.tsx`:
- Line 89-90 `<h1>`: `Generate RFQ` → `Generate Quotation`
- KEEP: "RFQ text" label (line 163), "Paste RFQ text" toggle, "Paste your RFQ document text here…" placeholder, "Upload" labels — these describe the uploaded source.
- Line 263 button "Submit & Extract" — leave (no "RFQ").
- The right-rail "How it works" copy mentioning "your RFQ document" — KEEP (source doc).

- [ ] **Step 4: Audit remaining pages**

Run (from repo root): `git grep -n "RFQ" frontend/src` and review each hit against the rule. For each user-facing app/output label, change to "Quotation"; for source-document labels, keep. Do NOT touch: component names, imports, route strings (`/rfqs`, `/generate`), variable names, `rfqApi`.

- [ ] **Step 5: Typecheck + visual pass**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.
Manual: nav reads "Quotation Hub" / "Generate Quotation"; home header "Quotation Hub"; source-doc fields still say "RFQ".

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Layout.tsx frontend/src/pages/
git commit -m "feat(ui): rename RFQ to Quotation in app/output labels"
```

---

## Task 13: Full regression + manual end-to-end

- [ ] **Step 1: Backend suite**

Run (from `backend/`): `.venv\Scripts\python.exe -m pytest tests/ -v`
Expected: all green.

- [ ] **Step 2: Frontend build**

Run (from `frontend/`): `npm run build`
Expected: clean build.

- [ ] **Step 3: Manual end-to-end (one LLM provider set in `.env`)**

1. `/generate` → paste RFQ text, pick a product that has fields → Submit.
2. Confirm page shows metadata; data-check shows Section 2 product fields filled — verify the backend made **one** extraction call (check logs: one `extract_combined`, no `extract_data_points`).
3. Generate → draft uses the product's prompt if one exists at `/prompts`, else default.
4. Repeat with **no** product selected → default prompt used, product auto-detected from extraction.

- [ ] **Step 4: Final commit (if any doc/cleanup)**

```bash
git add -A
git commit -m "chore: regression pass for product prompts + merged extraction"
```

---

## Self-review notes (addressed)

- **Spec Part A (merge):** Tasks 1-3. `extract_rfq_structured`/`extract_data_points` kept (live test dep) per spec non-goal — only the main flow stops calling them.
- **Spec Part B (picker):** Tasks 8-10. Optional + default fallback (auto-detect when blank) preserved.
- **Spec Part C (prompts storage/lookup):** Tasks 4-7. New migration off real head `e5f6a7b8c9d0` (spec said `c3d4e5f6a7b8` — corrected here).
- **Spec Part D (Prompts UI):** Task 11.
- **Spec Part E (rename):** Task 12, keep-list for source-doc labels honored.
- **Type consistency:** `get_active_content_for`, `extract_combined`, `ProductPicker` props, `Prompt.product_name` used identically across tasks.
