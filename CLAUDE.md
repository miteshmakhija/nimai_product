# NimAI — Monorepo Claude Context

## Repository Structure

```
nimai_site-master/
├── frontend/        ← Marketing website (CRA + React 18 + plain CSS) — port 3000
├── rfq-frontend/    ← RFQ client portal (Vite + React 19 + TypeScript + Tailwind v4) — port 5173
├── backend/         ← FastAPI + SQLAlchemy 2 + Postgres + Celery — port 8001
├── docs/            ← Architecture, setup, specs, plans
├── customer_logo/   ← Client logos (ACME, Varroc, LTTS)
├── start.ps1        ← Starts all 6 services in one command
└── docker-compose.yml
```

**Original NimAIRFQGenerator-main/ is kept as-is for reference.**

## Client Login Flow

1. User visits marketing site (`localhost:3000`) and clicks **Client Login**
2. Enters organisation name (e.g. `acme`, `varroc`, `ltts`) → quick-access logos also available
3. Redirected to `http://localhost:5173/login?org=<slug>`
4. RFQ login page shows org logo + NimAI branding, personalised welcome text
5. Signs in → full RFQ dashboard

To add a new client: add to `KNOWN_CLIENTS` in [frontend/src/components/LoginModal.js](frontend/src/components/LoginModal.js) and `ORG_MAP` in [rfq-frontend/src/pages/Login.tsx](rfq-frontend/src/pages/Login.tsx), and drop the logo in `customer_logo/` + `rfq-frontend/public/customer_logo/`.

## RFQ Application

Manufacturing RFQ automation. Users upload/paste RFQ docs (PDF/DOCX/TXT); LLM pipeline extracts structured data, retrieves similar past quotes (FAISS), generates a draft quotation JSON. Three-step flow: extract metadata → confirm → fill data points → generate. Approval workflow: draft → pending → approved/rejected.

Roles: `super_admin`, `admin`, `end_user`. Default admin: `admin@nimai.ai` / `password!123`.

Stack: FastAPI + SQLAlchemy 2 + Postgres 16 + Celery/Redis | React 19 + Vite + Tailwind v4 + DaisyUI v5 + TipTap v2 + lucide-react | LLM via Bedrock (prod) or OpenAI-compatible (dev). See `docs/SETUP.md` for env setup and LLM provider config.

## Key Paths

```
backend/app/api/routers/   auth, users, prompts, rfqs, products, metrics, approvals, approval_templates
backend/app/core/          config.py (Settings), security.py, llm.py (get_llm)
backend/app/models/        db.py (SQLAlchemy + TypeDecorators), schemas.py
backend/app/services/      extractor, generator, retriever, parser, rfq_service, product_service,
                           docx_export, approval_service, auth_service (incl. seed_test_users)
backend/app/worker/tasks.py      Celery pipeline task
backend/alembic/versions/        27c9e7a3bfc9 → a1b2c3d4e5f6 → b2c3d4e5f6a7 → c3d4e5f6a7b8
frontend/src/api.ts              axios + all API namespaces (approvalApi, approvalTemplateApi)
frontend/src/App.tsx             routes + RequireAuth/RequireRole guards
frontend/src/styles/theme.css    design tokens — edit here, not in components
frontend/src/pages/              RfqRepository(index), Dashboard(admin), GenerateRFQ,
                                 RfqConfirm, RfqDataCheck, RunDetail, Runs,
                                 Approvals, ApprovalTemplates, ProductFields, PromptsEditor
frontend/src/components/         Layout, StatusBadge, TipTapEditor
TESTERS.md                       test account credentials + scenario walkthrough
```

## Routes

| Path | Component | Guard |
|---|---|---|
| `/` | RfqRepository | auth |
| `/generate` | GenerateRFQ | auth |
| `/generate/confirm/:runId` | RfqConfirm | auth |
| `/generate/data/:runId` | RfqDataCheck | auth |
| `/runs` | Runs | auth |
| `/runs/:runId` | RunDetail | auth |
| `/approvals` | Approvals | auth |
| `/dashboard` | Dashboard | admin |
| `/prompts` | PromptsEditor | admin |
| `/users` | Users | super_admin |
| `/admin/products` | ProductFields | admin |
| `/admin/approval-templates` | ApprovalTemplates | admin |

## Design System

Tokens live in `theme.css` — always use CSS vars / Tailwind utilities, not hardcoded colours.

| Token / utility | Purpose |
|---|---|
| `bg-gradient-brand` | cyan→blue AI button gradient |
| `bg-brand-soft` / `text-brand` | 10–15% brand tint, e.g. icon wells |
| `shadow-[var(--elevated-shadow)]` | layered card shadow |
| `var(--elevated-border)` | subtle card border |
| Dark: `--background:#0e0e11`, `--card:#1a1a1f`, `--sidebar:#161619` | |
| Light: `--background:#eceff5`, `--card:#ffffff`, `--sidebar:#f7f8fb` | |

`FlowStepper` is exported from `RfqConfirm.tsx` and imported by `RfqDataCheck.tsx`.

## Hard Rules — DO NOT Violate

