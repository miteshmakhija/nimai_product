# RFQ Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build NimAIRFQGenerator — a React frontend (reusing the Compliance Central design system) on a FastAPI backend (copied from quote-agent) with JWT auth + 3 roles, DB-stored versioned system prompts, persisted RFQ runs, and a role-scoped dashboard.

**Architecture:** Single FastAPI backend in `backend/` (copied from `quote-agent`, then extended). New Vite/React/TS frontend in `frontend/` (components ported from `resources/ComplianCentralDesign_pkg`). React talks only to FastAPI via `/api/*`. Postgres + Redis + Celery run via Docker Compose. The LLM is mocked in all automated tests.

**Tech Stack:** Backend: FastAPI, SQLAlchemy 2.0, Alembic, Celery, Redis, PostgreSQL 15, passlib[bcrypt], python-jose (JWT), pytest. Frontend: Vite 6, React 18, TypeScript, Tailwind v4, Radix UI, react-router 7, Vitest + React Testing Library. LLM: OpenAI gpt-4o-mini (default).

---

## External Prerequisites (confirmed)

- **PostgreSQL 16** running in Rancher (not Docker). Connection: `localhost:5432`, db `quotes`, user `user`, pass `pass` (update `DATABASE_URL` in `.env` with actual Rancher host/port if not localhost).
- **Redis** — NOT available locally. Use Docker for Redis only: `docker run -d -p 6379:6379 redis:7`. The Celery broker/backend URL stays `redis://localhost:6379/0`.
- **OpenAI API key** — to be provided later. Put `OPENAI_API_KEY=sk-...` in `backend/.env` when available.
- **Seed admin** — `SEED_ADMIN_EMAIL=admin@nimai.ai`, `SEED_ADMIN_PASSWORD=password!123`.
- **JWT secret** — `JWT_SECRET` in `.env`; dev default provided, use a strong value for prod.
- **Versions** — Node 20 LTS, Python 3.11.

Dev URLs: API `http://localhost:8000`, docs `http://localhost:8000/docs`, frontend `http://localhost:5173`, Postgres via Rancher, Redis `localhost:6379`.

---

## File Structure

```
NimAIRFQGenerator/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── main.py                 # FastAPI app, CORS, router mounting, startup seed
│   │   │   └── routers/
│   │   │       ├── auth.py             # POST /auth/login, /auth/refresh, GET /auth/me
│   │   │       ├── users.py            # CRUD users (super_admin)
│   │   │       ├── prompts.py          # prompts + versions CRUD + activate
│   │   │       ├── rfqs.py             # submit (file|text), list, get one, status
│   │   │       └── metrics.py          # dashboard aggregates (role-scoped)
│   │   ├── core/
│   │   │   ├── config.py               # Settings (+ jwt, seed admin, cors)
│   │   │   ├── security.py             # hashing, JWT, role dependencies
│   │   │   └── llm.py                  # copied unchanged
│   │   ├── db/
│   │   │   └── session.py              # engine, SessionLocal, get_db, Base import
│   │   ├── models/
│   │   │   ├── db.py                   # copied + User, Prompt, PromptVersion, RfqRun
│   │   │   └── schemas.py              # copied + new Pydantic request/response models
│   │   ├── services/
│   │   │   ├── auth_service.py         # authenticate, create user, seed admin
│   │   │   ├── prompt_service.py       # versioning, activate, get_active_content
│   │   │   ├── rfq_service.py          # run CRUD + status transitions
│   │   │   ├── metrics_service.py      # aggregate queries
│   │   │   ├── generator.py            # copied + read active prompt from DB
│   │   │   └── (parser/extractor/retriever/... copied unchanged)
│   │   ├── worker/tasks.py             # copied + DB persistence + text input + status
│   │   └── prompts/system_prompt.md    # copied; seeds generation prompt v1
│   ├── alembic/                        # migrations
│   ├── alembic.ini
│   ├── requirements.txt                # copied + auth deps
│   ├── Dockerfile
│   ├── .env.example
│   └── tests/
│       ├── conftest.py                 # test DB + client fixtures, LLM mock
│       ├── test_security.py
│       ├── test_auth_routes.py
│       ├── test_prompt_service.py
│       ├── test_prompts_routes.py
│       ├── test_rfq_service.py
│       ├── test_rfqs_routes.py
│       ├── test_metrics_routes.py
│       └── test_pipeline.py
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx
│   │   │   ├── routes.tsx
│   │   │   ├── components/             # ported ui/* + layout/sidebar/topbar/theme/toast
│   │   │   └── pages/
│   │   │       ├── login.tsx
│   │   │       ├── dashboard.tsx
│   │   │       ├── rfq-new.tsx
│   │   │       ├── rfqs.tsx
│   │   │       ├── prompts.tsx
│   │   │       └── users.tsx
│   │   ├── api/
│   │   │   ├── client.ts               # fetch wrapper w/ auth header + refresh
│   │   │   ├── auth.ts                 # login/refresh/me typed calls
│   │   │   ├── prompts.ts
│   │   │   ├── rfqs.ts
│   │   │   ├── users.ts
│   │   │   └── metrics.ts
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── styles/
│   │   └── main.tsx
│   ├── vite.config.ts                  # proxy /api -> :8000
│   ├── tsconfig.json
│   ├── package.json
│   └── src/**/__tests__/*.test.tsx
├── docker-compose.yml
├── .env.example
└── docs/superpowers/{specs,plans}/
```

---

## Milestone M0 — Backend skeleton copied & running

### Task 0.1: Copy quote-agent backend into backend/

**Files:**
- Create: `backend/` (copy of `quote-agent` minus git/ui/streamlit)

- [ ] **Step 1: Copy the backend tree**

Run (Git Bash):
```bash
cd "c:/Users/sdisawal/OneDrive - NiCE Ltd/1_Work/4_Code/RFQGenerator"
mkdir -p backend
cp -r quote-agent/app backend/app
cp quote-agent/requirements.txt backend/requirements.txt
cp quote-agent/Dockerfile backend/Dockerfile
cp quote-agent/.env.example backend/.env.example
cp -r quote-agent/scripts backend/scripts 2>/dev/null || true
cp -r quote-agent/data backend/data 2>/dev/null || true
# Drop the Streamlit UI — replaced by React
rm -rf backend/app/ui
```

- [ ] **Step 2: Remove streamlit from requirements**

Edit `backend/requirements.txt`: delete the line `streamlit`.

- [ ] **Step 3: Add auth + migration + test deps to requirements**

Append to `backend/requirements.txt`:
```
passlib[bcrypt]==1.7.4
python-jose[cryptography]==3.3.0
alembic==1.13.1
pytest==8.0.0
pytest-asyncio==0.23.5
email-validator==2.1.0
```

- [ ] **Step 4: Create venv and install**

Run (PowerShell):
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
Expected: installs without error.

- [ ] **Step 5: Commit**
```bash
git add backend/ && git commit -m "chore: copy quote-agent backend into backend/ (drop streamlit)"
```

### Task 0.2: Add DB session management

**Files:**
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/__init__.py` (empty)

- [ ] **Step 1: Create the session module**

Create `backend/app/db/session.py`:
```python
# app/db/session.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import get_settings
from app.models.db import Base

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all():
    """Create all tables (used in tests and first-run bootstrap)."""
    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 2: Create empty package marker**

Create `backend/app/db/__init__.py` (empty file).

- [ ] **Step 3: Commit**
```bash
git add backend/app/db/ && git commit -m "feat(backend): add SQLAlchemy session management"
```

### Task 0.3: Extend config with auth/CORS/seed settings

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Add fields to the Settings class**

In `backend/app/core/config.py`, inside `class Settings(BaseSettings)`, after the `redis_url` line, add:
```python
    # Auth / JWT
    jwt_secret: str = "dev-insecure-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30
    refresh_token_ttl_days: int = 7

    # CORS (frontend origins)
    cors_origins: str = "http://localhost:5173,http://localhost:4173"

    # Seed super admin
    seed_admin_email: str = "admin@local.dev"
    seed_admin_password: str = "ChangeMe!123"
```

- [ ] **Step 2: Add a parsed-origins helper**

In the same file, add a method inside `Settings`:
```python
    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]
```

- [ ] **Step 3: Verify import works**

Run: `python -c "from app.core.config import get_settings; print(get_settings().cors_origin_list)"`
Expected: `['http://localhost:5173', 'http://localhost:4173']`

- [ ] **Step 4: Commit**
```bash
git add backend/app/core/config.py && git commit -m "feat(backend): add JWT, CORS, seed-admin settings"
```

---

## Milestone M1 — Data model & migrations

### Task 1.1: Add User, Prompt, PromptVersion, RfqRun models

**Files:**
- Modify: `backend/app/models/db.py`

- [ ] **Step 1: Add enums and new models at the end of db.py**

