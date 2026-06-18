# RFQ Generator — Scaffold + Generator Design

**Date:** 2026-06-13
**Status:** Approved (design)
**Scope:** Project scaffold (React frontend reusing Compliance Central UI) + the RFQ Generator screens (auth, dashboard, generate RFQ, system prompts, user management). The **RFQ Management / tracing** system is a deliberate follow-up spec, not covered here.

## Background

**The deliverable is a new git repo, `NimAIRFQGenerator`, at the project root.** All new backend and frontend code is owned by this repo. Two pre-existing folders serve only as **reference sources** — they keep their own git history, are gitignored from `NimAIRFQGenerator`, and will be deleted from the workspace once their useful parts have been copied over:

- **`quote-agent/`** *(reference; separate repo, will be deleted later)* — a working FastAPI + Celery + Redis + PostgreSQL + FAISS + LangChain backend that processes RFQ documents into draft quotations. Endpoints today: `POST /rfq` (file upload), `GET /status/{task_id}`, `GET /result/{task_id}`. The current UI is **Streamlit**. The generation prompt is a single static file, `app/prompts/system_prompt.md`.
- **`resources/ComplianCentralDesign_pkg/`** *(reference)* — a polished Vite + React 18 + TypeScript + Tailwind v4 + Radix UI design system: an app shell (`Layout`, `app-sidebar`, `top-bar`, `theme-provider`, toast), a large set of `ds-*` design-system components and `ui/*` primitives, `react-router` v7 routing, and a (mock JSON) Express server we do **not** reuse.

Goal: build a new React frontend **from Compliance Central's components** plus a FastAPI backend **seeded by copying `quote-agent`'s working backend into `NimAIRFQGenerator/backend/`** and extending it with auth, prompt management, run persistence, and metrics. We do not develop inside `quote-agent/` — we copy its backend into the new repo and own it there.

## Architecture (Approach A — single backend)

- **Backend is FastAPI**, copied from `quote-agent` into `NimAIRFQGenerator/backend/` and owned by the new repo. It is the single source of truth. The Compliance Central **Express server is not used**; only its **frontend components** are lifted.
- **New React frontend** lives in `NimAIRFQGenerator/frontend/`, built fresh from Compliance Central components, talking **only** to FastAPI via `/api/*` (Vite dev proxy → `http://localhost:8000`).
- **Auth:** full real authentication — JWT (access + refresh), users/roles persisted in PostgreSQL, enforced on every API call via FastAPI dependencies. Frontend hides routes by role for convenience; the backend is the enforcement boundary.
- **Streamlit UI is not carried over.** It stays in the `quote-agent` reference repo; the React frontend replaces it. Nothing in `NimAIRFQGenerator` depends on Streamlit.

### Repo structure (`NimAIRFQGenerator` — new git repo at root)

```
NimAIRFQGenerator/                # git repo (root); branch: main
├── backend/                  # FastAPI backend — copied from quote-agent, then extended
│   ├── app/
│   │   ├── api/
│   │   │   ├── main.py       # add CORS for React origin; mount new routers
│   │   │   └── routers/
│   │   │       ├── auth.py   # login, refresh, current-user (JWT)
│   │   │       ├── users.py  # CRUD users + roles (super_admin only)
│   │   │       ├── prompts.py# versioned named prompts (CRUD + history + activate)
│   │   │       ├── rfqs.py   # submit (file OR text), list/history, get one, status
│   │   │       └── metrics.py# dashboard aggregates (role-scoped)
│   │   ├── core/
│   │   │   ├── config.py     # env settings (JWT secret, token TTLs, CORS, seed admin)
│   │   │   ├── security.py   # password hashing, JWT encode/decode, role deps
│   │   │   └── llm.py        # copied unchanged
│   │   ├── models/
│   │   │   ├── db.py         # copied + ADD: User, Prompt, PromptVersion, RfqRun
│   │   │   └── schemas.py    # copied + ADD: Pydantic request/response models
│   │   ├── services/
│   │   │   ├── generator.py  # copied + CHANGE: read active prompt from DB (fallback .md)
│   │   │   └── parser/extractor/retriever.py   # copied unchanged
│   │   ├── worker/tasks.py   # copied + CHANGE: write RfqRun status/result through pipeline
│   │   └── prompts/system_prompt.md   # copied; seeds generation prompt v1
│   ├── requirements.txt      # copied from quote-agent + auth deps (passlib, python-jose…)
│   └── Dockerfile
│   # NOTE: quote-agent's Streamlit ui/ is NOT copied — the React app replaces it.
│
├── frontend/                 # NEW React app (Vite + React 18 + TS + Tailwind v4 + Radix)
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx, routes.ts
│   │   │   ├── components/    # PORTED from Compliance Central, on demand:
│   │   │   │   ├── ui/        #   layout, app-sidebar, top-bar, theme-provider,
│   │   │   │   └── ...        #   toast, and the ds-*/ui-* components the screens use
│   │   │   └── pages/         # NEW screens (see Screens)
│   │   ├── api/               # typed fetch client → FastAPI (auth header, errors)
│   │   ├── auth/              # auth context, protected routes, role guards
│   │   └── styles/
│   ├── vite.config.ts        # dev proxy /api → http://localhost:8000
│   └── package.json
│
├── docker-compose.yml        # API, worker, postgres, redis, + frontend
├── .gitignore                # ignores quote-agent/, resources/, .superpowers/, …
└── docs/superpowers/specs/   # this design doc

quote-agent/   (reference only — separate repo, gitignored, deleted later)
resources/     (reference only — Compliance Central design package, gitignored)
```