1. **`db.py` UUID/JSONB TypeDecorators** — never replace with `sqlalchemy.dialects.postgresql.*`. Tests use SQLite.
2. **`conftest.py` top-of-file `os.environ.setdefault` + `StaticPool`** — do not move or reorder.
3. **`bcrypt==3.2.2` + `passlib[bcrypt]==1.7.4`** — do not upgrade bcrypt to 4.x.
4. **`pydantic>=2.13.4`** — verified compatible with `langchain-core 1.4.7` on Python 3.12. Do not downgrade below 2.11.
5. **Alembic migrations `27c9e7a3bfc9` and `a1b2c3d4e5f6`** — applied to Rancher Postgres. Never edit; add a new revision.
6. **`AWS_REGION` must NOT appear in `.env`** — pydantic-settings `extra=forbid` rejects the app.
7. **`python-docx`** — keep in requirements; used by `docx_export.py`.
8. **`call_bedrock.py`** — read-only credential pattern reference. Do not modify.

## Backend Conventions

- **LLM calls are lazy** — `get_llm()` inside functions only; never at module import.
- **`process_rfq_task` import is lazy** — import inside route handlers (langchain triggers at module load).
- **`get_settings()` is `lru_cache`-wrapped** — never call `Settings()` directly.
- **Docling import is lazy** — `from docling.document_converter import DocumentConverter` inside `extract_text()` only.
- **Role enforcement** — use `require_role(UserRole.admin, ...)` dependency; never inline.
- **Celery on Windows** — must use `--pool=solo`.
- **LLM timeouts** — `OPENAI_TIMEOUT=300`, Celery `task_time_limit=600`.

## Frontend Conventions

- **lucide-react** for all icons in redesigned pages; `@heroicons/react` stays for `Users.tsx` / `Login.tsx`.
- **axios `baseURL='/'`** — Vite proxies `/auth /rfqs /prompts /metrics /users /products /approvals /approval-templates` to `localhost:8000`. Add new prefixes to `vite.config.ts`.
- **Login uses `URLSearchParams`** — FastAPI `OAuth2PasswordRequestForm` requires `application/x-www-form-urlencoded`.
- **Auto-refresh on 401** — interceptor retries once; clears localStorage + redirects on failure.
- **Approval state** (`draft|pending|approved|rejected`) is driven by the backend `approval_requests` table and surfaced in `RunDetail` via `approvalApi.get(runId)`.

## Testing

- Run from `backend/`: `.venv\Scripts\python.exe -m pytest tests/ -v`
- LLM is never called in tests — mock or skip services that invoke `get_llm()`.

## Approval workflow (merged to `main`)

### DB tables (Alembic chain: `27c9e7a3bfc9` → `a1b2c3d4e5f6` → `b2c3d4e5f6a7` → `c3d4e5f6a7b8`)

| Migration | What it adds |
|---|---|
| `b2c3d4e5f6a7` | `approval_requests`, `approval_stages`, `approval_assignments` |
| `c3d4e5f6a7b8` | `approval_templates` |

### Backend files

| File | Purpose |
|---|---|
| `app/services/approval_service.py` | Engine: `create_request`, `record_decision` (quorum/advance/bounce) |
| `app/api/routers/approvals.py` | `GET /approvals/queue`, `reviewed`, `POST /{assignment_id}/decide` |
| `app/api/routers/approval_templates.py` | CRUD `/approval-templates` — admin-gated; `GET` open to all auth users |

Key endpoints added to `rfqs.py`: `POST /{run_id}/submit-approval`, `GET /{run_id}/approval`.
Key endpoint added to `users.py`: `GET /users/approvers`.

`require_approver` dependency in `security.py` — passes for `can_approve=True` OR admin/super_admin role.

SSO-ready columns on `users`: `auth_provider` (default `'local'`), `external_id`, `can_approve`, `password_hash` → nullable.

### Approval Templates

`ApprovalTemplate` model stores reusable stage structures as JSONB. Each `TemplateStage` includes:
- `name`, `required_count` (quorum), `department_hint` (optional display hint)
- `approver_ids: list[str]` — pre-assigned users; position 0 = Primary, rest = Secondary

Admin creates templates at `/admin/approval-templates`. When a submitter loads a template in RunDetail, `applyTemplate()` pre-fills both stage structure and approver IDs — they just hit Submit.

### Primary / Secondary approver convention

Position in `approver_ids` array determines role label in the UI only — no backend logic change. Quorum controls how many must approve. Example: quorum=1, 2 approvers → either Primary or Secondary is sufficient.

### Test users (seeded on every backend startup — idempotent)

See `TESTERS.md` for full credentials and test scenario. Key accounts:

| Email | Role | Can Approve |
|---|---|---|
| `admin@nimai.ai` | super_admin | ✅ |
| `alice.finance@nimai.ai` | admin | ✅ |
| `carol.director@nimai.ai` | admin | ✅ |
| `dave.sales@nimai.ai` | end_user | ✅ |
| `frank.viewer@nimai.ai` | end_user | ❌ |
| `grace.submitter@nimai.ai` | end_user | ❌ |

Password for all test accounts (except super admin): `Test@1234`

### Frontend

`approvalApi` and `approvalTemplateApi` in `api.ts` are fully wired. `RunDetail.tsx` has:
- Stage builder with Primary (solid blue) / Secondary (light blue) approver chips
- Quorum explanation label ("Any 1 approver is enough", "All must approve", etc.)
- Template picker — "Load template" dropdown pre-fills stages + approvers
- `StageTree` read-only view shows Primary/Secondary badges and quorum label per stage

`ApprovalTemplates.tsx` — admin CRUD page with per-stage approver picker.

`types.ts` has full `ApprovalRequest / ApprovalStage / ApprovalAssignment / Approver / ApprovalTemplate / TemplateStage` types.

## Open / Pending

- Real semantic search on RfqRepository
- FAISS vector store integration
- Pagination on `GET /rfqs`
- Approver-name enrichment in `AssignmentOut` (currently only `approver_id` returned; join to users table needed)
