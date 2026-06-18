# Status Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unified combined status badge across Runs list + two new customer lifecycle states (sent_to_customer, customer_approved) + date range filter.

**Architecture:** Extend `ApprovalState` enum in DB + Python models → add two new API endpoints → update `RfqRunOut` schema → update frontend types, `StatusBadge`, `Runs`, `RunDetail`, `api.ts`. `getCombinedStatus(run)` is the single source of truth for display logic, imported by both `StatusBadge` and `Runs`.

**Tech Stack:** FastAPI · SQLAlchemy 2 · Alembic · React 19 · TypeScript · Tailwind v4 · DaisyUI v5

---

## File Map

| File | Change |
|---|---|
| `backend/alembic/versions/d4e5f6a7b8c9_customer_lifecycle.py` | CREATE — new migration |
| `backend/app/models/db.py` | MODIFY — extend `ApprovalState` enum + 2 columns on `RfqRun` |
| `backend/app/models/schemas.py` | MODIFY — extend `RfqRunOut` with 2 new optional fields |
| `backend/app/api/routers/rfqs.py` | MODIFY — add `mark-sent` + `mark-customer-approved` endpoints, update `_run_to_out` |
| `backend/tests/test_rfqs_routes.py` | MODIFY — add 4 new tests |
| `frontend/src/types.ts` | MODIFY — extend `ApprovalState` union + `RfqRun` fields |
| `frontend/src/components/StatusBadge.tsx` | MODIFY — replace map logic with `getCombinedStatus`, export it |
| `frontend/src/pages/Runs.tsx` | MODIFY — new filters + date range |
| `frontend/src/pages/RunDetail.tsx` | MODIFY — mark-sent + customer-approved UI |
| `frontend/src/api.ts` | MODIFY — add `markSent` + `markCustomerApproved` |

---

## Task 1: DB model + migration

**Files:**
- Create: `backend/alembic/versions/d4e5f6a7b8c9_customer_lifecycle.py`
- Modify: `backend/app/models/db.py`

- [ ] **Step 1: Extend `ApprovalState` enum in `db.py`**

In `backend/app/models/db.py`, change:
```python
class ApprovalState(str, enum.Enum):
    """Denormalized approval status on RfqRun for cheap UI reads."""
    none = "none"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    changes_requested = "changes_requested"
```
To:
```python
class ApprovalState(str, enum.Enum):
    """Denormalized approval status on RfqRun for cheap UI reads."""
    none = "none"
    in_review = "in_review"
    approved = "approved"
    rejected = "rejected"
    changes_requested = "changes_requested"
    sent_to_customer = "sent_to_customer"
    customer_approved = "customer_approved"
```

- [ ] **Step 2: Add two columns to `RfqRun` in `db.py`**

After the `approval_state` column definition (around line 281), add:
```python
    # Customer lifecycle — set after internal approval
    customer_approved_at = Column(DateTime, nullable=True)
    customer_po_reference = Column(String(120), nullable=True)
```

- [ ] **Step 3: Write the Alembic migration**

Create `backend/alembic/versions/d4e5f6a7b8c9_customer_lifecycle.py`:
```python
"""customer_lifecycle — sent_to_customer + customer_approved states

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-15 00:00:00.000000

Adds:
- Two new approval_state enum values: sent_to_customer, customer_approved
- customer_approved_at (DateTime, nullable) on rfq_runs
- customer_po_reference (String(120), nullable) on rfq_runs
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    if is_pg:
        op.execute("ALTER TYPE approval_state ADD VALUE IF NOT EXISTS 'sent_to_customer'")
        op.execute("ALTER TYPE approval_state ADD VALUE IF NOT EXISTS 'customer_approved'")

    op.add_column('rfq_runs', sa.Column('customer_approved_at', sa.DateTime(), nullable=True))
    op.add_column('rfq_runs', sa.Column('customer_po_reference', sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column('rfq_runs', 'customer_po_reference')
    op.drop_column('rfq_runs', 'customer_approved_at')
    # Postgres enum values cannot be removed without recreation — leave enum as-is on downgrade
```