### Data flow

React → (`/api/*` via Vite proxy in dev) → FastAPI. RFQ submit creates an `rfq_runs` row immediately and returns `task_id`; the Celery worker updates the row's status as the pipeline progresses. The dashboard and runs list read status from the DB (not transient Celery state), so history survives restarts.

### Reuse boundary

Lift Compliance Central **frontend components only**, copied on demand as screens require them, with imports/paths adapted to the new app. The Express server, its JSON data, and unused pages are not copied.

## Data Model (PostgreSQL via SQLAlchemy)

Existing tables untouched. Four new tables (roles are an enum, not a table).

**`users`** — `id` (uuid), `email` (unique), `full_name`, `password_hash`, `role` (enum: `super_admin` | `admin` | `end_user`), `is_active`, `created_at`, `updated_at`.

**`prompts`** — a named prompt slot. `id`, `key` (unique slug, e.g. `generation`), `name`, `description`, `active_version_id` (fk → prompt_versions), `created_at`, `updated_at`.

**`prompt_versions`** — immutable history. `id`, `prompt_id` (fk), `version` (int, increments per prompt), `content` (text), `created_by` (fk → users), `created_at`, `note`. Editing never mutates a row — it creates a new version and optionally repoints `prompts.active_version_id`. Gives full history + revert.

**`rfq_runs`** — one row per submission; spine of the dashboard and the future Management system. `id`, `task_id`, `submitted_by` (fk → users), `input_type` (`file` | `text`), `source_filename` (nullable), `source_text` (nullable), `status` (`queued` | `parsing` | `extracting` | `retrieving` | `generating` | `done` | `failed`), `prompt_version_id` (fk — traceability), `result_json` (jsonb, nullable), `error` (nullable), `created_at`, `updated_at`, `completed_at`.

**Seeding:** startup/seed script creates one `super_admin` from env (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) and seeds the `generation` prompt from the current `system_prompt.md` as version 1, so nothing regresses.

### Role capability matrix

| Capability | super_admin | admin | end_user |
|---|---|---|---|
| Submit RFQ, view own runs | ✓ | ✓ | ✓ |
| Dashboard: all runs + system metrics | ✓ | ✓ | own only |
| Edit/version system prompts | ✓ | ✓ | — |
| Manage users & roles | ✓ | — | — |

## Screens & Routes

Reuse Compliance Central `Layout` (sidebar + top bar + theme + toast). Sidebar items filtered by role.

**`/login`** *(public)* — email + password → `/api/auth/login`, store JWT, redirect by role. Built from `ui/*` primitives (card, input, button, label).

**1. `/` Dashboard** *(all roles; content role-scoped)*
- end_user: "My RFQs" — table of own runs with live status, timestamps, link to result.
- admin/super_admin: all runs + aggregate metric cards (total, success/failure rate, avg processing time) + volume-over-time chart.
- Reuses: `metrics-cards`, `chart`/`ds-charts-sparklines`, `table`/`ds-tables`, `badge`, `ds-data-grid-patterns`.

