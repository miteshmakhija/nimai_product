# RFQ Status Redesign — Spec

**Date:** 2026-06-15  
**Branch:** rfqprompts  
**Status:** Approved for implementation

---

## Goal

Replace the current fragmented dual-status display (pipeline `run.status` + hidden `approval_state`) with a single combined status badge visible on the Runs list. Add two new customer-facing lifecycle states. Add filter chips and date range filter to the Runs list.

---

## Current State Problems

1. Runs list shows only `run.status` — a `done` run with `approval_state = in_review` looks identical to one with no approval submitted.
2. Pipeline internals (parsing/extracting/retrieving/generating) exposed to users who only care about "is it working?"
3. No way to track quote lifecycle beyond internal approval (sent to customer, customer accepted).
4. No date filter on Runs list.

---

## Combined Status Logic

A single computed status is derived from `run.status` + `run.approval_state`, evaluated in priority order:

| Priority | Label | Badge color | Condition |
|---|---|---|---|
| 1 | Processing… | blue pulse | `status` ∈ {queued, parsing, extracting, retrieving, generating} |
| 2 | Action Required | amber pulse | `status` ∈ {pending_confirmation, pending_data} |
| 3 | Failed | red | `status` = failed |
| 4 | Awaiting Approval | amber pulse | `approval_state` = in_review |
| 5 | Changes Requested | red | `approval_state` = changes_requested |
| 6 | Approved | green | `approval_state` = approved |
| 7 | Sent to Customer | blue | `approval_state` = sent_to_customer |
| 8 | Customer Approved | emerald | `approval_state` = customer_approved |
| 9 | Quote Ready | grey-green | `status` = done AND `approval_state` = none |

Priority order matters — evaluate top to bottom, first match wins.

---

## New Lifecycle States

### `sent_to_customer`
- Manually triggered by user action in RunDetail
- **Pre-condition:** current `approval_state` must be `approved`
- Backend enforces this; returns 400 if condition not met
- No extra data required

### `customer_approved`
- Manually triggered by user action in RunDetail
- **Pre-condition:** current `approval_state` must be `sent_to_customer`
- Requires: `customer_approved_at` (date, required) + `customer_po_reference` (string, optional)
- Both stored on `RfqRun`

---

## Backend Changes

### 1. Alembic migration (new revision after `c3d4e5f6a7b8`)

Extend `approval_state` enum with two new values:
- `sent_to_customer`
- `customer_approved`

Add two columns to `rfq_runs`:
- `customer_approved_at` — `DateTime`, nullable
- `customer_po_reference` — `String(120)`, nullable

### 2. New endpoints in `rfqs.py`

```
POST /rfqs/{run_id}/mark-sent
```
- Auth: any authenticated user
- Validates: `run.approval_state == ApprovalState.approved`
- Sets: `run.approval_state = ApprovalState.sent_to_customer`
- Returns: updated `RfqRunOut`

```
POST /rfqs/{run_id}/mark-customer-approved
```
- Auth: any authenticated user
- Body: `{ customer_approved_at: date (ISO string), customer_po_reference?: string }`
- Validates: `run.approval_state == ApprovalState.sent_to_customer`
- Sets: `run.approval_state = ApprovalState.customer_approved`, stores date + PO ref
- Returns: updated `RfqRunOut`

### 3. Schema changes

`RfqRunOut` gains two optional fields:
- `customer_approved_at: Optional[datetime]`
- `customer_po_reference: Optional[str]`

`ApprovalState` enum gains:
- `sent_to_customer = "sent_to_customer"`
- `customer_approved = "customer_approved"`

---

## Frontend Changes

### `StatusBadge.tsx`

Replace current `STATUS_BADGE` / `STATUS_LABEL` maps with a single `getCombinedStatus(run)` function:

```ts
function getCombinedStatus(run: RfqRun): { label: string; cls: string; pulse: boolean }
```

Evaluates priority table above. `StatusBadge` accepts full `RfqRun` (not just `status` string) — **breaking change**, update all call sites.

Color tokens:
- blue pulse → `badge-info` + pulse
- amber pulse → `badge-warning` + pulse  
- red → `badge-error`
- green → `badge-success`
- emerald → custom `bg-emerald-500/15 text-emerald-600` (inline, matches design system pattern)
- grey-green → `badge-ghost`

### `types.ts`

Add to `ApprovalState` union: `'sent_to_customer' | 'customer_approved'`  
Add to `RfqRun`: `customer_approved_at?: string; customer_po_reference?: string`

### `Runs.tsx`

**Filter chips** (replace current 5):
All · Processing · Action Required · In Approval · Approved · Sent to Customer · Customer Approved · Failed

Each filter matches against the computed combined status label (not raw `run.status`), so filter logic calls `getCombinedStatus(run).label`.

**Date range filter:**
Two date inputs (From / To) filtering on `run.created_at`. Placed inline with search bar on the right. Both optional — if From only, show all runs from that date forward. If To only, show all up to that date.

### `RunDetail.tsx`

**"Mark as Sent to Customer" button:**
- Shown when `run.approval_state === 'approved'`
- Placed in approval panel, below the StageTree
- On click: calls `rfqApi.markSent(runId)`, re-fetches run on success

**"Customer Approved" button + mini-form:**
- Shown when `run.approval_state === 'sent_to_customer'`
- Inline form: date picker (required) + text input for PO reference (optional, placeholder "PO / ref number")
- Submit calls `rfqApi.markCustomerApproved(runId, { customer_approved_at, customer_po_reference })`
- Re-fetches run on success

**Display when `customer_approved`:**
- Show date + PO ref in the approval panel (read-only)

### `api.ts`

Add to `rfqApi`:
```ts
markSent: (runId: string) => axios.post(`/rfqs/${runId}/mark-sent`)
markCustomerApproved: (runId: string, body: { customer_approved_at: string; customer_po_reference?: string }) =>
  axios.post(`/rfqs/${runId}/mark-customer-approved`, body)
```

---

## What Does NOT Change

- `approval_state` DB column name — same column, just extended enum
- Approval workflow engine (`approval_service.py`) — untouched
- StageBuilder / StageTree components — untouched
- Existing migrations — never edited, new revision only
- `pending_data` status — kept as-is, maps to "Action Required"

---

## Tests to Update / Add

- `test_rfqs_routes.py` — add tests for `mark-sent` (happy path + wrong state 400) and `mark-customer-approved` (happy path + wrong state + missing date)
- `test_approval_service.py` — no changes needed (engine untouched)
- Frontend: no automated tests, verify manually via dev server

---

## Out of Scope

- Email/notification on status change
- Customer-facing portal
- Pagination on Runs list (tracked separately in CLAUDE.md)
