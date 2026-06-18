# NimAI RFQ Generator — Architecture Decisions

> Every significant decision made during this project and why.

---

## D1 — Single FastAPI backend; no separate Express server

**Decision:** The React frontend talks only to FastAPI. The Compliance Central reference package included an Express server — it was explicitly not used.

**Why:** The Express server served mock JSON for demo purposes. FastAPI is the real backend with real auth, real DB, and the LLM pipeline. Keeping one backend eliminates sync problems between two servers.

---

## D2 — Copy `quote-agent` backend into this repo; do not develop inside it

**Decision:** `quote-agent/` is a read-only reference repo. All new code lives in `backend/` in this repo.

**Why:** `quote-agent` has its own git history and was a prototype. Extending it in place would entangle the new auth/persistence/UI work with the prototype's history. Clean copy lets us own the code and evolve independently.

---

## D3 — AWS Bedrock instead of OpenAI

**Decision:** `EXTRACTOR_PROVIDER=bedrock`, `GENERATOR_PROVIDER=bedrock`. The credential pattern was copied from `call_bedrock.py` at the project root.

**Why:** The organization has AWS access and Bedrock enabled. OpenAI requires a paid external API key. Bedrock uses the existing AWS SSO credentials.

**Implementation:** Explicit `boto3.Session(profile_name=aws_profile)` → `session.client("bedrock-runtime", region_name=bedrock_region)` → passed to `ChatBedrock(client=bedrock_client)`. This matches how `call_bedrock.py` authenticates and supports SSO profiles via `AWS_PROFILE`.

---

## D4 — Portable UUID/JSONB TypeDecorators instead of `postgresql.*` imports

**Decision:** `db.py` defines its own `UUID` and `JSONB` classes as `TypeDecorator` subclasses. They delegate to native Postgres types on Postgres and use `CHAR(36)` / `Text` on other dialects.

**Why:** Without this, SQLAlchemy raises `Compiler can't render element of type UUID` when the test suite tries to use the SQLite in-memory database. The models would be untestable without a live Postgres instance.

**Trade-off:** Alembic autogenerate cannot cleanly use these decorators — it generates migration code that references the decorator class without importing it. The initial migration was therefore hand-written using `sqlalchemy.dialects.postgresql.UUID/JSONB` directly.

---

## D5 — SQLite + StaticPool for tests; not a Postgres test database

**Decision:** Tests use `sqlite+pysqlite:///:memory:` with `StaticPool`. There is no Postgres test database requirement for the main test suite.

**Why:** Simpler setup — no Docker dependency for running tests. The portable TypeDecorators (D4) make this possible. `StaticPool` is required because SQLite in-memory creates a new empty database for each new connection; `db.refresh()` after `db.commit()` would otherwise see an empty database.

**Limitation:** `RfqRun.result_json` is JSONB. Tests that write and read `result_json` as a dict work on SQLite because the TypeDecorator serializes/deserializes to JSON text. However, JSONB-specific Postgres operations (containment queries, etc.) cannot be tested on SQLite. Tests for `rfq_service` and `test_pipeline` are planned to run against a Postgres test DB for full fidelity.

---

## D6 — Startup bootstrap skips on SQLite

**Decision:** `main.py` startup hook returns early if `settings.database_url.startswith("sqlite")`.

**Why:** When `TestClient` starts the app, the startup event fires. Without this guard, it would call `create_all()` against the production Postgres database (if the test accidentally has a Postgres URL) and run `seed_super_admin` against whatever DB the test fixture set up. The guard makes the test fixture fully self-contained.

---

## D7 — LLM instantiation is always lazy (inside functions, not at module level)

**Decision:** `extractor.py` and `generator.py` call `from app.core.llm import get_llm` inside the function body. `rfqs.py` router imports `process_rfq_task` inside the handler function.

**Why:** `langchain_aws` (and `langchain_openai`) import heavy dependencies and may attempt to validate credentials at import time. If the API process starts without AWS credentials configured, a module-level `llm = get_llm("extractor")` would crash at startup. Lazy imports defer this to the first actual LLM call.

---

## D8 — `bcrypt==3.2.2` hard pin

**Decision:** Pin `bcrypt` to exactly `3.2.2` in `requirements.txt`.

**Why:** `bcrypt` 4.x changed its API in a way that breaks `passlib 1.7.4`. Specifically, `bcrypt.hashpw()` in 4.x raises `ValueError: password cannot be longer than 72 bytes` for all passwords when called via passlib's bcrypt scheme. This caused a runtime failure during auth testing.

