# NimAI RFQ Generator — Architecture Reference

> Read before making structural changes. Focuses on non-obvious decisions.

## Pipeline Flow

```
POST /rfqs/extract (file) or /rfqs/extract-text (text)
  → rfq_service.create_run() [status=pending_confirmation]
  → extract_rfq_metadata() [LLM: 4 fields: company, product, date, rfq_no]
  → returns RfqRunOut immediately (synchronous, ~10-120s)

POST /rfqs/{id}/confirm
  → rfq_service.save_metadata() + set_confirmed()
  → extract_data_points() [LLM: targeted per ProductRequiredFields definition]
  → status=pending_data, returns data_points[]

POST /rfqs/{id}/submit-data
  → validates required fields against ProductRequiredFields
  → rfq_service.save_data_points() + set_data_confirmed()
  → process_rfq_task.delay() [Celery async]
  → status=queued

Celery _run_pipeline:
  queued → parsing → extracting → retrieving → generating → done/failed
  extract_rfq_structured() [LLM: full schema ~200 lines]
  retrieve_similar_structured() [FAISS, returns [] if store absent]
  generate_quote_from_structured() [LLM: result_json]
  complete_run(result_json) → status=done
```

## Non-Obvious Implementation Details

1. **Portable TypeDecorators in `db.py`** — `UUID` and `JSONB` are custom `TypeDecorator` subclasses, NOT `sqlalchemy.dialects.postgresql.*`. They map to `CHAR(36)`/`Text` on SQLite (tests) and native types on Postgres. Do not replace them — tests will break.

2. **`conftest.py` import order is critical** — `os.environ.setdefault("DATABASE_URL", "sqlite+...")` must run before any app import. pydantic-settings reads env at class-definition time; any early import of `Settings` will pick up the Postgres URL.

3. **`StaticPool` in tests** — SQLite in-memory creates a new DB per connection. Without `StaticPool`, `db.refresh(obj)` after `db.commit()` opens a second connection to an empty database.

4. **`Prompt ↔ PromptVersion` circular FK** — `Prompt.active_version_id → PromptVersion` and `PromptVersion.prompt_id → Prompt`. Resolved with `use_alter=True, name="fk_prompt_active_version"`. Do not let Alembic autogenerate re-run the initial migration.

5. **Lazy LLM + task imports** — `get_llm()` and `from app.worker.tasks import process_rfq_task` must be inside function bodies, never at module level. `langchain_aws` triggers heavy imports; AWS credentials may be absent at API startup.

6. **FAISS fallback** — `retriever.py` returns `[]` if `vector_store_dir` doesn't exist. Generation proceeds with no context — intentional for fresh deployments.

7. **Three-level prompt fallback** in worker — (1) active DB version, (2) `system_prompt.md` file, (3) hardcoded string. All three must remain.

8. **Alembic migrations hand-written** — `27c9e7a3bfc9` (initial) and `a1b2c3d4e5f6` (new tables/columns/enums) both applied to Rancher Postgres. Never edit them; add a new revision for further changes.

9. **RunStatus enum values** — `pending_confirmation` and `pending_data` were added in migration `a1b2c3d4e5f6`. Any new status values need a new migration (Postgres enums require `ALTER TYPE`).

## Version Pins (Reasons)

| Package | Pin | Reason |
|---|---|---|
| `bcrypt` | `==3.2.2` | 4.x breaks passlib ("password cannot be longer than 72 bytes") |
| `passlib[bcrypt]` | `==1.7.4` | must stay at 1.7.x with bcrypt 3.2 |
| `pydantic` | `==2.10.x` | 2.11+ breaks langchain-core 1.4.7 (`can_be_positional` import error) |
