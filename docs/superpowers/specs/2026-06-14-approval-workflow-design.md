# Multi-Stage Approval Workflow — Design

**Date:** 2026-06-14
**Status:** Approved (design); ready for implementation plan
**Scope:** Full vertical slice — DB schema + Alembic migration + backend API + frontend wiring (Approvals & RunDetail).

---

## 1. Goal

Replace the UI-only Approvals placeholder (which filters `rfqApi.list()` by `pending_confirmation`) with a real, persisted approval workflow. A submitter routes a generated quote through an ordered set of **sequential stages**; each stage contains one or more **parallel approvers** and passes on a **quorum (M-of-N)**. Rejections **bounce the request back one stage**. The user model is extended now so a future SSO migration does not touch the auth path.

## 2. Decisions (resolved during brainstorming)

| Topic | Decision |
|---|---|
| Routing | Explicit assignment — submitter picks approvers at send-time. |
| Depth | Sequential stages; parallel approvers within a stage. |
| Stage pass rule | Quorum: `required_count` (M) of N assignees must approve. |
| Reject behavior | Bounce back one stage. Stage-0 reject ends request as `changes_requested`; resubmit creates a **new** `approval_request` (old preserved as history). |
| Bounce vote handling | Bounce-back **resets** the target stage's recorded approvals — it reactivates and approvers re-vote. |
| Who builds the flow | Submitter, ad-hoc at send-time. (Admin templates are a future enhancement, not in scope.) |
| SSO readiness | Add `auth_provider`, `external_id`; make `password_hash` nullable. No auth break. |
| Approver eligibility | Dedicated `can_approve` capability on `User`, independent of admin role. Maps to an SSO group claim later. |
| Stage-builder UX | Inline progressive builder in RunDetail — "Add stage" appends a card; per stage: multi-select approvers + quorum number input. No modal. |

## 3. User model changes (SSO readiness + approver capability)

Additive columns on `users` (local login unaffected):

| Column | Type | Notes |
|---|---|---|
| `auth_provider` | `String(20)`, NOT NULL, default `'local'` | `'local'` \| `'oidc'` \| `'saml'` |
| `external_id` | `String(255)`, nullable, indexed | IdP subject claim; null for local users |
| `password_hash` | **changed to nullable** | SSO users have no local password |
| `can_approve` | `Boolean`, NOT NULL, default `False` | dedicated approver capability |

New auth dependency `require_approver` in `security.py`:
```python
def require_approver(user: User = Depends(get_current_user)) -> User:
    if user.can_approve or user.role in (UserRole.admin, UserRole.super_admin):
        return user
    raise HTTPException(403, "Not an approver")
```
Existing admins keep working; explicit `can_approve` is the forward path.

## 4. Approval data model

`RfqRun` gets **one** additive denormalized column for cheap UI reads:

| Column | Type | Notes |
|---|---|---|
| `approval_state` | `SAEnum(ApprovalState)`, NOT NULL, default `none` | `none \| in_review \| approved \| rejected \| changes_requested` |

Three new tables (all using the portable `UUID` / `SAEnum` TypeDecorators already in `db.py`):

### `approval_requests` — one per "send for approval" (a run may have several over its life)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `run_id` | FK → `rfq_runs.id`, indexed | |
| `submitted_by` | FK → `users.id` | |
| `status` | enum `in_review \| approved \| rejected \| cancelled` | request-level outcome |
| `current_stage_index` | Integer, default 0 | which stage is active |
| `created_at` | DateTime | |
| `completed_at` | DateTime, nullable | |

### `approval_stages` — ordered sequential stages within a request

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `request_id` | FK → `approval_requests.id`, indexed | |
| `stage_index` | Integer | 0,1,2… execution order |
| `name` | String(255) | e.g. "Manager review" |
| `required_count` | Integer | quorum M; N = count of assignments |
| `status` | enum `pending \| active \| approved \| rejected \| skipped` | |

### `approval_assignments` — parallel approvers + their individual decisions

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `stage_id` | FK → `approval_stages.id`, indexed | |
| `approver_id` | FK → `users.id`, indexed | drives "my queue" |
| `decision` | enum `pending \| approved \| rejected`, default `pending` | |
| `comment` | Text, nullable | rejection reason / note |
| `decided_at` | DateTime, nullable | |

**Rationale:** assignments give per-approver queue + immutable decision audit; stages give quorum + sequencing; the request ties to a run and tracks resubmissions as separate rows.

## 5. Workflow engine (`approval_service.py`)

All transition logic lives in one service; routes stay thin.

**Submit** (`create_request`):
- Validate run is `done`; each stage `1 ≤ required_count ≤ len(approver_ids)`; every approver_id has `can_approve`.
- Create request + stages + assignments. Stage 0 → `active`, rest → `pending`. Request `status=in_review`, `current_stage_index=0`. Run `approval_state=in_review`.

**Decide** (`record_decision(assignment_id, decision, comment)`):
- Caller must be the assignment's `approver_id`; assignment must be `pending`; its stage must be `active`. Else 403/409.
- Set `decision`, `comment`, `decided_at`.
- **On approve:** if approved count in stage ≥ `required_count` → stage `approved`.
  - If a next stage exists → it becomes `active`, `current_stage_index += 1`.
  - Else → request `approved`, `completed_at` set, run `approval_state=approved`.