**Resolution:** `bcrypt==3.2.2` + `passlib[bcrypt]==1.7.4` is the known-good pairing. The alternative (passlib 2.x or a different bcrypt wrapper) was not available at the time.

---

## D9 — `pydantic>=2.10.0` (not 2.11+)

**Decision:** Constrain pydantic to `>=2.10.0` without an upper bound, but in practice keep below 2.11.

**Why:** `langchain-core 1.4.7` imports `can_be_positional` from pydantic's internal API. pydantic 2.11 removed or moved this symbol, causing `ImportError: cannot import name 'can_be_positional'` at startup.

**Note:** `langchain>=0.3.0` is required (not 0.1.x) for Python 3.12 compatibility — 0.1.x fails with `ForwardRef._evaluate() missing 1 required keyword-only argument: 'recursive_guard'`.

---

## D10 — `fastapi>=0.115.0`

**Decision:** Require FastAPI 0.115+.

**Why:** FastAPI 0.104.1 with pydantic 2.x raises `AttributeError: 'FieldInfo' object has no attribute 'in_'`. 0.115+ fixed this. Since pydantic 2.x is required (for langchain), FastAPI must also be at 0.115+.

---

## D11 — `AWS_REGION` must NOT appear in `.env`

**Decision:** Do not put `AWS_REGION=us-east-1` in `.env`. Use `BEDROCK_REGION` instead.

**Why:** `Settings(BaseSettings)` has `extra=forbid` (implied by pydantic-settings v2 defaults). `AWS_REGION` is not a declared field. When pydantic-settings reads the `.env` file, it finds the undeclared `AWS_REGION` key and raises `Extra inputs are not permitted`, crashing the app on startup.

`boto3` reads `AWS_REGION` natively from the OS environment — it does not need to go through our Settings class. The `BEDROCK_REGION` setting in our config is passed explicitly to `session.client(region_name=settings.bedrock_region)`.

---

## D12 — Immutable prompt versions; `active_version_id` pointer

**Decision:** Saving a new prompt always creates a new `PromptVersion` row. Existing rows are never updated. `Prompt.active_version_id` is a nullable FK that points to the currently active version.

**Why:** Provides full audit history. Operators can see every version of every prompt and when it was activated. The pipeline records `prompt_version_id` on each `RfqRun` for traceability — you can always replay a run with the exact prompt it used. Concurrent edits are safe (new immutable row; activation is a single pointer write).

---

## D13 — Three-level fallback for system prompt

**Decision:** The generator tries: (1) active DB prompt, (2) `system_prompt.md` on disk, (3) hardcoded string `"You are a quotation generation agent."`.

**Why:** A fresh deployment might have an empty database. The file might be missing in some environments. The hardcoded fallback ensures generation never hard-fails due to a missing prompt — the user gets a degraded but functional output.

---

## D14 — Role enforcement in backend; frontend hides routes as convenience only

**Decision:** FastAPI dependencies (`require_role`) are the enforcement boundary. Frontend `RequireRole` guards are UI-only and do not substitute for API enforcement.

**Why:** Frontend route guards can be bypassed by directly calling the API. Backend enforces roles on every request. The frontend guards are only there to avoid showing unavailable navigation items to users, preventing confusing 403 errors.

---

## D15 — Alembic migration was hand-written, not autogenerated

**Decision:** The initial migration `27c9e7a3bfc9` was written by hand rather than produced by `alembic revision --autogenerate`.

**Why:** Autogenerate referenced `app.models.db.UUID` in the generated migration file without importing it, causing `NameError` on `alembic upgrade`. The solution was to hand-write the migration using `sqlalchemy.dialects.postgresql.UUID` and `JSONB` directly, which are stable importable symbols. The migration has been applied to production and must not be edited; future schema changes should be new revisions.

---

## D16 — Frontend API client uses `baseURL: '/'` with Vite proxy

**Decision:** axios `baseURL` is `'/'`. Vite dev server proxies `/auth`, `/rfqs`, `/prompts`, `/metrics`, `/users` to `http://localhost:8000`.

**Why:** Avoids CORS issues in development (same-origin requests from the browser's perspective). In production, an nginx reverse proxy or FastAPI `StaticFiles` would serve the built frontend and proxy API calls, preserving the same URL structure.

---

## D17 — Login uses `URLSearchParams`, not JSON

**Decision:** `authApi.login()` sends `new URLSearchParams({username: email, password})`, not `JSON.stringify`.

**Why:** FastAPI's `OAuth2PasswordRequestForm` dependency expects `application/x-www-form-urlencoded` — this is mandated by the OAuth2 spec. Sending JSON would return `422 Unprocessable Entity`.