Append to `backend/app/models/db.py`:
```python
import enum
from sqlalchemy import Integer, Boolean, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    end_user = "end_user"


class RunStatus(str, enum.Enum):
    queued = "queued"
    parsing = "parsing"
    extracting = "extracting"
    retrieving = "retrieving"
    generating = "generating"
    done = "done"
    failed = "failed"


class InputType(str, enum.Enum):
    file = "file"
    text = "text"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False, default="")
    password_hash = Column(Text, nullable=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.end_user)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    active_version_id = Column(UUID(as_uuid=True), ForeignKey("prompt_versions.id", use_alter=True, name="fk_prompt_active_version"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    versions = relationship("PromptVersion", back_populates="prompt", foreign_keys="PromptVersion.prompt_id", cascade="all, delete-orphan")


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id"), nullable=False)
    version = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    note = Column(Text, default="")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    prompt = relationship("Prompt", back_populates="versions", foreign_keys=[prompt_id])


class RfqRun(Base):
    __tablename__ = "rfq_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(String(255), nullable=True, index=True)
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    input_type = Column(SAEnum(InputType, name="input_type"), nullable=False)
    source_filename = Column(String(255), nullable=True)
    source_text = Column(Text, nullable=True)
    status = Column(SAEnum(RunStatus, name="run_status"), nullable=False, default=RunStatus.queued)
    prompt_version_id = Column(UUID(as_uuid=True), ForeignKey("prompt_versions.id"), nullable=True)
    result_json = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
```

- [ ] **Step 2: Verify models import and tables register**

Run: `python -c "from app.models.db import Base, User, Prompt, PromptVersion, RfqRun; print(sorted(Base.metadata.tables))"`
Expected: list includes `prompt_versions`, `prompts`, `rfq_runs`, `users` (plus existing conversations/rfqs/quotes).

- [ ] **Step 3: Commit**
```bash
git add backend/app/models/db.py && git commit -m "feat(backend): add User, Prompt, PromptVersion, RfqRun models"
```

### Task 1.2: Initialize Alembic and generate the first migration