- **On reject:** stage → `rejected`.
  - If `current_stage_index > 0` → **bounce back**: the previous stage (index−1) is **reset** (its assignments' decisions → `pending`, `decided_at`/`comment` cleared), set back to `active`; current stage reset to `pending`; `current_stage_index -= 1`. The rejecting comment is surfaced to those approvers.
  - If `current_stage_index == 0` → request `rejected`, run `approval_state=changes_requested`. The rejection comment is surfaced to the submitter. Run remains editable; a later resubmit creates a **new** `approval_request` (this one stays as history).

## 6. Backend API

New router `approvals.py` (`prefix="/approvals"`) + additions to `rfqs.py` and `users.py`.

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /rfqs/{run_id}/submit-approval` | owner of run | Body `{ stages: [{ name, required_count, approver_ids[] }] }`. Builds workflow, activates stage 0. |
| `GET /rfqs/{run_id}/approval` | any auth on run | Full request tree (stages + assignments + decisions) for RunDetail. Returns latest request. |
| `GET /approvals/queue` | `require_approver` | My assignments where `decision=pending` AND parent stage `active`. → Approvals "pending" tab. |
| `GET /approvals/reviewed` | `require_approver` | My assignments already decided. → Approvals "reviewed" tab. |
| `POST /approvals/{assignment_id}/decide` | `require_approver` + must be assignee | Body `{ decision, comment? }`. Runs engine, returns updated request state. |
| `GET /users/approvers` | any auth | `id, full_name, email` where `can_approve`. Feeds stage-builder. |

User-management additions (`users.py`): `can_approve` and `auth_provider` exposed in `UserOut`; settable in `CreateUserRequest` / `UpdateUserRequest`. This is how an admin grants the approver capability today and the field SSO populates later.

New Pydantic schemas in `schemas.py` (following existing patterns): `ApprovalStageIn`, `SubmitApprovalRequest`, `AssignmentOut`, `StageOut`, `ApprovalRequestOut`, `DecideRequest`, `ApproverOut`.

## 7. Frontend wiring

**`api.ts`** — replace placeholder `approvalApi`:
```ts
approvalApi = {
  queue: () => api.get('/approvals/queue'),
  reviewed: () => api.get('/approvals/reviewed'),
  decide: (assignmentId, decision, comment?) =>
    api.post(`/approvals/${assignmentId}/decide`, { decision, comment }),
  requestTree: (runId) => api.get(`/rfqs/${runId}/approval`),
  submit: (runId, stages) => api.post(`/rfqs/${runId}/submit-approval`, { stages }),
  approvers: () => api.get('/users/approvers'),
}
```

**`types.ts`** — add `ApprovalRequest`, `ApprovalStage`, `ApprovalAssignment`, `Approver`; add `approval_state` to `RfqRun`.

**`Approvals.tsx`** — swap `rfqApi.list()` placeholder for `approvalApi.queue()` / `reviewed()`. Cards show stage name + quorum progress ("1 of 2 approved"). Reject prompts for a comment. Approve/Reject call `decide()` then refetch.

**`RunDetail.tsx`** — approval panel becomes data-driven from `approvalApi.requestTree(runId)`:
- No request + run `done` → **inline progressive stage-builder**: "Add stage" appends a stage card; per card multi-select approvers (from `approvers()`) + quorum number input. Submit → `approvalApi.submit`.
- `in_review` → render stage tree with live per-approver decision status and the active stage highlighted.
- `approved` / `changes_requested` → success / rejected banners reflecting real state; rejection comment shown. `changes_requested` offers "Revise & resubmit" (re-opens the builder for a new request).

`vite.config.ts` proxy for `/approvals` already exists; `/users/approvers` is covered by the existing `/users` proxy.

## 8. Migration

One new Alembic revision, descending from `a1b2c3d4e5f6` (the locked revisions `27c9e7a3bfc9` and `a1b2c3d4e5f6` are **never edited**):
- `users`: add `auth_provider`, `external_id`, `can_approve`; alter `password_hash` → nullable.
- `rfq_runs`: add `approval_state`.
- Create `approval_requests`, `approval_stages`, `approval_assignments` with FKs and indexes.
- Enums created via the portable `SAEnum` pattern (works on SQLite tests + Postgres).

## 9. Testing (`backend/tests/`, SQLite, no LLM)

- `test_approval_service.py` — engine units: quorum advance; parallel partial votes don't advance; sequential gating (stage 1 inactive until stage 0 quorum); reject bounce-back resets prior stage; stage-0 reject finalizes as `changes_requested`; last-stage approval finalizes run `approved`.
- `test_approvals_routes.py` — submit validation (bad quorum, non-approver in list → 422); queue scoping (only my pending + active); decide authz (non-assignee 403, non-approver 403, already-decided 409); full happy path; resubmit creates a new request.
- `test_users_routes.py` — extend for `can_approve` / `auth_provider` set + read.

## 10. Out of scope (future)

- Admin-defined approval templates.
- Actual SSO/OIDC integration (schema is prepared; flow is a separate spec).
- Approver groups/teams (stages reference individuals for now).
- Notifications/email on assignment.

## 11. Hard rules honored

- Portable `UUID` / `JSONB` / `SAEnum` TypeDecorators (no `sqlalchemy.dialects.postgresql.*`).
- New Alembic revision only; locked revisions untouched.
- `require_role` pattern preserved; new `require_approver` follows the same dependency form.
- Lazy LLM / settings patterns unaffected (no LLM in this feature).
