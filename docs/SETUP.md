# Environment Setup & LLM Config

## Start all services

```powershell
.\start.ps1   # from project root — starts Redis, FastAPI, Celery, Vite
```

## Manual startup

```powershell
# Redis (Docker)
docker run -d -p 6379:6379 redis:7

# Backend
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.api.main:app --reload --port 8000

# Celery — MUST use --pool=solo on Windows
celery -A app.worker.tasks worker --loglevel=info --pool=solo

# Frontend
cd frontend
npm run dev     # http://localhost:5173

# Tests
cd backend
python -m pytest tests/ -v
```

## LLM Quick Switch

Set one variable in `backend/.env` to switch all LLM calls at once:

```ini
LLM_PRESET=local     # Ollama — qwen2.5:14b
LLM_PRESET=gemini    # Gemini 2.5 Flash via Google OpenAI-compat endpoint
LLM_PRESET=bedrock   # Qwen3 32B on AWS Bedrock
```

Each preset still needs its own credentials (see sections below). Leave `LLM_PRESET` blank to use the individual `*_PROVIDER` / `*_MODEL` vars.

---

## LLM Provider Config (backend/.env)

### Ollama (zero cost, local)
```
EXTRACTOR_PROVIDER=ollama
GENERATOR_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:14b
OLLAMA_TIMEOUT=300
```
Start with: `ollama serve` (pull once: `ollama pull qwen2.5:14b`)

### LM Studio (OpenAI-compatible, local)
```
EXTRACTOR_PROVIDER=openai
GENERATOR_PROVIDER=openai
EXTRACTOR_MODEL=qwen2.5-14b-instruct   # exact ID from LM Studio Developer tab
GENERATOR_MODEL=qwen2.5-14b-instruct
OPENAI_API_KEY=lm-studio
OPENAI_BASE_URL=http://localhost:1234/v1
OPENAI_TIMEOUT=300
```

### Google Gemini (via OpenAI-compatible endpoint)
```
EXTRACTOR_PROVIDER=openai
GENERATOR_PROVIDER=openai
EXTRACTOR_MODEL=gemini-2.5-flash
GENERATOR_MODEL=gemini-2.5-flash
OPENAI_API_KEY=<your-gemini-key>
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
OPENAI_TIMEOUT=300
```

### AWS Bedrock (production)
```
EXTRACTOR_PROVIDER=bedrock
GENERATOR_PROVIDER=bedrock
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0
AWS_PROFILE=   # blank = default boto3 chain
```
Do NOT add `AWS_REGION` to `.env`.

---

## Test Data

### Users (auto-seeded on every backend startup)

No SQL needed — `seed_test_users()` runs at startup and is idempotent.

| Email | Password | Role | Can Approve |
|---|---|---|---|
| `admin@nimai.ai` | `password!123` | super_admin | ✅ |
| `alice.finance@nimai.ai` | `Test@1234` | admin | ✅ |
| `bob.engineering@nimai.ai` | `Test@1234` | admin | ✅ |
| `carol.director@nimai.ai` | `Test@1234` | admin | ✅ |
| `dave.sales@nimai.ai` | `Test@1234` | end_user | ✅ |
| `eve.procurement@nimai.ai` | `Test@1234` | end_user | ✅ |
| `frank.viewer@nimai.ai` | `Test@1234` | end_user | ❌ |
| `grace.submitter@nimai.ai` | `Test@1234` | end_user | ❌ |

See `TESTERS.md` for full scenario walkthrough.

### Products (manual — run once after `alembic upgrade head`)

Admin can add products via UI at `/admin/products`, or run this SQL directly against Postgres:

```sql
INSERT INTO product_required_fields (id, product_name, fields, created_at, updated_at) VALUES
(
  gen_random_uuid(),
  'Process Column',
  '["tag_no","moc","capacity_or_size","orientation","inside_diameter","height_tl_tl","shell_thickness","design_pressure","design_temperature","operating_pressure","operating_temperature","design_code","corrosion_allowance","radiography","joint_efficiency","hydrotest_pressure","nozzle_schedule","support_type","surface_finish","quantity"]'::jsonb,
  NOW(), NOW()
),
(
  gen_random_uuid(),
  'Pressure Vessel',
  '["tag_no","moc","capacity","orientation","inside_diameter","shell_thickness","design_pressure","design_temperature","operating_pressure","operating_temperature","design_code","corrosion_allowance","radiography","joint_efficiency","hydrotest_pressure","nozzle_schedule","support_type","surface_finish","quantity"]'::jsonb,
  NOW(), NOW()
),
(
  gen_random_uuid(),
  'Heat Exchanger',
  '["tag_no","type","moc_shell","moc_tube","shell_side_fluid","tube_side_fluid","heat_duty","area","design_pressure_shell","design_pressure_tube","design_temperature_shell","design_temperature_tube","design_code","corrosion_allowance","no_of_passes","baffle_type","nozzle_schedule","surface_finish","quantity"]'::jsonb,
  NOW(), NOW()
),
(
  gen_random_uuid(),
  'Storage Tank',
  '["tag_no","moc","capacity","diameter","height","roof_type","shell_thickness","bottom_thickness","roof_thickness","design_pressure","design_temperature","stored_fluid","corrosion_allowance","foundation_type","surface_finish","quantity"]'::jsonb,
  NOW(), NOW()
),
(
  gen_random_uuid(),
  'Reactor',
  '["tag_no","moc","capacity","orientation","inside_diameter","height_tl_tl","shell_thickness","jacket_type","agitator_type","agitator_moc","motor_kw","design_pressure","design_temperature","operating_pressure","operating_temperature","design_code","corrosion_allowance","nozzle_schedule","surface_finish","quantity"]'::jsonb,
  NOW(), NOW()
);
```