**Files:**
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/*`

- [ ] **Step 1: Init alembic**

Run (in `backend/`, venv active):
```bash
alembic init alembic
```

- [ ] **Step 2: Point alembic at our metadata and URL**

Edit `backend/alembic/env.py`: near the top after imports add:
```python
from app.core.config import get_settings
from app.models.db import Base
config.set_main_option("sqlalchemy.url", get_settings().database_url)
target_metadata = Base.metadata
```
(Remove the default `target_metadata = None` line.)

- [ ] **Step 3: Generate migration (requires DB up — see Task 5.1; or run after M5)**

Run:
```bash
alembic revision --autogenerate -m "add users, prompts, prompt_versions, rfq_runs"
```
Expected: a new file under `backend/alembic/versions/`.

- [ ] **Step 4: Commit**
```bash
git add backend/alembic* && git commit -m "feat(backend): alembic setup + initial migration"
```

> Note: If the DB isn't running yet, defer Steps 3 once `docker compose up db` is available (Task 5.1). Tests use `create_all()` against SQLite/Postgres test DB and don't depend on Alembic.

---

## Milestone M2 — Auth (security + service + routes)

### Task 2.1: Security helpers (hashing + JWT)

**Files:**
- Create: `backend/app/core/security.py`
- Test: `backend/tests/test_security.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write conftest with a test DB + client + LLM mock**

Create `backend/tests/conftest.py`:
```python
import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture()
def db_session():
    from app.models.db import Base
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    from app.api.main import app
    from app.db.session import get_db
    app.dependency_overrides[get_db] = lambda: db_session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

> Note: SQLite lacks native `JSONB`/`UUID`. If a test using `RfqRun.result_json` fails on SQLite, switch `db_session` to a Postgres test DB URL via `TEST_DATABASE_URL` env (documented in test README). Auth/prompt tests below use only String/Text/Integer columns and run fine on SQLite.

- [ ] **Step 2: Write the failing test for hashing + JWT**

Create `backend/tests/test_security.py`:
```python
import pytest
from datetime import timedelta
from app.core import security


def test_password_hash_roundtrip():
    h = security.hash_password("s3cret")
    assert h != "s3cret"
    assert security.verify_password("s3cret", h) is True
    assert security.verify_password("wrong", h) is False


def test_jwt_encode_decode():
    token = security.create_access_token({"sub": "user-123", "role": "admin"})
    payload = security.decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["role"] == "admin"


def test_jwt_expired_raises():
    token = security.create_access_token({"sub": "u"}, expires_delta=timedelta(seconds=-1))
    with pytest.raises(security.TokenError):
        security.decode_token(token)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_security.py -v`
Expected: FAIL (module `app.core.security` has no `hash_password`).

- [ ] **Step 4: Implement security.py**

Create `backend/app/core/security.py`:
```python
# app/core/security.py
from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.core.config import get_settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(Exception):
    pass


def hash_password(password: str) -> str:
    return _pwd.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    s = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=s.access_token_ttl_minutes))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, s.jwt_secret, algorithm=s.jwt_algorithm)


def create_refresh_token(data: dict) -> str:
    s = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=s.refresh_token_ttl_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, s.jwt_secret, algorithm=s.jwt_algorithm)


def decode_token(token: str) -> dict:
    s = get_settings()
    try:
        return jwt.decode(token, s.jwt_secret, algorithms=[s.jwt_algorithm])
    except JWTError as e:
        raise TokenError(str(e))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_security.py -v`
Expected: 3 passed.

- [ ] **Step 6: Commit**
```bash
git add backend/app/core/security.py backend/tests/conftest.py backend/tests/test_security.py
git commit -m "feat(backend): password hashing + JWT helpers with tests"
```

### Task 2.2: Auth service + role dependencies

**Files:**
- Create: `backend/app/services/auth_service.py`
- Modify: `backend/app/core/security.py` (add FastAPI deps)

- [ ] **Step 1: Add user-lookup + role dependencies to security.py**

Append to `backend/app/core/security.py`:
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.db import User, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = decode_token(token)
    except TokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found/inactive")
    return user


def require_role(*roles: UserRole):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return _dep
```

> Note: `payload.get("sub")` is a string; SQLAlchemy compares against the UUID column. SQLite stores UUID as string so this matches; on Postgres, cast in the query if needed (`User.id == uuid.UUID(payload["sub"])`). The auth_service stores `str(user.id)` in the token `sub` (Step 2).

- [ ] **Step 2: Implement auth_service.py**

Create `backend/app/services/auth_service.py`:
```python
# app/services/auth_service.py
from sqlalchemy.orm import Session
from app.models.db import User, UserRole
from app.core import security


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email).first()
    if not user or not user.is_active:
        return None
    if not security.verify_password(password, user.password_hash):
        return None
    return user


def create_user(db: Session, email: str, password: str, full_name: str = "",
                role: UserRole = UserRole.end_user) -> User:
    user = User(
        email=email,
        full_name=full_name,
        password_hash=security.hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def tokens_for_user(user: User) -> dict:
    claims = {"sub": str(user.id), "role": user.role.value, "email": user.email}
    return {
        "access_token": security.create_access_token(claims),
        "refresh_token": security.create_refresh_token({"sub": str(user.id)}),
        "token_type": "bearer",
    }


def seed_super_admin(db: Session, email: str, password: str) -> User | None:
    """Create the seed super_admin if it doesn't already exist."""
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing
    return create_user(db, email, password, full_name="Super Admin", role=UserRole.super_admin)
```

- [ ] **Step 3: Commit**
```bash
git add backend/app/services/auth_service.py backend/app/core/security.py
git commit -m "feat(backend): auth service + role dependencies"
```

### Task 2.3: Auth schemas + routes

**Files:**
- Modify: `backend/app/models/schemas.py`
- Create: `backend/app/api/routers/__init__.py` (empty)
- Create: `backend/app/api/routers/auth.py`
- Test: `backend/tests/test_auth_routes.py`

- [ ] **Step 1: Add auth Pydantic schemas**

Append to `backend/app/models/schemas.py`:
```python
from pydantic import EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Write the failing auth route test**

Create `backend/tests/test_auth_routes.py`:
```python
from app.services import auth_service
from app.models.db import UserRole


def test_login_success_and_me(client, db_session):
    auth_service.create_user(db_session, "a@b.com", "pw12345", role=UserRole.admin)
    r = client.post("/auth/login", data={"username": "a@b.com", "password": "pw12345"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "a@b.com"
    assert me.json()["role"] == "admin"


def test_login_bad_password(client, db_session):
    auth_service.create_user(db_session, "a@b.com", "pw12345")
    r = client.post("/auth/login", data={"username": "a@b.com", "password": "wrong"})
    assert r.status_code == 401
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_auth_routes.py -v`
Expected: FAIL (no `/auth/login` route / app import error). Resolve once main.py mounts the router (Task 4.1) — until then this fails at app import. Implement Steps 4-5, then run after Task 4.1.

- [ ] **Step 4: Implement auth router**

Create `backend/app/api/routers/auth.py`:
```python
# app/api/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.services import auth_service
from app.core import security
from app.models.db import User
from app.models.schemas import TokenResponse, RefreshRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return auth_service.tokens_for_user(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = security.decode_token(body.refresh_token)
    except security.TokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong token type")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return auth_service.tokens_for_user(user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(security.get_current_user)):
    return UserOut(id=str(user.id), email=user.email, full_name=user.full_name,
                   role=user.role.value, is_active=user.is_active)
```

- [ ] **Step 5: Create routers package marker**

Create `backend/app/api/routers/__init__.py` (empty).

- [ ] **Step 6: Commit (tests run green after Task 4.1)**
```bash
git add backend/app/api/routers/ backend/app/models/schemas.py backend/tests/test_auth_routes.py
git commit -m "feat(backend): auth schemas + login/refresh/me routes"
```

---

## Milestone M3 — Prompts, RFQ runs, metrics services + routes

### Task 3.1: Prompt versioning service

**Files:**
- Create: `backend/app/services/prompt_service.py`
- Test: `backend/tests/test_prompt_service.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_prompt_service.py`:
```python
from app.services import prompt_service


def test_create_prompt_and_first_version(db_session):
    p = prompt_service.create_prompt(db_session, key="generation", name="Generation",
                                     content="v1 content")
    assert p.key == "generation"
    active = prompt_service.get_active_content(db_session, "generation")
    assert active == "v1 content"


def test_new_version_increments_and_activate(db_session):
    prompt_service.create_prompt(db_session, key="generation", name="Generation", content="v1")
    v2 = prompt_service.add_version(db_session, "generation", content="v2", note="tweak")
    assert v2.version == 2
    # still active = v1 until we activate
    assert prompt_service.get_active_content(db_session, "generation") == "v1"
    prompt_service.set_active(db_session, "generation", v2.id)
    assert prompt_service.get_active_content(db_session, "generation") == "v2"


def test_get_active_content_missing_returns_none(db_session):
    assert prompt_service.get_active_content(db_session, "nope") is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest tests/test_prompt_service.py -v`
Expected: FAIL (no module).

- [ ] **Step 3: Implement prompt_service.py**

Create `backend/app/services/prompt_service.py`:
```python
# app/services/prompt_service.py
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.db import Prompt, PromptVersion


def create_prompt(db: Session, key: str, name: str, content: str,
                  description: str = "", created_by: UUID | None = None) -> Prompt:
    prompt = Prompt(key=key, name=name, description=description)
    db.add(prompt)
    db.flush()  # get prompt.id
    v1 = PromptVersion(prompt_id=prompt.id, version=1, content=content, created_by=created_by)
    db.add(v1)
    db.flush()
    prompt.active_version_id = v1.id
    db.commit()
    db.refresh(prompt)
    return prompt


def _get_prompt(db: Session, key: str) -> Prompt | None:
    return db.query(Prompt).filter(Prompt.key == key).first()


def add_version(db: Session, key: str, content: str, note: str = "",
                created_by: UUID | None = None) -> PromptVersion:
    prompt = _get_prompt(db, key)
    if not prompt:
        raise ValueError(f"Prompt '{key}' not found")
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


def set_active(db: Session, key: str, version_id: UUID) -> Prompt:
    prompt = _get_prompt(db, key)
    if not prompt:
        raise ValueError(f"Prompt '{key}' not found")
    prompt.active_version_id = version_id
    db.commit()
    db.refresh(prompt)
    return prompt


def get_active_content(db: Session, key: str) -> str | None:
    prompt = _get_prompt(db, key)
    if not prompt or not prompt.active_version_id:
        return None
    ver = db.query(PromptVersion).filter(PromptVersion.id == prompt.active_version_id).first()
    return ver.content if ver else None


def get_active_version_id(db: Session, key: str) -> UUID | None:
    prompt = _get_prompt(db, key)
    return prompt.active_version_id if prompt else None


def list_prompts(db: Session) -> list[Prompt]:
    return db.query(Prompt).order_by(Prompt.key).all()


def list_versions(db: Session, key: str) -> list[PromptVersion]:
    prompt = _get_prompt(db, key)
    if not prompt:
        return []
    return (db.query(PromptVersion)
              .filter(PromptVersion.prompt_id == prompt.id)
              .order_by(PromptVersion.version.desc()).all())
```

- [ ] **Step 4: Run to verify it passes**

Run: `pytest tests/test_prompt_service.py -v`
Expected: 3 passed.

- [ ] **Step 5: Commit**
```bash
git add backend/app/services/prompt_service.py backend/tests/test_prompt_service.py
git commit -m "feat(backend): prompt versioning service with tests"
```

### Task 3.2: Prompt schemas + routes

**Files:**
- Modify: `backend/app/models/schemas.py`
- Create: `backend/app/api/routers/prompts.py`
- Test: `backend/tests/test_prompts_routes.py`

- [ ] **Step 1: Add prompt schemas**

Append to `backend/app/models/schemas.py`:
```python
from typing import Any


class PromptVersionOut(BaseModel):
    id: str
    version: int
    content: str
    note: str
    created_at: str

    class Config:
        from_attributes = True


class PromptOut(BaseModel):
    id: str
    key: str
    name: str
    description: str
    active_version_id: Optional[str]

    class Config:
        from_attributes = True


class NewVersionRequest(BaseModel):
    content: str
    note: str = ""


class SetActiveRequest(BaseModel):
    version_id: str
```

- [ ] **Step 2: Write failing route test**

Create `backend/tests/test_prompts_routes.py`:
```python
from app.services import auth_service, prompt_service
from app.models.db import UserRole


def _auth(client, db_session, role):
    auth_service.create_user(db_session, "u@x.com", "pw12345", role=role)
    r = client.post("/auth/login", data={"username": "u@x.com", "password": "pw12345"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_end_user_cannot_list_prompts(client, db_session):
    h = _auth(client, db_session, UserRole.end_user)
    assert client.get("/prompts", headers=h).status_code == 403


def test_admin_can_create_version_and_activate(client, db_session):
    prompt_service.create_prompt(db_session, "generation", "Generation", "v1")
    h = _auth(client, db_session, UserRole.admin)
    r = client.post("/prompts/generation/versions",
                    json={"content": "v2", "note": "n"}, headers=h)
    assert r.status_code == 201
    vid = r.json()["id"]
    a = client.post("/prompts/generation/activate",
                    json={"version_id": vid}, headers=h)
    assert a.status_code == 200
```

- [ ] **Step 3: Run to verify it fails**

Run: `pytest tests/test_prompts_routes.py -v`
Expected: FAIL (no `/prompts` routes — after Task 4.1 mounts router).

- [ ] **Step 4: Implement prompts router**

Create `backend/app/api/routers/prompts.py`:
```python
# app/api/routers/prompts.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_role
from app.models.db import UserRole, User
from app.services import prompt_service
from app.models.schemas import PromptOut, PromptVersionOut, NewVersionRequest, SetActiveRequest

router = APIRouter(prefix="/prompts", tags=["prompts"])
ManagePrompts = require_role(UserRole.admin, UserRole.super_admin)


def _ver_out(v) -> PromptVersionOut:
    return PromptVersionOut(id=str(v.id), version=v.version, content=v.content,
                            note=v.note or "", created_at=v.created_at.isoformat())


@router.get("", response_model=list[PromptOut])
def list_prompts(db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    return [PromptOut(id=str(p.id), key=p.key, name=p.name, description=p.description or "",
                      active_version_id=str(p.active_version_id) if p.active_version_id else None)
            for p in prompt_service.list_prompts(db)]


@router.get("/{key}/versions", response_model=list[PromptVersionOut])
def list_versions(key: str, db: Session = Depends(get_db), _: User = Depends(ManagePrompts)):
    return [_ver_out(v) for v in prompt_service.list_versions(db, key)]


@router.post("/{key}/versions", response_model=PromptVersionOut, status_code=201)
def add_version(key: str, body: NewVersionRequest, db: Session = Depends(get_db),
                user: User = Depends(ManagePrompts)):
    try:
        v = prompt_service.add_version(db, key, body.content, body.note, created_by=user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _ver_out(v)


@router.post("/{key}/activate", response_model=PromptOut)
def activate(key: str, body: SetActiveRequest, db: Session = Depends(get_db),
             _: User = Depends(ManagePrompts)):
    from uuid import UUID
    try:
        p = prompt_service.set_active(db, key, UUID(body.version_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return PromptOut(id=str(p.id), key=p.key, name=p.name, description=p.description or "",
                     active_version_id=str(p.active_version_id) if p.active_version_id else None)
```

- [ ] **Step 5: Commit**
```bash
git add backend/app/api/routers/prompts.py backend/app/models/schemas.py backend/tests/test_prompts_routes.py
git commit -m "feat(backend): prompts routes (list/versions/activate) with role gating"
```

### Task 3.3: RFQ run service

**Files:**
- Create: `backend/app/services/rfq_service.py`
- Test: `backend/tests/test_rfq_service.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_rfq_service.py`:
```python
from app.services import rfq_service, auth_service
from app.models.db import RunStatus, InputType, UserRole


def test_create_and_transition_run(db_session):
    u = auth_service.create_user(db_session, "e@x.com", "pw12345")
    run = rfq_service.create_run(db_session, submitted_by=u.id,
                                 input_type=InputType.text, source_text="make a quote")
    assert run.status == RunStatus.queued
    rfq_service.set_status(db_session, run.id, RunStatus.generating)
    assert rfq_service.get_run(db_session, run.id).status == RunStatus.generating
    rfq_service.complete_run(db_session, run.id, {"ok": True})
    done = rfq_service.get_run(db_session, run.id)
    assert done.status == RunStatus.done
    assert done.result_json == {"ok": True}


def test_list_runs_scoped_by_user(db_session):
    u1 = auth_service.create_user(db_session, "u1@x.com", "pw12345")
    u2 = auth_service.create_user(db_session, "u2@x.com", "pw12345")
    rfq_service.create_run(db_session, u1.id, InputType.text, source_text="a")
    rfq_service.create_run(db_session, u2.id, InputType.text, source_text="b")
    assert len(rfq_service.list_runs(db_session, user_id=u1.id)) == 1
    assert len(rfq_service.list_runs(db_session, user_id=None)) == 2  # admin view
```

> Note: `result_json` is JSONB — if running on SQLite this column needs Postgres. Run rfq_service/pipeline tests with `TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/quotes_test` (compose provides Postgres) by adding a `db_session` variant; documented in `backend/tests/README.md`. Auth/prompt tests stay on SQLite.

- [ ] **Step 2: Run to verify it fails**

Run: `pytest tests/test_rfq_service.py -v`
Expected: FAIL (no module).

- [ ] **Step 3: Implement rfq_service.py**

Create `backend/app/services/rfq_service.py`:
```python
# app/services/rfq_service.py
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.db import RfqRun, RunStatus, InputType


def create_run(db: Session, submitted_by: UUID, input_type: InputType,
               source_filename: str | None = None, source_text: str | None = None,
               prompt_version_id: UUID | None = None) -> RfqRun:
    run = RfqRun(submitted_by=submitted_by, input_type=input_type,
                 source_filename=source_filename, source_text=source_text,
                 prompt_version_id=prompt_version_id, status=RunStatus.queued)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def set_task_id(db: Session, run_id: UUID, task_id: str) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.task_id = task_id
        db.commit()


def set_status(db: Session, run_id: UUID, status: RunStatus) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.status = status
        db.commit()


def complete_run(db: Session, run_id: UUID, result_json: dict) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.status = RunStatus.done
        run.result_json = result_json
        run.completed_at = datetime.utcnow()
        db.commit()


def fail_run(db: Session, run_id: UUID, error: str) -> None:
    run = db.query(RfqRun).filter(RfqRun.id == run_id).first()
    if run:
        run.status = RunStatus.failed
        run.error = error
        run.completed_at = datetime.utcnow()
        db.commit()


def get_run(db: Session, run_id: UUID) -> RfqRun | None:
    return db.query(RfqRun).filter(RfqRun.id == run_id).first()


def list_runs(db: Session, user_id: UUID | None) -> list[RfqRun]:
    q = db.query(RfqRun).order_by(RfqRun.created_at.desc())
    if user_id is not None:
        q = q.filter(RfqRun.submitted_by == user_id)
    return q.all()
```

- [ ] **Step 4: Run to verify it passes**

Run: `pytest tests/test_rfq_service.py -v` (against Postgres test DB — see note)
Expected: 2 passed.

- [ ] **Step 5: Commit**
```bash
git add backend/app/services/rfq_service.py backend/tests/test_rfq_service.py
git commit -m "feat(backend): rfq run service (create/status/complete/fail/list)"
```

### Task 3.4: RFQ routes (submit file|text, list, get, status)

**Files:**
- Modify: `backend/app/models/schemas.py`
- Create: `backend/app/api/routers/rfqs.py`
- Test: `backend/tests/test_rfqs_routes.py`

- [ ] **Step 1: Add RFQ schemas**

Append to `backend/app/models/schemas.py`:
```python
class RfqRunOut(BaseModel):
    id: str
    status: str
    input_type: str
    source_filename: Optional[str]
    created_at: str
    completed_at: Optional[str]
    error: Optional[str]
    result_json: Optional[Any]

    class Config:
        from_attributes = True


class TextRfqRequest(BaseModel):
    text: str
```

- [ ] **Step 2: Write failing test (text submission path)**

Create `backend/tests/test_rfqs_routes.py`:
```python
from unittest.mock import patch
from app.services import auth_service
from app.models.db import UserRole


def _auth(client, db_session, role=UserRole.end_user, email="e@x.com"):
    auth_service.create_user(db_session, email, "pw12345", role=role)
    r = client.post("/auth/login", data={"username": email, "password": "pw12345"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_submit_text_creates_run(client, db_session):
    h = _auth(client, db_session)
    with patch("app.api.routers.rfqs.process_rfq_task") as task:
        task.delay.return_value.id = "task-123"
        r = client.post("/rfqs/text", json={"text": "Need a quote for a 10KL reactor"}, headers=h)
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "queued"
    assert body["input_type"] == "text"

    lst = client.get("/rfqs", headers=h)
    assert lst.status_code == 200
    assert len(lst.json()) == 1
```

- [ ] **Step 3: Run to verify it fails**

Run: `pytest tests/test_rfqs_routes.py -v`
Expected: FAIL (no `/rfqs` route — after Task 4.1).

- [ ] **Step 4: Implement rfqs router**

Create `backend/app/api/routers/rfqs.py`:
```python
# app/api/routers/rfqs.py
import os
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.models.db import User, UserRole, InputType, RfqRun
from app.services import rfq_service
from app.models.schemas import RfqRunOut, TextRfqRequest
from app.worker.tasks import process_rfq_task

router = APIRouter(prefix="/rfqs", tags=["rfqs"])
ALLOWED_EXT = {".pdf", ".docx", ".txt"}
MAX_TEXT_LEN = 50_000


def _out(run: RfqRun) -> RfqRunOut:
    return RfqRunOut(
        id=str(run.id), status=run.status.value, input_type=run.input_type.value,
        source_filename=run.source_filename,
        created_at=run.created_at.isoformat(),
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        error=run.error, result_json=run.result_json,
    )


@router.post("/text", response_model=RfqRunOut, status_code=201)
def submit_text(body: TextRfqRequest, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text is empty")
    if len(body.text) > MAX_TEXT_LEN:
        raise HTTPException(status_code=422, detail="Text too long")
    run = rfq_service.create_run(db, submitted_by=user.id, input_type=InputType.text,
                                 source_text=body.text)
    task = process_rfq_task.delay(text=body.text, run_id=str(run.id))
    rfq_service.set_task_id(db, run.id, task.id)
    return _out(run)


@router.post("/file", response_model=RfqRunOut, status_code=201)
def submit_file(file: UploadFile = File(...), db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=422, detail=f"Unsupported file type {ext}")
    settings = get_settings()
    os.makedirs(settings.uploads_dir, exist_ok=True)
    path = os.path.join(settings.uploads_dir, file.filename)
    with open(path, "wb") as f:
        f.write(file.file.read())
    run = rfq_service.create_run(db, submitted_by=user.id, input_type=InputType.file,
                                 source_filename=file.filename)
    task = process_rfq_task.delay(file_path=path, run_id=str(run.id))
    rfq_service.set_task_id(db, run.id, task.id)
    return _out(run)


@router.get("", response_model=list[RfqRunOut])
def list_runs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scope = None if user.role in (UserRole.admin, UserRole.super_admin) else user.id
    return [_out(r) for r in rfq_service.list_runs(db, user_id=scope)]


@router.get("/{run_id}", response_model=RfqRunOut)
def get_run(run_id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if user.role not in (UserRole.admin, UserRole.super_admin) and run.submitted_by != user.id:
        raise HTTPException(status_code=403, detail="Not your run")
    return _out(run)
```

- [ ] **Step 5: Commit**
```bash
git add backend/app/api/routers/rfqs.py backend/app/models/schemas.py backend/tests/test_rfqs_routes.py
git commit -m "feat(backend): rfq submit (file|text) + list + get routes, role-scoped"
```

### Task 3.5: Users router + Metrics service/router

**Files:**
- Create: `backend/app/api/routers/users.py`
- Create: `backend/app/services/metrics_service.py`
- Create: `backend/app/api/routers/metrics.py`
- Modify: `backend/app/models/schemas.py`
- Test: `backend/tests/test_metrics_routes.py`

- [ ] **Step 1: Add user-management + metrics schemas**

Append to `backend/app/models/schemas.py`:
```python
class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""
    role: str = "end_user"


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class MetricsOut(BaseModel):
    total: int
    succeeded: int
    failed: int
    success_rate: float
    avg_seconds: Optional[float]
    volume_by_day: list[dict]
```

- [ ] **Step 2: Implement users router**

Create `backend/app/api/routers/users.py`:
```python
# app/api/routers/users.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import require_role
from app.services import auth_service
from app.models.db import User, UserRole
from app.models.schemas import UserOut, CreateUserRequest, UpdateUserRequest

router = APIRouter(prefix="/users", tags=["users"])
SuperAdmin = require_role(UserRole.super_admin)


def _out(u: User) -> UserOut:
    return UserOut(id=str(u.id), email=u.email, full_name=u.full_name,
                   role=u.role.value, is_active=u.is_active)


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(SuperAdmin)):
    return [_out(u) for u in db.query(User).order_by(User.email).all()]


@router.post("", response_model=UserOut, status_code=201)
def create_user(body: CreateUserRequest, db: Session = Depends(get_db),
                _: User = Depends(SuperAdmin)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    u = auth_service.create_user(db, body.email, body.password, body.full_name,
                                 UserRole(body.role))
    return _out(u)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: UUID, body: UpdateUserRequest, db: Session = Depends(get_db),
                _: User = Depends(SuperAdmin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if body.full_name is not None:
        u.full_name = body.full_name
    if body.role is not None:
        u.role = UserRole(body.role)
    if body.is_active is not None:
        u.is_active = body.is_active
    db.commit()
    db.refresh(u)
    return _out(u)
```

- [ ] **Step 3: Implement metrics_service.py**

Create `backend/app/services/metrics_service.py`:
```python
# app/services/metrics_service.py
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.db import RfqRun, RunStatus


def compute(db: Session, user_id: UUID | None) -> dict:
    q = db.query(RfqRun)
    if user_id is not None:
        q = q.filter(RfqRun.submitted_by == user_id)
    runs = q.all()
    total = len(runs)
    succeeded = sum(1 for r in runs if r.status == RunStatus.done)
    failed = sum(1 for r in runs if r.status == RunStatus.failed)
    durations = [
        (r.completed_at - r.created_at).total_seconds()
        for r in runs if r.completed_at and r.status == RunStatus.done
    ]
    avg_seconds = round(sum(durations) / len(durations), 1) if durations else None

    by_day: dict[str, int] = {}
    for r in runs:
        day = r.created_at.date().isoformat()
        by_day[day] = by_day.get(day, 0) + 1
    volume_by_day = [{"date": d, "count": c} for d, c in sorted(by_day.items())]

    return {
        "total": total,
        "succeeded": succeeded,
        "failed": failed,
        "success_rate": round(succeeded / total, 3) if total else 0.0,
        "avg_seconds": avg_seconds,
        "volume_by_day": volume_by_day,
    }
```

- [ ] **Step 4: Implement metrics router**

Create `backend/app/api/routers/metrics.py`:
```python
# app/api/routers/metrics.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.models.db import User, UserRole
from app.services import metrics_service
from app.models.schemas import MetricsOut

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("", response_model=MetricsOut)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    scope = None if user.role in (UserRole.admin, UserRole.super_admin) else user.id
    return metrics_service.compute(db, scope)
```

- [ ] **Step 5: Write metrics route test**

Create `backend/tests/test_metrics_routes.py`:
```python
from app.services import auth_service
from app.models.db import UserRole


def _auth(client, db_session, role, email):
    auth_service.create_user(db_session, email, "pw12345", role=role)
    r = client.post("/auth/login", data={"username": email, "password": "pw12345"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_metrics_empty(client, db_session):
    h = _auth(client, db_session, UserRole.admin, "a@x.com")
    r = client.get("/metrics", headers=h)
    assert r.status_code == 200
    assert r.json()["total"] == 0
    assert r.json()["success_rate"] == 0.0
```

- [ ] **Step 6: Commit**
```bash
git add backend/app/api/routers/users.py backend/app/api/routers/metrics.py backend/app/services/metrics_service.py backend/app/models/schemas.py backend/tests/test_metrics_routes.py
git commit -m "feat(backend): users CRUD + metrics service/route"
```

---

## Milestone M4 — Wire app, pipeline persistence, prompt-from-DB

### Task 4.1: Mount routers, CORS, startup seed

**Files:**
- Modify: `backend/app/api/main.py`

- [ ] **Step 1: Replace main.py**

Replace `backend/app/api/main.py` with:
```python
"""Main API application entry point."""
# app/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.db.session import SessionLocal, create_all
from app.services import auth_service, prompt_service
from app.services.prompt_loader import load_prompt
from app.api.routers import auth, users, prompts, rfqs, metrics

settings = get_settings()
app = FastAPI(title="NimAI RFQ Generator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(prompts.router)
app.include_router(rfqs.router)
app.include_router(metrics.router)


@app.on_event("startup")
def bootstrap():
    create_all()
    db = SessionLocal()
    try:
        auth_service.seed_super_admin(db, settings.seed_admin_email, settings.seed_admin_password)
        if prompt_service.get_active_content(db, "generation") is None:
            try:
                seed_content = load_prompt("system_prompt.md")
            except Exception:
                seed_content = "You are a quotation generation agent."
            prompt_service.create_prompt(db, key="generation", name="Generation Prompt",
                                         content=seed_content,
                                         description="Primary quote generation system prompt")
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 2: Run the previously-deferred route tests**

Run: `pytest tests/test_auth_routes.py tests/test_prompts_routes.py tests/test_metrics_routes.py -v`
Expected: all pass (app now mounts routers; `create_all` runs via TestClient startup against the overridden in-memory DB).

> Note: For `test_rfqs_routes.py` and `test_rfq_service.py`/`test_pipeline.py`, run against Postgres test DB (see notes in 3.3/3.4). Run: `pytest tests/test_rfqs_routes.py -v` with `TEST_DATABASE_URL` set.

- [ ] **Step 3: Commit**
```bash
git add backend/app/api/main.py
git commit -m "feat(backend): mount routers, CORS, startup seed (admin + generation prompt)"
```

### Task 4.2: Make generator read the active prompt from DB

**Files:**
- Modify: `backend/app/services/generator.py`

- [ ] **Step 1: Add an injectable system-prompt parameter**

In `backend/app/services/generator.py`, change `_build_structured_prompt` so the system prompt can be supplied; replace the line:
```python
    system_prompt = load_prompt("system_prompt.md")
```
with:
```python
    system_prompt = (system_prompt_override
                     if system_prompt_override is not None
                     else load_prompt("system_prompt.md"))
```
and update the signature:
```python
def _build_structured_prompt(
    rfq_data: dict,
    context_docs: list,
    template: dict = None,
    system_prompt_override: str | None = None,
) -> str:
```

- [ ] **Step 2: Thread it through generate_quote_from_structured**

Replace `generate_quote_from_structured` with:
```python
def generate_quote_from_structured(rfq: dict, context_docs: list,
                                   system_prompt_override: str | None = None) -> dict:
    prompt = _build_structured_prompt(rfq, context_docs,
                                      system_prompt_override=system_prompt_override)
    response = llm.invoke(prompt)
    return _parse_quote_json(response.content)
```

- [ ] **Step 3: Verify import still works**

Run: `python -c "from app.services.generator import generate_quote_from_structured; print('ok')"`
Expected: `ok` (OpenAI key not required at import; `llm` is created lazily by langchain but `get_llm` builds the client — if it errors without a key, set `OPENAI_API_KEY=test` in env for this check).

- [ ] **Step 4: Commit**
```bash
git add backend/app/services/generator.py
git commit -m "feat(backend): allow generator to use DB-provided system prompt"
```

### Task 4.3: Pipeline persists status + uses active prompt + supports text

**Files:**
- Modify: `backend/app/worker/tasks.py`
- Test: `backend/tests/test_pipeline.py`

- [ ] **Step 1: Write failing pipeline test (mocked services + DB)**

Create `backend/tests/test_pipeline.py`:
```python
from unittest.mock import patch
from app.services import rfq_service, auth_service, prompt_service
from app.models.db import InputType, RunStatus
from app.worker import tasks


def test_pipeline_text_marks_done(db_session):
    # Arrange: seed prompt + a run
    prompt_service.create_prompt(db_session, "generation", "Generation", "SYS")
    u = auth_service.create_user(db_session, "e@x.com", "pw12345")
    run = rfq_service.create_run(db_session, u.id, InputType.text, source_text="hi")

    with patch.object(tasks, "SessionLocal", return_value=db_session), \
         patch.object(tasks, "extract_rfq_structured", return_value={"line_items": []}), \
         patch.object(tasks, "retrieve_similar_structured", return_value=[]), \
         patch.object(tasks, "generate_quote_from_structured", return_value={"ok": True}):
        result = tasks._run_pipeline(text="hi", run_id=str(run.id))

    assert result["draft"] == {"ok": True}
    done = rfq_service.get_run(db_session, run.id)
    assert done.status == RunStatus.done
    assert done.result_json == {"ok": True}
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest tests/test_pipeline.py -v` (Postgres test DB)
Expected: FAIL (`_run_pipeline` not defined; signature mismatch).

- [ ] **Step 3: Rewrite tasks.py**

Replace `backend/app/worker/tasks.py` with:
```python
# app/worker/tasks.py
from uuid import UUID
from celery import Celery

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.parser import extract_text
from app.services.extractor import extract_rfq_structured
from app.services.retriever import retrieve_similar_structured
from app.services.generator import generate_quote_from_structured
from app.services import rfq_service, prompt_service
from app.models.db import RunStatus

settings = get_settings()
celery = Celery("tasks", broker=settings.redis_url, backend=settings.redis_url)


def _run_pipeline(file_path: str | None = None, text: str | None = None,
                  run_id: str | None = None) -> dict:
    db = SessionLocal()
    rid = UUID(run_id) if run_id else None
    try:
        if rid:
            rfq_service.set_status(db, rid, RunStatus.parsing)
        raw_text = text if text is not None else extract_text(file_path)

        if rid:
            rfq_service.set_status(db, rid, RunStatus.extracting)
        structured_rfq = extract_rfq_structured(raw_text)

        if rid:
            rfq_service.set_status(db, rid, RunStatus.retrieving)
        similar_docs = retrieve_similar_structured(structured_rfq)

        if rid:
            rfq_service.set_status(db, rid, RunStatus.generating)
        active_prompt = prompt_service.get_active_content(db, "generation")
        draft = generate_quote_from_structured(structured_rfq, similar_docs,
                                               system_prompt_override=active_prompt)

        if rid:
            rfq_service.complete_run(db, rid, draft)
        return {"rfq": structured_rfq, "draft": draft}
    except Exception as e:
        if rid:
            rfq_service.fail_run(db, rid, str(e))
        raise
    finally:
        db.close()


@celery.task
def process_rfq_task(file_path: str | None = None, text: str | None = None,
                     run_id: str | None = None):
    return _run_pipeline(file_path=file_path, text=text, run_id=run_id)
```

- [ ] **Step 4: Run to verify it passes**

Run: `pytest tests/test_pipeline.py -v` (Postgres test DB)
Expected: 1 passed.

- [ ] **Step 5: Run the full backend suite**

Run: `pytest -v` (with `TEST_DATABASE_URL` for JSONB tests)
Expected: all pass.

- [ ] **Step 6: Commit**
```bash
git add backend/app/worker/tasks.py backend/tests/test_pipeline.py
git commit -m "feat(backend): pipeline persists status, uses active prompt, supports text input"
```

---

## Milestone M5 — Infrastructure (compose, env)

### Task 5.1: docker-compose + env for the new stack

**Files:**
- Create: `docker-compose.yml` (root)
- Create: `backend/.env.example` (overwrite), `.env.example` (root)

- [ ] **Step 1: Write docker-compose.yml**

Create `docker-compose.yml` at the repo root:
```yaml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: quotes
    ports: ["5432:5432"]
    volumes: ["postgres_data:/var/lib/postgresql/data"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  api:
    build: ./backend
    command: uvicorn app.api.main:app --host 0.0.0.0 --port 8000
    ports: ["8000:8000"]
    env_file: [./backend/.env]
    volumes: ["./backend/app:/app/app", "./backend/data:/app/data"]
    depends_on: [db, redis]

  worker:
    build: ./backend
    command: celery -A app.worker.tasks worker --loglevel=info
    env_file: [./backend/.env]
    volumes: ["./backend/app:/app/app", "./backend/data:/app/data"]
    depends_on: [db, redis]

volumes:
  postgres_data:
```

- [ ] **Step 2: Write backend/.env.example**

Create/overwrite `backend/.env.example`:
```
# LLM
OPENAI_API_KEY=sk-replace-me
GENERATOR_PROVIDER=openai
GENERATOR_MODEL=gpt-4o-mini
EXTRACTOR_PROVIDER=openai
EXTRACTOR_MODEL=gpt-4o-mini

# Database / Redis (compose service names)
DATABASE_URL=postgresql://user:pass@db:5432/quotes
REDIS_URL=redis://redis:6379/0

# Auth
JWT_SECRET=dev-insecure-change-me
ACCESS_TOKEN_TTL_MINUTES=30
REFRESH_TOKEN_TTL_DAYS=7

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:4173

# Seed admin
SEED_ADMIN_EMAIL=admin@nimai.ai
SEED_ADMIN_PASSWORD=password!123
```

- [ ] **Step 3: Bring up infra and run a smoke check**

Run:
```bash
cp backend/.env.example backend/.env   # then edit OPENAI_API_KEY
docker compose up -d db redis
docker compose up --build api
```
Then in another shell: `curl http://localhost:8000/health` → `{"status":"ok"}`. Visit `http://localhost:8000/docs` and confirm `/auth/login`, `/prompts`, `/rfqs`, `/metrics` appear. Confirm startup seeded admin + generation prompt (check `/docs` then login with seed admin).

- [ ] **Step 4: Generate the Alembic migration now that DB is up (Task 1.2 Step 3)**

Run (venv, with local `DATABASE_URL=postgresql://user:pass@localhost:5432/quotes`):
```bash
cd backend && alembic revision --autogenerate -m "add users, prompts, prompt_versions, rfq_runs" && alembic upgrade head
```

- [ ] **Step 5: Commit**
```bash
git add docker-compose.yml backend/.env.example backend/alembic/versions/
git commit -m "chore: docker-compose (db/redis/api/worker) + env example + initial migration"
```

---

## Milestone M6 — Frontend (scaffold → ported components → screens)

### Task 6.1: Scaffold the Vite React app + copy design system

**Files:**
- Create: `frontend/` (Vite scaffold)
- Copy: `resources/ComplianCentralDesign_pkg/src/app/components/ui/*` → `frontend/src/app/components/ui/`
- Copy: layout/sidebar/topbar/theme/toast components
- Copy: `resources/.../src/styles/*` → `frontend/src/styles/`

- [ ] **Step 1: Scaffold Vite + install deps mirroring the design package**

Run:
```bash
cd "c:/Users/sdisawal/OneDrive - NiCE Ltd/1_Work/4_Code/RFQGenerator"
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install react-router@7 @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-label @radix-ui/react-select @radix-ui/react-switch @radix-ui/react-dropdown-menu class-variance-authority clsx tailwind-merge lucide-react @heroicons/react sonner next-themes recharts
npm install -D tailwindcss@4 @tailwindcss/vite vitest @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

- [ ] **Step 2: Configure Vite proxy + tailwind + alias**

Overwrite `frontend/vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } } },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/setupTests.ts" },
});
```
Create `frontend/src/setupTests.ts`:
```typescript
import "@testing-library/jest-dom";
```

- [ ] **Step 3: Copy the design system components and styles**

Run:
```bash
cd "c:/Users/sdisawal/OneDrive - NiCE Ltd/1_Work/4_Code/RFQGenerator"
SRC=resources/ComplianCentralDesign_pkg/src
mkdir -p frontend/src/app/components/ui frontend/src/styles
cp -r $SRC/app/components/ui/* frontend/src/app/components/ui/
cp $SRC/app/components/layout.tsx frontend/src/app/components/
cp $SRC/app/components/app-sidebar.tsx frontend/src/app/components/
cp $SRC/app/components/top-bar.tsx frontend/src/app/components/
cp $SRC/app/components/theme-provider.tsx frontend/src/app/components/
cp $SRC/app/components/toast-manager.tsx frontend/src/app/components/
cp -r $SRC/styles/* frontend/src/styles/
```

> Note: After copying, fix imports — design-package files may import from `@/` paths or sibling components not copied. Build will reveal missing modules; copy each missing dependency on demand from `$SRC` until `npm run build` succeeds. Do NOT copy the Express `src/api/*` (we write our own).

- [ ] **Step 4: Verify it builds**

Run: `cd frontend && npm run build`
Expected: build completes (after resolving any missing imports per the note).

- [ ] **Step 5: Commit**
```bash
git add frontend/ && git commit -m "feat(frontend): scaffold Vite app + port Compliance Central design system"
```

### Task 6.2: API client + auth context + protected routes

**Files:**
- Create: `frontend/src/api/client.ts`, `auth.ts`, `prompts.ts`, `rfqs.ts`, `users.ts`, `metrics.ts`
- Create: `frontend/src/auth/AuthContext.tsx`, `ProtectedRoute.tsx`
- Test: `frontend/src/auth/__tests__/ProtectedRoute.test.tsx`

- [ ] **Step 1: Implement the fetch client with auth + refresh**

Create `frontend/src/api/client.ts`:
```typescript
const BASE = "/api";
let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) localStorage.setItem("refresh_token", refresh ?? "");
  else localStorage.removeItem("refresh_token");
}
export function loadRefreshToken() {
  refreshToken = localStorage.getItem("refresh_token");
  return refreshToken;
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(`${BASE}${path}`, { ...init, headers });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res = await raw(path, init);
  if (res.status === 401 && refreshToken) {
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (r.ok) {
      const t = await r.json();
      setTokens(t.access_token, t.refresh_token);
      res = await raw(path, init);
    }
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Implement typed endpoint modules**

Create `frontend/src/api/auth.ts`:
```typescript
import { apiFetch, setTokens } from "./client";

export interface Me { id: string; email: string; full_name: string; role: string; is_active: boolean; }

export async function login(email: string, password: string): Promise<Me> {
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch("/api/auth/login", { method: "POST", body: form });
  if (!res.ok) throw new Error("Invalid credentials");
  const t = await res.json();
  setTokens(t.access_token, t.refresh_token);
  return apiFetch<Me>("/auth/me");
}
export const me = () => apiFetch<Me>("/auth/me");
```
Create `frontend/src/api/rfqs.ts`:
```typescript
import { apiFetch } from "./client";

export interface RfqRun {
  id: string; status: string; input_type: string;
  source_filename: string | null; created_at: string;
  completed_at: string | null; error: string | null; result_json: unknown | null;
}
export const listRuns = () => apiFetch<RfqRun[]>("/rfqs");
export const getRun = (id: string) => apiFetch<RfqRun>(`/rfqs/${id}`);
export const submitText = (text: string) =>
  apiFetch<RfqRun>("/rfqs/text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
export async function submitFile(file: File): Promise<RfqRun> {
  const fd = new FormData(); fd.append("file", file);
  return apiFetch<RfqRun>("/rfqs/file", { method: "POST", body: fd });
}
```
Create `frontend/src/api/prompts.ts`:
```typescript
import { apiFetch } from "./client";
export interface Prompt { id: string; key: string; name: string; description: string; active_version_id: string | null; }
export interface PromptVersion { id: string; version: number; content: string; note: string; created_at: string; }
export const listPrompts = () => apiFetch<Prompt[]>("/prompts");
export const listVersions = (key: string) => apiFetch<PromptVersion[]>(`/prompts/${key}/versions`);
export const addVersion = (key: string, content: string, note = "") =>
  apiFetch<PromptVersion>(`/prompts/${key}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, note }) });
export const activate = (key: string, version_id: string) =>
  apiFetch<Prompt>(`/prompts/${key}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version_id }) });
```
Create `frontend/src/api/users.ts`:
```typescript
import { apiFetch } from "./client";
import type { Me } from "./auth";
export const listUsers = () => apiFetch<Me[]>("/users");
export const createUser = (email: string, password: string, full_name: string, role: string) =>
  apiFetch<Me>("/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, full_name, role }) });
export const updateUser = (id: string, body: Partial<{ full_name: string; role: string; is_active: boolean }>) =>
  apiFetch<Me>(`/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
```
Create `frontend/src/api/metrics.ts`:
```typescript
import { apiFetch } from "./client";
export interface Metrics { total: number; succeeded: number; failed: number; success_rate: number; avg_seconds: number | null; volume_by_day: { date: string; count: number }[]; }
export const getMetrics = () => apiFetch<Metrics>("/metrics");
```

- [ ] **Step 3: Implement AuthContext + ProtectedRoute**

Create `frontend/src/auth/AuthContext.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { me as fetchMe, login as apiLogin, type Me } from "../api/auth";
import { loadRefreshToken, setTokens } from "../api/client";

interface AuthState { user: Me | null; loading: boolean;
  login: (e: string, p: string) => Promise<void>; logout: () => void; }
const Ctx = createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (loadRefreshToken()) fetchMe().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const login = async (e: string, p: string) => { setUser(await apiLogin(e, p)); };
  const logout = () => { setTokens(null, null); setUser(null); };
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
```
Create `frontend/src/auth/ProtectedRoute.tsx`:
```tsx
import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "./AuthContext";

export function ProtectedRoute({ roles, children }: { roles?: string[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

- [ ] **Step 4: Write + run ProtectedRoute test**

Create `frontend/src/auth/__tests__/ProtectedRoute.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { ProtectedRoute } from "../ProtectedRoute";
import * as ctx from "../AuthContext";

function renderWith(user: any) {
  vi.spyOn(ctx, "useAuth").mockReturnValue({ user, loading: false, login: vi.fn(), logout: vi.fn() } as any);
  return render(
    <MemoryRouter initialEntries={["/secret"]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN</div>} />
        <Route path="/secret" element={<ProtectedRoute roles={["admin"]}><div>SECRET</div></ProtectedRoute>} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>
    </MemoryRouter>
  );
}

test("redirects anonymous to login", () => { renderWith(null); expect(screen.getByText("LOGIN")).toBeInTheDocument(); });
test("redirects wrong role to home", () => { renderWith({ role: "end_user" }); expect(screen.getByText("HOME")).toBeInTheDocument(); });
test("allows correct role", () => { renderWith({ role: "admin" }); expect(screen.getByText("SECRET")).toBeInTheDocument(); });
```
Run: `cd frontend && npx vitest run src/auth`
Expected: 3 passed.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/api frontend/src/auth
git commit -m "feat(frontend): typed API client, auth context, protected routes + tests"
```

### Task 6.3: Routes, App shell, Login page

**Files:**
- Create: `frontend/src/app/routes.tsx`, `frontend/src/app/App.tsx`, `frontend/src/main.tsx`
- Create: `frontend/src/app/pages/login.tsx`

- [ ] **Step 1: Login page**

Create `frontend/src/app/pages/login.tsx`:
```tsx
import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try { await login(email, password); nav("/"); }
    catch { setError("Invalid credentials"); }
  };
  return (
    <div className="flex h-full w-full items-center justify-center">
      <form onSubmit={submit} className="w-80 space-y-4 rounded-lg border p-6">
        <h1 className="text-lg font-semibold">NimAI RFQ Generator</h1>
        <div className="space-y-2"><Label htmlFor="email">Email</Label>
          <Input id="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="pw">Password</Label>
          <Input id="pw" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Routes + App + main**

Create `frontend/src/app/routes.tsx`:
```tsx
import { createBrowserRouter } from "react-router";
import { Layout } from "./components/layout";
import { ProtectedRoute } from "../auth/ProtectedRoute";
import { LoginPage } from "./pages/login";
import { DashboardPage } from "./pages/dashboard";
import { RfqNewPage } from "./pages/rfq-new";
import { RfqsPage } from "./pages/rfqs";
import { PromptsPage } from "./pages/prompts";
import { UsersPage } from "./pages/users";

const guard = (el: React.ReactNode, roles?: string[]) =>
  <ProtectedRoute roles={roles}>{el}</ProtectedRoute>;

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/", element: guard(<Layout />), children: [
      { index: true, element: <DashboardPage /> },
      { path: "rfq/new", element: <RfqNewPage /> },
      { path: "rfqs", element: <RfqsPage /> },
      { path: "prompts", element: guard(<PromptsPage />, ["admin", "super_admin"]) },
      { path: "users", element: guard(<UsersPage />, ["super_admin"]) },
  ]},
]);
```
Create `frontend/src/app/App.tsx`:
```tsx
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "./components/theme-provider";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="h-full w-full"><RouterProvider router={router} /></div>
      </AuthProvider>
    </ThemeProvider>
  );
}
```
Overwrite `frontend/src/main.tsx`:
```tsx
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";
createRoot(document.getElementById("root")!).render(<App />);
```

> Note: `app-sidebar.tsx` was built for Compliance Central's nav. Edit it to render RFQ nav items filtered by `useAuth().user.role`: Dashboard (`/`), Generate RFQ (`/rfq/new`), My RFQs (`/rfqs`) for all; + System Prompts (`/prompts`) for admin/super_admin; + User Management (`/users`) for super_admin. Keep its existing styling/markup; only swap the items array and add a logout action calling `useAuth().logout()`.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/app/routes.tsx frontend/src/app/App.tsx frontend/src/main.tsx frontend/src/app/pages/login.tsx frontend/src/app/components/app-sidebar.tsx
git commit -m "feat(frontend): router, app shell, login page, role-filtered sidebar"
```

### Task 6.4: Generate RFQ page

**Files:**
- Create: `frontend/src/app/pages/rfq-new.tsx`
- Test: `frontend/src/app/pages/__tests__/rfq-new.test.tsx`

- [ ] **Step 1: Write the page**

Create `frontend/src/app/pages/rfq-new.tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { submitText, submitFile, getRun, type RfqRun } from "../../api/rfqs";

const TERMINAL = ["done", "failed"];

export function RfqNewPage() {
  const [text, setText] = useState("");
  const [run, setRun] = useState<RfqRun | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!run || TERMINAL.includes(run.status)) return;
    const t = setTimeout(async () => setRun(await getRun(run.id)), 1500);
    return () => clearTimeout(t);
  }, [run]);

  const onText = async () => { setBusy(true); try { setRun(await submitText(text)); } finally { setBusy(false); } };
  const onFile = async () => {
    const f = fileRef.current?.files?.[0]; if (!f) return;
    setBusy(true); try { setRun(await submitFile(f)); } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">Generate RFQ</h1>
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload file</TabsTrigger>
          <TabsTrigger value="text">Paste text</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="space-y-3">
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" />
          <Button onClick={onFile} disabled={busy}>Generate</Button>
        </TabsContent>
        <TabsContent value="text" className="space-y-3">
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={10}
                    placeholder="Paste RFQ text..." />
          <Button onClick={onText} disabled={busy || !text.trim()}>Generate</Button>
        </TabsContent>
      </Tabs>

      {run && (
        <div className="rounded-lg border p-4">
          <p>Status: <span data-testid="run-status" className="font-medium">{run.status}</span></p>
          {run.status === "failed" && <p className="text-destructive">{run.error}</p>}
          {run.status === "done" && (
            <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-3 text-xs">
              {JSON.stringify(run.result_json, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write + run the test**

Create `frontend/src/app/pages/__tests__/rfq-new.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RfqNewPage } from "../rfq-new";
import * as api from "../../../api/rfqs";

test("submitting text shows queued status", async () => {
  vi.spyOn(api, "submitText").mockResolvedValue({ id: "1", status: "queued", input_type: "text",
    source_filename: null, created_at: "", completed_at: null, error: null, result_json: null });
  vi.spyOn(api, "getRun").mockResolvedValue({ id: "1", status: "done", input_type: "text",
    source_filename: null, created_at: "", completed_at: null, error: null, result_json: { ok: true } });
  render(<RfqNewPage />);
  fireEvent.click(screen.getByText("Paste text"));
  fireEvent.change(screen.getByPlaceholderText("Paste RFQ text..."), { target: { value: "hello" } });
  fireEvent.click(screen.getByText("Generate"));
  await waitFor(() => expect(screen.getByTestId("run-status")).toHaveTextContent(/queued|done/));
});
```
Run: `cd frontend && npx vitest run src/app/pages/__tests__/rfq-new.test.tsx`
Expected: 1 passed.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/app/pages/rfq-new.tsx frontend/src/app/pages/__tests__/rfq-new.test.tsx
git commit -m "feat(frontend): Generate RFQ page (upload|text) with live status polling + test"
```

### Task 6.5: Dashboard, My/All RFQs, Prompts editor, Users pages

**Files:**
- Create: `frontend/src/app/pages/dashboard.tsx`, `rfqs.tsx`, `prompts.tsx`, `users.tsx`
- Test: `frontend/src/app/pages/__tests__/prompts.test.tsx`

- [ ] **Step 1: Dashboard page**

Create `frontend/src/app/pages/dashboard.tsx`:
```tsx
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { getMetrics, type Metrics } from "../../api/metrics";
import { listRuns, type RfqRun } from "../../api/rfqs";

function Card({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-2xl font-semibold">{value}</p></div>;
}

export function DashboardPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [runs, setRuns] = useState<RfqRun[]>([]);
  useEffect(() => { getMetrics().then(setM); listRuns().then(setRuns); }, []);
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      {m && (
        <div className="grid grid-cols-3 gap-3">
          <Card label="Total RFQs" value={String(m.total)} />
          <Card label="Success rate" value={`${Math.round(m.success_rate * 100)}%`} />
          <Card label="Avg time" value={m.avg_seconds ? `${m.avg_seconds}s` : "—"} />
        </div>
      )}
      {m && m.volume_by_day.length > 0 && (
        <div className="rounded-lg border p-4">
          <p className="mb-2 text-xs text-muted-foreground">Volume over time</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={m.volume_by_day}>
              <XAxis dataKey="date" fontSize={10} /><YAxis allowDecimals={false} fontSize={10} />
              <Tooltip /><Bar dataKey="count" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="p-2">ID</th><th className="p-2">Status</th><th className="p-2">Created</th></tr></thead>
          <tbody>{runs.slice(0, 10).map(r => (
            <tr key={r.id} className="border-b"><td className="p-2">{r.id.slice(0, 8)}</td>
              <td className="p-2">{r.status}</td><td className="p-2">{r.created_at}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: My/All RFQs page**

Create `frontend/src/app/pages/rfqs.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listRuns, type RfqRun } from "../../api/rfqs";

export function RfqsPage() {
  const [runs, setRuns] = useState<RfqRun[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { listRuns().then(setRuns); }, []);
  const filtered = runs.filter(r => r.id.includes(q) || r.status.includes(q));
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">RFQs</h1>
      <input className="rounded border px-2 py-1 text-sm" placeholder="Filter..."
             value={q} onChange={e => setQ(e.target.value)} />
      <table className="w-full text-sm"><thead><tr className="border-b text-left">
        <th className="p-2">ID</th><th className="p-2">Type</th><th className="p-2">Status</th>
        <th className="p-2">Created</th></tr></thead>
        <tbody>{filtered.map(r => (
          <tr key={r.id} className="border-b"><td className="p-2">{r.id.slice(0, 8)}</td>
            <td className="p-2">{r.input_type}</td><td className="p-2">{r.status}</td>
            <td className="p-2">{r.created_at}</td></tr>))}</tbody></table>
    </div>
  );
}
```

- [ ] **Step 3: Prompts editor page**

Create `frontend/src/app/pages/prompts.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listPrompts, listVersions, addVersion, activate,
         type Prompt, type PromptVersion } from "../../api/prompts";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

export function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [key, setKey] = useState<string>("");
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [content, setContent] = useState("");

  useEffect(() => { listPrompts().then(p => { setPrompts(p); if (p[0]) setKey(p[0].key); }); }, []);
  useEffect(() => { if (key) listVersions(key).then(v => { setVersions(v); setContent(v[0]?.content ?? ""); }); }, [key]);

  const active = prompts.find(p => p.key === key)?.active_version_id;
  const save = async () => { await addVersion(key, content); setVersions(await listVersions(key)); };
  const makeActive = async (id: string) => { await activate(key, id); setPrompts(await listPrompts()); };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">System Prompts</h1>
      <select className="rounded border px-2 py-1" value={key} onChange={e => setKey(e.target.value)}>
        {prompts.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
      </select>
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <Textarea rows={16} value={content} onChange={e => setContent(e.target.value)} />
          <Button onClick={save}>Save new version</Button>
        </div>
        <div className="w-56 space-y-2">
          <p className="text-xs text-muted-foreground">History</p>
          {versions.map(v => (
            <div key={v.id} className="flex items-center justify-between rounded border p-2 text-sm">
              <span>v{v.version}{v.id === active ? " (active)" : ""}</span>
              {v.id !== active && <button className="text-xs underline" onClick={() => makeActive(v.id)}>Set active</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Users page**

Create `frontend/src/app/pages/users.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listUsers, createUser, updateUser } from "../../api/users";
import type { Me } from "../../api/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function UsersPage() {
  const [users, setUsers] = useState<Me[]>([]);
  const [email, setEmail] = useState(""); const [pw, setPw] = useState("");
  const [role, setRole] = useState("end_user");
  const refresh = () => listUsers().then(setUsers);
  useEffect(() => { refresh(); }, []);
  const add = async () => { await createUser(email, pw, "", role); setEmail(""); setPw(""); refresh(); };
  const toggle = async (u: Me) => { await updateUser(u.id, { is_active: !u.is_active }); refresh(); };
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-lg font-semibold">User Management</h1>
      <div className="flex gap-2">
        <Input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <Input placeholder="password" type="password" value={pw} onChange={e => setPw(e.target.value)} />
        <select className="rounded border px-2" value={role} onChange={e => setRole(e.target.value)}>
          <option value="end_user">end_user</option><option value="admin">admin</option>
          <option value="super_admin">super_admin</option>
        </select>
        <Button onClick={add}>Add</Button>
      </div>
      <table className="w-full text-sm"><thead><tr className="border-b text-left">
        <th className="p-2">Email</th><th className="p-2">Role</th><th className="p-2">Active</th><th /></tr></thead>
        <tbody>{users.map(u => (
          <tr key={u.id} className="border-b"><td className="p-2">{u.email}</td><td className="p-2">{u.role}</td>
            <td className="p-2">{u.is_active ? "yes" : "no"}</td>
            <td className="p-2"><button className="text-xs underline" onClick={() => toggle(u)}>
              {u.is_active ? "Deactivate" : "Activate"}</button></td></tr>))}</tbody></table>
    </div>
  );
}
```

- [ ] **Step 5: Write + run prompts editor test**

Create `frontend/src/app/pages/__tests__/prompts.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PromptsPage } from "../prompts";
import * as api from "../../../api/prompts";

test("saving creates a new version row", async () => {
  vi.spyOn(api, "listPrompts").mockResolvedValue([{ id: "p1", key: "generation", name: "Generation", description: "", active_version_id: "v1" }]);
  const listVersions = vi.spyOn(api, "listVersions")
    .mockResolvedValueOnce([{ id: "v1", version: 1, content: "v1", note: "", created_at: "" }])
    .mockResolvedValueOnce([
      { id: "v2", version: 2, content: "v2", note: "", created_at: "" },
      { id: "v1", version: 1, content: "v1", note: "", created_at: "" }]);
  vi.spyOn(api, "addVersion").mockResolvedValue({ id: "v2", version: 2, content: "v2", note: "", created_at: "" });
  render(<PromptsPage />);
  await waitFor(() => screen.getByText("v1 (active)"));
  fireEvent.click(screen.getByText("Save new version"));
  await waitFor(() => expect(screen.getByText(/^v2/)).toBeInTheDocument());
  expect(listVersions).toHaveBeenCalledTimes(2);
});
```
Run: `cd frontend && npx vitest run src/app/pages/__tests__/prompts.test.tsx`
Expected: 1 passed.

- [ ] **Step 6: Full frontend build + test**

Run: `cd frontend && npm run build && npx vitest run`
Expected: build succeeds; all tests pass.

- [ ] **Step 7: Commit**
```bash
git add frontend/src/app/pages
git commit -m "feat(frontend): dashboard, rfqs list, prompts editor, users pages + tests"
```

---

## Milestone M7 — End-to-end smoke (manual)

### Task 7.1: Full-stack manual verification

- [ ] **Step 1: Start everything**
```bash
cp backend/.env.example backend/.env   # set OPENAI_API_KEY
docker compose up -d db redis
docker compose up --build api worker    # in one shell
cd frontend && npm run dev              # in another shell
```

- [ ] **Step 2: Walk the flow** (documented checklist)
  1. Open `http://localhost:5173/login`, sign in as `admin@local.dev` / `ChangeMe!123`.
  2. As super_admin, go to User Management → create an `end_user` and an `admin`.
  3. Log in as the end_user → Generate RFQ → paste text from `quote-agent/test_rfq.txt` → Generate → watch status move queued→…→done → see result JSON.
  4. Confirm Dashboard shows the run; confirm end_user sees only their own runs.
  5. Log in as admin → System Prompts → edit generation prompt → Save new version → Set active.
  6. Submit another RFQ → confirm it completes (and, if checking DB, that `rfq_runs.prompt_version_id` points at the new version).
  7. Confirm an end_user cannot reach `/prompts` or `/users` (redirected) and the API returns 403 directly.

- [ ] **Step 3: Record results** in `docs/superpowers/plans/` as a short smoke-test note, and fix any failures via systematic-debugging before declaring done.

---

## Notes on conventions & deferrals

- **DB engine for tests:** auth/prompt/metrics tests run on in-memory SQLite (fast). `rfq_runs` uses Postgres `JSONB`, so rfq-service/pipeline/rfqs-route tests require a Postgres test DB (`TEST_DATABASE_URL`); compose provides one. This split is documented in `backend/tests/README.md` (create it in Task 3.3).
- **Out of scope (per spec):** RFQ Management/tracing system, LLM token/cost accounting, DOCX rendering of quotes, per-user custom permissions, migrating quote-agent git history.
- **DRY/YAGNI:** routers reuse `_out`/`_ver_out` mappers; no speculative endpoints. **TDD:** every service/route has a failing test first. **Commits:** one per task step group.
