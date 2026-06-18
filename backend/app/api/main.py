"""Main API application entry point."""
# app/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.db.session import SessionLocal, create_all
from app.services import auth_service, prompt_service
from app.api.routers import auth, users, prompts, rfqs, metrics, products, approvals, approval_templates
from app.api.routers import docx_template, app_config

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
app.include_router(products.router)
app.include_router(approvals.router)
app.include_router(approval_templates.router)
app.include_router(docx_template.router)
app.include_router(app_config.router)


@app.on_event("startup")
def bootstrap():
    # Skip DB bootstrap when running under tests (SQLite in-memory fixture handles setup)
    if settings.database_url.startswith("sqlite"):
        return
    create_all()
    db = SessionLocal()
    try:
        auth_service.seed_super_admin(db, settings.seed_admin_email, settings.seed_admin_password)
        auth_service.seed_test_users(db)
        auth_service.seed_app_config(db)
        if prompt_service.get_active_content(db, "generation") is None:
            try:
                from app.services.prompt_loader import load_prompt
                seed_content = load_prompt("system_prompt.md")
            except Exception:
                seed_content = "You are a quotation generation agent."
            prompt_service.create_prompt(
                db, key="generation", name="Generation Prompt",
                content=seed_content,
                description="Primary quote generation system prompt",
            )
    finally:
        db.close()


@app.get("/health")
def health():
    return {"status": "ok"}