**2. `/rfq/new` Generate RFQ** *(all roles)*
- Tabs: **Upload** (drag-drop PDF/DOCX/TXT) | **Paste text** (textarea). Submit → `task_id` + new run row. Live pipeline stepper (parse → extract → retrieve → generate) via status polling. On done, renders the generated quotation JSON into readable sections.
- Reuses: `card`, `tabs`, `textarea`, `button`, file-drop pattern, `progress`/stepper, `ds-section`, toast.

**3. `/rfqs` My RFQs / All RFQs** *(all roles; scope by role)*
- Searchable, filterable, paginated runs table. Row → detail: input + generated quote + which prompt version was used.
- Reuses: `ds-tables`, `ds-data-grid-patterns`, `table`, `badge`, `FilterPill`.

**4. `/prompts` System Prompts** *(admin + super_admin)*
- List of named prompts. Editor with version-history sidebar; Save creates a new version; "Set active" repoints the active version; compare-to-active.
- Reuses: `card`, `textarea`, `tabs`, `ds-changelog`/timeline, `dialog`, `button`, `badge`.

**5. `/users` User Management** *(super_admin only)*
- CRUD users, assign roles, activate/deactivate. Maps onto Compliance Central's existing `user-management` page patterns.
- Reuses: `user-management` patterns, `ds-tables`, `dialog`, form components.

**Sidebar by role:** end_user → Dashboard, Generate RFQ, My RFQs · admin → + System Prompts · super_admin → + User Management.

Wireframes for screens 1–3 were reviewed and approved during brainstorming (persisted under `.superpowers/brainstorm/`).

## Error Handling, Auth Flow & Edge Cases

**Auth:** JWT access token (~30 min TTL) + refresh token; access token in memory + `Authorization` header. 401 → attempt refresh once → on failure redirect to `/login`. FastAPI deps `require_user` / `require_role(...)` guard each router; 403 on insufficient role. Passwords hashed with passlib/bcrypt. Seed super_admin from env.

**RFQ pipeline failures:** the worker owns status transitions; each stage wraps errors and writes `status=failed` + `error` to the run row. UI surfaces failure on the Generate screen and in the runs table (red `failed` badge; error in detail). File upload validates extension and size (client + server); text input enforces a max length. Polling uses backoff and stops on terminal states (`done`/`failed`) — no hung spinner on provider errors.

**Prompts:** "Set active" is transactional (repoint `active_version_id`). Generator reads the active version at run start and records `prompt_version_id` on the run; if no DB prompt exists, fall back to `system_prompt.md` so a fresh DB never hard-fails generation. Concurrent edits are safe — each save is a new immutable version; activation is last-write-wins on the active pointer.

**General:** typed API client maps non-2xx to typed errors; global toast for unexpected failures; explicit empty/loading/error states on every data view (`skeleton`, `alert`).

## Testing Strategy

- **Backend (pytest):** unit tests for `security.py` (hashing, JWT encode/decode/expiry), role dependencies (allow/deny per role), prompt-versioning service (save → new version; activate → repoint; fallback to `.md`), and `rfq_runs` status transitions. FastAPI `TestClient` route tests for auth, prompts CRUD, rfq submit (file + text), metrics scoping. LLM mocked throughout.
- **Pipeline:** worker writes correct status transitions and records `prompt_version_id`, with extractor/LLM mocked.
- **Frontend (Vitest + RTL):** auth guard / role-based routing, Generate form (upload vs paste toggle + validation), prompt editor (save → new version appears), typed API client against mocked fetch.
- **Manual smoke (documented):** seed admin → login → create user → submit RFQ (both paths) → watch status → view result → edit prompt + set active → confirm next run records new version.

TDD per the project's normal workflow: tests first for backend services and auth/role logic.

## Explicitly Out of Scope (this spec)

- RFQ **Management / tracing** system (separate follow-up spec — reuses `audit-trail` / data-grid patterns and the `rfq_runs` spine laid here).
- LLM token/cost accounting on the dashboard.
- Per-user custom permissions beyond the three-role enum.
- DOCX rendering of generated quotes (result is stored as JSON; rendering is a later concern).
- Migrating `quote-agent`'s git history into `NimAIRFQGenerator` (we copy code, not history; `quote-agent` stays a separate repo and is deleted from the workspace later).
