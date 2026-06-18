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
celery.conf.update(
    task_soft_time_limit=480,   # 8 min — raises SoftTimeLimitExceeded (caught, run marked failed)
    task_time_limit=600,        # 10 min — hard kill (covers 3 slow LLM calls with margin)
)


def _run_pipeline(file_path: str = None, text: str = None, run_id: str = None) -> dict:
    db = SessionLocal()
    rid = UUID(run_id) if run_id else None
    try:
        run = rfq_service.get_run(db, rid) if rid else None

        if rid:
            rfq_service.set_status(db, rid, RunStatus.parsing)

        # Use already-stored source_text if available (set during the extract step)
        if run and run.source_text:
            raw_text = run.source_text
        elif text is not None:
            raw_text = text
        else:
            raw_text = extract_text(file_path)

        if rid:
            rfq_service.set_status(db, rid, RunStatus.extracting)
        # Reuse full extraction cached at Step 1 if available — avoids a second LLM call
        if run and run.result_json and run.result_json.get("_extraction_only"):
            structured_rfq = {k: v for k, v in run.result_json.items() if k != "_extraction_only"}
        else:
            structured_rfq = extract_rfq_structured(raw_text)

        # Overlay confirmed metadata from Step 2 (user edits win)
        if run and run.meta_confirmed:
            overlay = {
                "customer_name": run.meta_company_name,
                "subject": run.meta_product,
                "rfq_date": run.meta_rfq_date,
                "rfq_number": run.meta_rfq_number,
            }
            for key, val in overlay.items():
                if val:
                    structured_rfq[key] = val

        # Overlay confirmed data points from Step 3 (user-confirmed values win).
        # Keys may be prefixed (customer__ / required__) or nested (section__sub).
        if run and run.data_confirmed:
            data_points = rfq_service.get_data_points(db, rid)
            for dp in data_points:
                if dp.value is None:
                    continue
                key = dp.field_key
                if key.startswith("customer__"):
                    structured_rfq[key[len("customer__"):]] = dp.value
                elif key.startswith("required__"):
                    real = key[len("required__"):]
                    structured_rfq.setdefault("required_product_details", {})[real] = dp.value
                    structured_rfq[real] = dp.value
                elif "__" in key:
                    section, sub = key.split("__", 1)
                    node = structured_rfq.get(section)
                    if not isinstance(node, dict):
                        node = {}
                        structured_rfq[section] = node
                    node[sub] = dp.value
                else:
                    structured_rfq[key] = dp.value

        if rid:
            rfq_service.set_status(db, rid, RunStatus.retrieving)
        similar_docs = retrieve_similar_structured(structured_rfq)

        # Persist similar run IDs for future UI (no FAISS re-query needed)
        if rid:
            similar_ids = [r["run_id"] for r in similar_docs if "run_id" in r]
            rfq_service.save_similar_ids(db, rid, similar_ids)

        if rid:
            rfq_service.set_status(db, rid, RunStatus.generating)
        active_prompt = prompt_service.get_active_content_for(db, "generation", run.meta_product if run else None)
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
def process_rfq_task(file_path: str = None, text: str = None, run_id: str = None):
    return _run_pipeline(file_path=file_path, text=text, run_id=run_id)