- [ ] **Step 4: Run migration**

```bash
cd backend
.venv\Scripts\alembic upgrade head
```

Expected output: `Running upgrade c3d4e5f6a7b8 -> d4e5f6a7b8c9, customer_lifecycle`

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/d4e5f6a7b8c9_customer_lifecycle.py backend/app/models/db.py
git commit -m "feat(db): extend ApprovalState with sent_to_customer + customer_approved"
```

---

## Task 2: Backend schema + endpoints

**Files:**
- Modify: `backend/app/models/schemas.py`
- Modify: `backend/app/api/routers/rfqs.py`

- [ ] **Step 1: Update `RfqRunOut` schema**

In `backend/app/models/schemas.py`, add two fields to `RfqRunOut` after `approval_state`:
```python
    approval_state: str = "none"
    customer_approved_at: Optional[str] = None
    customer_po_reference: Optional[str] = None
```

- [ ] **Step 2: Update `_run_to_out` in `rfqs.py`**

In `backend/app/api/routers/rfqs.py`, find the `_run_to_out` function and add the two new fields to its `RfqRunOut(...)` call. The full updated call:
```python
    return RfqRunOut(
        id=str(run.id),
        status=run.status.value,
        input_type=run.input_type.value,
        source_filename=run.source_filename,
        created_at=run.created_at.isoformat(),
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        error=run.error,
        result_json=run.result_json,
        meta_company_name=run.meta_company_name,
        meta_product=run.meta_product,
        meta_rfq_date=run.meta_rfq_date,
        meta_rfq_number=run.meta_rfq_number,
        meta_confirmed=run.meta_confirmed,
        data_confirmed=run.data_confirmed,
        edited_content=run.edited_content,
        similar_run_ids=run.similar_run_ids,
        data_points=dps,
        approval_state=run.approval_state.value if run.approval_state else "none",
        customer_approved_at=run.customer_approved_at.isoformat() if run.customer_approved_at else None,
        customer_po_reference=run.customer_po_reference,
    )
```

- [ ] **Step 3: Add request body schema for customer-approved endpoint**

In `backend/app/models/schemas.py`, add after `RfqRunOut`:
```python
class CustomerApprovedRequest(BaseModel):
    customer_approved_at: str  # ISO date string e.g. "2026-06-15"
    customer_po_reference: Optional[str] = None
```

- [ ] **Step 4: Add `mark-sent` endpoint to `rfqs.py`**

Add this endpoint near the bottom of `rfqs.py`, before the closing of the file:
```python
@router.post("/{run_id}/mark-sent", response_model=RfqRunOut)
def mark_sent_to_customer(
    run_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.approval_state != ApprovalState.approved:
        raise HTTPException(
            status_code=400,
            detail="Run must be internally approved before marking as sent to customer",
        )
    run.approval_state = ApprovalState.sent_to_customer
    db.commit()
    db.refresh(run)
    return _run_to_out(run)
```

- [ ] **Step 5: Add `mark-customer-approved` endpoint to `rfqs.py`**

```python
@router.post("/{run_id}/mark-customer-approved", response_model=RfqRunOut)
def mark_customer_approved(
    run_id: str,
    body: CustomerApprovedRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import datetime as dt
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.approval_state != ApprovalState.sent_to_customer:
        raise HTTPException(
            status_code=400,
            detail="Run must be marked as sent to customer before recording customer approval",
        )
    try:
        run.customer_approved_at = dt.fromisoformat(body.customer_approved_at)
    except ValueError:
        raise HTTPException(status_code=422, detail="customer_approved_at must be a valid ISO date")
    run.customer_po_reference = body.customer_po_reference
    run.approval_state = ApprovalState.customer_approved
    db.commit()
    db.refresh(run)
    return _run_to_out(run)
```

- [ ] **Step 6: Add missing imports to `rfqs.py`**

Ensure `CustomerApprovedRequest` is imported from schemas at the top of `rfqs.py`. Find the existing schemas import line and add it:
```python
from app.models.schemas import (
    RfqRunOut, TextRfqRequest, RfqExtractResponse,
    DataPointInput, ConfirmRequest, SubmitDataRequest,
    CustomerApprovedRequest,
)
```

Also ensure `ApprovalState` is imported from `app.models.db`. Check existing imports — if not present, add:
```python
from app.models.db import (
    RfqRun, RfqDataPoint, InputType, RunStatus, ApprovalState,
    # ... other existing imports
)
```

- [ ] **Step 7: Start backend and verify endpoints exist**

```bash
cd backend
.venv\Scripts\uvicorn.exe app.main:app --reload
```

Then in another terminal:
```bash
curl -s http://localhost:8000/openapi.json | python -c "import sys,json; paths=json.load(sys.stdin)['paths']; print([p for p in paths if 'mark' in p])"
```
Expected: `['/rfqs/{run_id}/mark-sent', '/rfqs/{run_id}/mark-customer-approved']`

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/schemas.py backend/app/api/routers/rfqs.py
git commit -m "feat(api): add mark-sent and mark-customer-approved endpoints"
```

---

## Task 3: Backend tests

**Files:**
- Modify: `backend/tests/test_rfqs_routes.py`

- [ ] **Step 1: Add helper to create an approved run**

At the top of `test_rfqs_routes.py`, add after existing helpers:
```python
def _make_approved_run(db_session, user_id):
    from app.models.db import ApprovalState
    run = rfq_service.create_run(db_session, submitted_by=user_id, input_type=InputType.text,
                                  source_text="test rfq")
    rfq_service.complete_run(db_session, run.id, {"quote": "test"})
    run.approval_state = ApprovalState.approved
    db_session.commit()
    db_session.refresh(run)
    return run


def _make_sent_run(db_session, user_id):
    from app.models.db import ApprovalState
    run = _make_approved_run(db_session, user_id)
    run.approval_state = ApprovalState.sent_to_customer
    db_session.commit()
    db_session.refresh(run)
    return run
```

- [ ] **Step 2: Write the four tests**

```python
def test_mark_sent_happy_path(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = _make_approved_run(db_session, user.id)
    r = client.post(f"/rfqs/{run.id}/mark-sent", headers=hdrs)
    assert r.status_code == 200
    assert r.json()["approval_state"] == "sent_to_customer"


def test_mark_sent_wrong_state(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = rfq_service.create_run(db_session, submitted_by=user.id, input_type=InputType.text,
                                  source_text="test rfq")
    r = client.post(f"/rfqs/{run.id}/mark-sent", headers=hdrs)
    assert r.status_code == 400
    assert "internally approved" in r.json()["detail"]


def test_mark_customer_approved_happy_path(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = _make_sent_run(db_session, user.id)
    r = client.post(f"/rfqs/{run.id}/mark-customer-approved", headers=hdrs, json={
        "customer_approved_at": "2026-06-15",
        "customer_po_reference": "PO-1234",
    })
    assert r.status_code == 200
    data = r.json()
    assert data["approval_state"] == "customer_approved"
    assert data["customer_po_reference"] == "PO-1234"
    assert "2026-06-15" in data["customer_approved_at"]


def test_mark_customer_approved_wrong_state(client, db_session):
    hdrs = _user_headers(client, db_session)
    from app.models.db import User as DbUser
    user = db_session.query(DbUser).filter(DbUser.email == "u@test.com").first()
    run = _make_approved_run(db_session, user.id)
    r = client.post(f"/rfqs/{run.id}/mark-customer-approved", headers=hdrs, json={
        "customer_approved_at": "2026-06-15",
    })
    assert r.status_code == 400
    assert "sent to customer" in r.json()["detail"]
```

- [ ] **Step 3: Run the tests**

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/test_rfqs_routes.py -v -k "mark"
```

Expected: 4 tests PASS

- [ ] **Step 4: Run full test suite**

```bash
.venv\Scripts\python.exe -m pytest tests/ -v
```

Expected: all tests pass (no regressions)

- [ ] **Step 5: Commit**

```bash
git add backend/tests/test_rfqs_routes.py
git commit -m "test: add mark-sent and mark-customer-approved route tests"
```

---

## Task 4: Frontend types + `getCombinedStatus`

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/components/StatusBadge.tsx`

- [ ] **Step 1: Update `types.ts`**

Change the `approval_state` field on `RfqRun`:
```typescript
  approval_state?: 'none' | 'in_review' | 'approved' | 'rejected' | 'changes_requested' | 'sent_to_customer' | 'customer_approved';
  customer_approved_at?: string | null;
  customer_po_reference?: string | null;
```

- [ ] **Step 2: Rewrite `StatusBadge.tsx`**

Replace the entire file content:
```typescript
import type { RfqRun } from '../types';

export interface CombinedStatus {
  label: string;
  cls: string;       // DaisyUI badge class OR custom tailwind classes
  pulse: boolean;
}

const PROCESSING = new Set(['queued', 'parsing', 'extracting', 'retrieving', 'generating']);
const ACTION_REQUIRED = new Set(['pending_confirmation', 'pending_data']);

export function getCombinedStatus(run: RfqRun): CombinedStatus {
  if (PROCESSING.has(run.status)) {
    return { label: 'Processing…', cls: 'badge-info', pulse: true };
  }
  if (ACTION_REQUIRED.has(run.status)) {
    return { label: 'Action Required', cls: 'badge-warning', pulse: true };
  }
  if (run.status === 'failed') {
    return { label: 'Failed', cls: 'badge-error', pulse: false };
  }
  const state = run.approval_state ?? 'none';
  if (state === 'in_review') {
    return { label: 'Awaiting Approval', cls: 'badge-warning', pulse: true };
  }
  if (state === 'changes_requested') {
    return { label: 'Changes Requested', cls: 'badge-error', pulse: false };
  }
  if (state === 'approved') {
    return { label: 'Approved', cls: 'badge-success', pulse: false };
  }
  if (state === 'sent_to_customer') {
    return { label: 'Sent to Customer', cls: 'badge-info', pulse: false };
  }
  if (state === 'customer_approved') {
    return { label: 'Customer Approved', cls: 'bg-emerald-500/15 text-emerald-600', pulse: false };
  }
  // done + no approval
  return { label: 'Quote Ready', cls: 'badge-ghost', pulse: false };
}

export function StatusBadge({ status, run }: { status?: string; run?: RfqRun }) {
  // Support legacy `status` string prop (for backwards compat during transition) OR full run object
  if (run) {
    const { label, cls, pulse } = getCombinedStatus(run);
    const isDaisyUI = cls.startsWith('badge-');
    return (
      <span className={`badge badge-sm gap-1 ${isDaisyUI ? cls : ''} ${!isDaisyUI ? cls : ''}`}>
        {pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
        {label}
      </span>
    );
  }
  // Legacy fallback
  const label = status?.replace(/_/g, ' ') ?? '';
  return <span className="badge badge-sm badge-ghost capitalize">{label}</span>;
}

export default StatusBadge;
```

- [ ] **Step 3: Update `Runs.tsx` to pass `run` prop to `StatusBadge`**

In `frontend/src/pages/Runs.tsx`, find:
```tsx
<td className="px-[22px] py-3.5"><StatusBadge status={run.status} /></td>
```
Change to:
```tsx
<td className="px-[22px] py-3.5"><StatusBadge run={run} /></td>
```

- [ ] **Step 4: Verify in browser — Runs list badges correct**

Open `http://localhost:5173/runs`. Verify:
- In-progress runs show "Processing…" (blue)
- Runs awaiting user input show "Action Required" (amber)
- Done runs with `approval_state = in_review` show "Awaiting Approval"
- Done runs with no approval show "Quote Ready"

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/components/StatusBadge.tsx frontend/src/pages/Runs.tsx
git commit -m "feat(ui): combined status badge using getCombinedStatus"
```

---

## Task 5: Runs list — filters + date range

**Files:**
- Modify: `frontend/src/pages/Runs.tsx`

- [ ] **Step 1: Replace `FILTERS` and add date state**

Replace the current `FILTERS` array and component with the following full rewrite of `Runs.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { rfqApi } from '../api';
import type { RfqRun } from '../types';
import { StatusBadge, getCombinedStatus } from '../components/StatusBadge';

type Filter =
  | 'all'
  | 'Processing…'
  | 'Action Required'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Sent to Customer'
  | 'Customer Approved'
  | 'Failed';

const FILTER_LABELS: Filter[] = [
  'all',
  'Processing…',
  'Action Required',
  'Awaiting Approval',
  'Approved',
  'Sent to Customer',
  'Customer Approved',
  'Failed',
];

export default function Runs() {
  const [runs, setRuns] = useState<RfqRun[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    const fetch = () => rfqApi.list().then((r) => setRuns(r.data)).catch(() => {});
    fetch();
    const iv = setInterval(fetch, 5000);
    return () => clearInterval(iv);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return runs.filter((r) => {
      if (filter !== 'all' && getCombinedStatus(r).label !== filter) return false;
      if (q && !(
        r.id.toLowerCase().includes(q) ||
        (r.meta_company_name ?? '').toLowerCase().includes(q) ||
        (r.meta_product ?? '').toLowerCase().includes(q)
      )) return false;
      const created = new Date(r.created_at).getTime();
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    });
  }, [runs, filter, query, dateFrom, dateTo]);

  return (
    <div className="px-7 py-10 pb-14">
      <div className="mx-auto max-w-[1140px]">
        {/* Header */}
        <div className="mb-[22px] flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-[26px] font-bold tracking-[-0.03em] text-foreground">RFQ Runs</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              History of your submitted RFQs{' '}
              <span className="text-muted-foreground/70">· {runs.length} total</span>
            </p>
          </div>
          {/* Search + date range */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-[38px] min-w-[220px] items-center gap-2 rounded-[11px] border border-border bg-card px-3">
              <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search runs…"
                className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="From date"
              className="h-[38px] rounded-[11px] border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-brand"
            />
            <span className="text-[12px] text-muted-foreground">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="To date"
              className="h-[38px] rounded-[11px] border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-brand"
            />
          </div>
        </div>

        {/* Filter chips */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {FILTER_LABELS.map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-[13px] py-1.5 text-[12.5px] transition-colors ${
                  active
                    ? 'bg-brand font-semibold text-white'
                    : 'border border-border bg-card font-medium text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[var(--elevated-shadow)]">
          {filtered.length === 0 ? (
            <p className="p-8 text-center text-[12px] text-muted-foreground">
              No runs match your filters.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                  <th className="px-[22px] py-3 font-semibold">ID</th>
                  <th className="px-[22px] py-3 font-semibold">Company</th>
                  <th className="px-[22px] py-3 font-semibold">Product</th>
                  <th className="px-[22px] py-3 font-semibold">Type</th>
                  <th className="px-[22px] py-3 font-semibold">Status</th>
                  <th className="px-[22px] py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => nav(`/runs/${run.id}`)}
                    className="cursor-pointer border-b border-border text-[13px] last:border-0 hover:bg-accent/40"
                  >
                    <td className="px-[22px] py-3.5 font-mono text-[12px] text-muted-foreground">{run.id.slice(0, 8)}</td>
                    <td className="px-[22px] py-3.5 font-medium text-foreground">{run.meta_company_name ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-[22px] py-3.5 text-muted-foreground">{run.meta_product ?? '—'}</td>
                    <td className="px-[22px] py-3.5 capitalize text-muted-foreground">{run.input_type}</td>
                    <td className="px-[22px] py-3.5"><StatusBadge run={run} /></td>
                    <td className="px-[22px] py-3.5 text-[12.5px] text-muted-foreground">{new Date(run.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/runs`. Verify:
- 8 filter chips visible (All + 7 status labels)
- From/To date inputs visible in header area
- Filtering by "Awaiting Approval" shows only in-review runs
- Date filter correctly narrows results

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Runs.tsx
git commit -m "feat(ui): runs list — combined status filters + date range"
```

---

## Task 6: `api.ts` — new endpoints

**Files:**
- Modify: `frontend/src/api.ts`

- [ ] **Step 1: Add two methods to `rfqApi`**

In `frontend/src/api.ts`, after `exportDocx`:
```typescript
  markSent: (runId: string) =>
    api.post(`/rfqs/${runId}/mark-sent`),
  markCustomerApproved: (runId: string, body: { customer_approved_at: string; customer_po_reference?: string }) =>
    api.post(`/rfqs/${runId}/mark-customer-approved`, body),
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api.ts
git commit -m "feat(api-client): add markSent + markCustomerApproved"
```

---

## Task 7: RunDetail — customer lifecycle UI

**Files:**
- Modify: `frontend/src/pages/RunDetail.tsx`

- [ ] **Step 1: Add `markSent` import**

At the top of `RunDetail.tsx`, `rfqApi` is already imported. No change needed — `markSent` and `markCustomerApproved` are on the same object.

- [ ] **Step 2: Add state for customer-approved form**

Inside the `RunDetail` component, after existing `useState` declarations, add:
```typescript
  const [customerApprovedAt, setCustomerApprovedAt] = useState('');
  const [customerPoRef, setCustomerPoRef] = useState('');
  const [customerSubmitting, setCustomerSubmitting] = useState(false);
```

- [ ] **Step 3: Add handler functions**

After `handleResubmit`, add:
```typescript
  async function handleMarkSent() {
    if (!runId) return;
    try {
      const { data } = await rfqApi.markSent(runId);
      setRun(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(typeof msg === 'string' ? msg : 'Failed to mark as sent.');
    }
  }

  async function handleCustomerApproved() {
    if (!runId || !customerApprovedAt) return;
    setCustomerSubmitting(true);
    try {
      const { data } = await rfqApi.markCustomerApproved(runId, {
        customer_approved_at: customerApprovedAt,
        customer_po_reference: customerPoRef || undefined,
      });
      setRun(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      alert(typeof msg === 'string' ? msg : 'Failed to record customer approval.');
    } finally {
      setCustomerSubmitting(false);
    }
  }
```

- [ ] **Step 4: Add UI panels in the approval section**

In the JSX, after the `{/* Approved */}` panel block (the one that shows `approvalState === 'approved'`), add three new blocks:

```tsx
            {/* Approved — with Mark as Sent action */}
```

Find the existing approved block:
```tsx
            {/* Approved */}
            {approvalState === 'approved' && (
              <div className="rounded-2xl border border-success/40 bg-success/5 p-4 shadow-[var(--elevated-shadow)]">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-success text-white">
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-foreground">Approved</div>
                    <div className="text-xs text-muted-foreground">Cleared for issue to the customer.</div>
                  </div>
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}
```

Replace with:
```tsx
            {/* Approved — with Mark as Sent action */}
            {approvalState === 'approved' && (
              <div className="rounded-2xl border border-success/40 bg-success/5 p-4 shadow-[var(--elevated-shadow)]">
                <div className="flex flex-wrap items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-success text-white">
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-foreground">Approved</div>
                    <div className="text-xs text-muted-foreground">Cleared for issue to the customer.</div>
                  </div>
                  <button
                    onClick={handleMarkSent}
                    className={`inline-flex h-[38px] items-center gap-2 rounded-[11px] px-[18px] text-[13px] font-bold text-white ${BRAND_GRADIENT}`}
                  >
                    <Send className="h-[15px] w-[15px]" />
                    Mark as Sent to Customer
                  </button>
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}

            {/* Sent to Customer — with Customer Approved form */}
            {approvalState === 'sent_to_customer' && (
              <div className="rounded-2xl border border-[var(--elevated-border)] bg-card p-4 shadow-[var(--elevated-shadow)]">
                <div className="mb-3 flex items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
                    <Send className="h-[18px] w-[18px]" />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-foreground">Sent to Customer</div>
                    <div className="text-xs text-muted-foreground">Record when the customer accepts the quote.</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Approval date *</label>
                    <input
                      type="date"
                      value={customerApprovedAt}
                      onChange={(e) => setCustomerApprovedAt(e.target.value)}
                      className="h-[36px] rounded-[10px] border border-border bg-input-background px-3 text-[13px] text-foreground outline-none focus:border-brand"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">PO / ref number</label>
                    <input
                      type="text"
                      value={customerPoRef}
                      onChange={(e) => setCustomerPoRef(e.target.value)}
                      placeholder="Optional"
                      className="h-[36px] rounded-[10px] border border-border bg-input-background px-3 text-[13px] text-foreground outline-none focus:border-brand"
                    />
                  </div>
                  <button
                    onClick={handleCustomerApproved}
                    disabled={!customerApprovedAt || customerSubmitting}
                    className={`inline-flex h-[36px] items-center gap-2 rounded-[11px] px-[18px] text-[13px] font-bold text-white disabled:opacity-50 ${BRAND_GRADIENT}`}
                  >
                    {customerSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-[15px] w-[15px]" strokeWidth={2.4} />}
                    Customer Approved
                  </button>
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}

            {/* Customer Approved — read-only summary */}
            {approvalState === 'customer_approved' && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-[var(--elevated-shadow)]">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-emerald-500 text-white">
                    <Check className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-foreground">Customer Approved</div>
                    <div className="text-xs text-muted-foreground">
                      {run.customer_approved_at
                        ? `Accepted on ${new Date(run.customer_approved_at).toLocaleDateString()}`
                        : 'Customer acceptance recorded.'}
                      {run.customer_po_reference && ` · PO: ${run.customer_po_reference}`}
                    </div>
                  </div>
                </div>
                {approvalReq && <StageTree req={approvalReq} />}
              </div>
            )}
```

- [ ] **Step 5: Verify `approvalState` variable covers new values**

In `RunDetail.tsx`, find:
```typescript
  const approvalState = run.approval_state ?? 'none';
```
This already works — `sent_to_customer` and `customer_approved` will match the new panels.

- [ ] **Step 6: Verify in browser**

Open a run with `approval_state = approved`. Confirm "Mark as Sent to Customer" button appears. Click it — run should update to show "Sent to Customer" panel with date + PO form. Enter a date and submit — panel should update to "Customer Approved" with date shown.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/RunDetail.tsx
git commit -m "feat(ui): RunDetail customer lifecycle panels (mark-sent, customer-approved)"
```

---

## Task 8: Final check + cleanup

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend
.venv\Scripts\python.exe -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify RunDetail badge**

`RunDetail.tsx` renders `<StatusBadge status={run.status} />` in the header. Update it to use `<StatusBadge run={run} />` so the header badge also shows the combined status:

Find in `RunDetail.tsx`:
```tsx
            <StatusBadge status={run.status} />
```
Replace with:
```tsx
            <StatusBadge run={run} />
```

- [ ] **Step 4: Final commit**

```bash
git add frontend/src/pages/RunDetail.tsx
git commit -m "fix(ui): RunDetail header badge uses combined status"
```

- [ ] **Step 5: Verify full flow in browser**

Walk the full lifecycle on one run:
1. `/runs` — run shows correct combined status badge
2. `/runs/{id}` — "Mark as Sent to Customer" visible when approved
3. Click → panel changes to "Sent to Customer" form
4. Enter date + PO → submit → "Customer Approved" panel shows with date/PO
5. Back to `/runs` — badge shows "Customer Approved" (emerald)
6. Filter chip "Customer Approved" — only that run visible
