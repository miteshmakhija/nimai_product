# app/api/routers/rfqs.py
import os
from uuid import UUID
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_current_user
from app.core.config import get_settings
from app.models.db import User, UserRole, InputType, RfqRun, RunStatus, ApprovalState
from app.services import rfq_service
from app.services import product_service
from app.models.schemas import (
    RfqRunOut, TextRfqRequest,
    RfqExtractResponse, RfqConfirmRequest, RfqConfirmResponse,
    RfqDataSubmitRequest, RfqContentUpdate, DataPointOut,
    SubmitApprovalRequest, ApprovalRequestOut,
    CustomerApprovedRequest,
)
from app.services import approval_service
from app.models.schemas import StageOut, AssignmentOut

router = APIRouter(prefix="/rfqs", tags=["rfqs"])
ALLOWED_EXT = {".pdf", ".docx", ".txt"}
MAX_TEXT_LEN = 50_000

# Data-point section prefixes (encode UI grouping into field_key)
SEC_CUSTOMER = "customer__"
SEC_REQUIRED = "required__"
# Additional info = any key without the two prefixes above


def _stringify(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        import json as _json
        return _json.dumps(val)
    return str(val)


def _build_sections(db: Session, run: RfqRun, structured: dict) -> list[dict]:
    """Build 3-section data points from a structured extraction:
      1. Customer Details   (customer__*)
      2. Required Product Details  (required__*  — from ProductRequiredFields)
      3. Additional Information   (raw flattened keys)
    Returns list of dp row dicts (also persisted by caller).
    """
    from app.services.extractor import flatten_structured_to_data_points

    rows: list[dict] = []

    # ── Section 1: Customer Details ───────────────────────────────────────────
    customer_fields = [
        ("customer_name", "Customer Name"),
        ("customer_address", "Customer Address"),
        ("contact_person", "Contact Person"),
        ("rfq_number", "RFQ Number"),
        ("rfq_date", "RFQ Date"),
    ]
    for key, label in customer_fields:
        rows.append({
            "key": f"{SEC_CUSTOMER}{key}",
            "label": label,
            "value": _stringify(structured.get(key)),
            "source": "extracted",
            "required": False,
        })

    # ── Section 2: Required Product Details (from product definition) ─────────
    product_def = None
    if run.meta_product:
        product_def = product_service.get_product_fields(db, run.meta_product)
    required_keys: set[str] = set()
    if product_def and product_def.fields:
        extracted_req = structured.get("required_product_details") or {}
        for f in product_def.fields:
            required_keys.add(f["key"])
            rows.append({
                "key": f"{SEC_REQUIRED}{f['key']}",
                "label": f.get("label", f["key"]),
                "value": _stringify(extracted_req.get(f["key"])),
                "source": "extracted",
                "required": f.get("required", True),
            })

    # ── Section 3: Additional Information (everything else extracted) ─────────
    for r in flatten_structured_to_data_points(structured):
        rows.append({
            "key": r["key"],
            "label": r["label"],
            "value": r["value"],
            "source": r["source"],
            "required": False,
        })

    return rows


def _persist_sections(db: Session, run_id: UUID, rows: list[dict]) -> list[DataPointOut]:
    rfq_service.save_data_points(db, run_id, rows)
    return [
        DataPointOut(
            key=r["key"], label=r["label"], value=r["value"],
            source=r["source"], required=r.get("required", False),
        )
        for r in rows
    ]


def _patch_structured_from_edits(db: Session, run_id: UUID, user_map: dict) -> None:
    """Merge user-edited (prefixed) data-point values back into the cached
    structured extraction (result_json) so the generator uses corrected values."""
    run = rfq_service.get_run(db, run_id)
    if not run or not run.result_json:
        return
    structured = {k: v for k, v in run.result_json.items() if k != "_extraction_only"}

    for key, val in user_map.items():
        if val is None:
            continue
        if key.startswith(SEC_CUSTOMER):
            real = key[len(SEC_CUSTOMER):]
            structured[real] = val
        elif key.startswith(SEC_REQUIRED):
            real = key[len(SEC_REQUIRED):]
            structured.setdefault("required_product_details", {})[real] = val
            structured[real] = val
        elif "__" in key:
            section, sub = key.split("__", 1)
            node = structured.get(section)
            if not isinstance(node, dict):
                node = {}
                structured[section] = node
            node[sub] = val
        else:
            structured[key] = val

    rfq_service.save_extracted_json(db, run_id, structured)


def _out(run: RfqRun) -> RfqRunOut:
    dps = None
    if run.data_points:
        dps = [
            DataPointOut(
                key=dp.field_key,
                label=dp.field_label,
                value=dp.value,
                source=dp.source,
            )
            for dp in run.data_points
        ]
    return RfqRunOut(
        id=str(run.id),
        status=run.status.value,
        input_type=run.input_type.value,
        source_filename=run.source_filename,
        created_at=run.created_at.isoformat(),
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        error=run.error,
        result_json=run.result_json,
        meta_company_name=run.meta_company_name,
        meta_product=run.meta_product,
        meta_rfq_date=run.meta_rfq_date,
        meta_rfq_number=run.meta_rfq_number,
        meta_confirmed=run.meta_confirmed,
        data_confirmed=run.data_confirmed,
        edited_content=run.edited_content,
        similar_run_ids=run.similar_run_ids,
        data_points=dps,
        approval_state=run.approval_state.value if run.approval_state else "none",
        customer_approved_at=run.customer_approved_at.isoformat() if run.customer_approved_at else None,
        customer_po_reference=run.customer_po_reference,
    )


# ── Existing endpoints ────────────────────────────────────────────────────────

@router.post("/text", response_model=RfqRunOut, status_code=201)
def submit_text(body: TextRfqRequest, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text is empty")
    if len(body.text) > MAX_TEXT_LEN:
        raise HTTPException(status_code=422, detail="Text too long")
    run = rfq_service.create_run(db, submitted_by=user.id, input_type=InputType.text,
                                 source_text=body.text)
    from app.worker.tasks import process_rfq_task  # lazy: avoids langchain import at module load
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
    from app.worker.tasks import process_rfq_task  # lazy: avoids langchain import at module load
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


# ── New three-step flow endpoints ─────────────────────────────────────────────

@router.post("/extract", response_model=RfqExtractResponse, status_code=202)
def extract(
    file: UploadFile = File(None),
    product_name: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Step 1: Parse document + lightweight metadata extraction. Returns run_id + 4 meta fields."""
    settings = get_settings()

    if file is not None:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(status_code=422, detail=f"Unsupported file type {ext}")
        os.makedirs(settings.uploads_dir, exist_ok=True)
        path = os.path.join(settings.uploads_dir, file.filename)
        with open(path, "wb") as fh:
            fh.write(file.file.read())
        from app.services.parser import extract_text
        raw_text = extract_text(path)
        run = rfq_service.create_run(
            db, submitted_by=user.id, input_type=InputType.file,
            source_filename=file.filename, source_text=raw_text,
        )
    else:
        raise HTTPException(status_code=422, detail="File is required for extract endpoint")

    rfq_service.set_status(db, run.id, RunStatus.extracting)

    chosen_product = (product_name or "").strip() or None
    if chosen_product:
        run.meta_product = chosen_product
        db.commit()
        db.refresh(run)

    from app.services.extractor import extract_combined
    product_def = product_service.get_product_fields(db, chosen_product) if chosen_product else None
    fields = product_def.fields if product_def else None
    structured = extract_combined(raw_text, fields)

    meta = {
        "meta_company_name": structured.get("customer_name"),
        "meta_rfq_date": structured.get("rfq_date"),
        "meta_rfq_number": structured.get("rfq_number"),
    }
    if not chosen_product:
        meta["meta_product"] = structured.get("equipment_type")
    rfq_service.save_metadata(db, run.id, meta)
    rfq_service.save_extracted_json(db, run.id, structured)
    db.refresh(run)

    # Build 3 sections (customer / required product / additional) and persist
    dp_rows = _build_sections(db, run, structured)
    data_points_out = _persist_sections(db, run.id, dp_rows)

    rfq_service.set_status(db, run.id, RunStatus.pending_confirmation)

    db.refresh(run)
    return RfqExtractResponse(
        run_id=str(run.id),
        status=run.status.value,
        meta_company_name=run.meta_company_name,
        meta_product=run.meta_product,
        meta_rfq_date=run.meta_rfq_date,
        meta_rfq_number=run.meta_rfq_number,
        data_points=data_points_out,
    )


@router.post("/extract-text", response_model=RfqExtractResponse, status_code=202)
def extract_text_route(
    body: TextRfqRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Step 1 (text variant): Full structured extraction from pasted text."""
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="Text is empty")
    if len(body.text) > MAX_TEXT_LEN:
        raise HTTPException(status_code=422, detail="Text too long")

    run = rfq_service.create_run(
        db, submitted_by=user.id, input_type=InputType.text,
        source_text=body.text,
    )
    rfq_service.set_status(db, run.id, RunStatus.extracting)

    chosen_product = (body.product_name or "").strip() or None
    if chosen_product:
        run.meta_product = chosen_product
        db.commit()
        db.refresh(run)

    from app.services.extractor import extract_combined
    product_def = product_service.get_product_fields(db, chosen_product) if chosen_product else None
    fields = product_def.fields if product_def else None
    structured = extract_combined(body.text, fields)

    meta = {
        "meta_company_name": structured.get("customer_name"),
        "meta_rfq_date": structured.get("rfq_date"),
        "meta_rfq_number": structured.get("rfq_number"),
    }
    if not chosen_product:
        meta["meta_product"] = structured.get("equipment_type")
    rfq_service.save_metadata(db, run.id, meta)
    rfq_service.save_extracted_json(db, run.id, structured)
    db.refresh(run)

    # Build 3 sections (customer / required product / additional) and persist
    dp_rows = _build_sections(db, run, structured)
    data_points_out = _persist_sections(db, run.id, dp_rows)

    rfq_service.set_status(db, run.id, RunStatus.pending_confirmation)

    db.refresh(run)
    return RfqExtractResponse(
        run_id=str(run.id),
        status=run.status.value,
        meta_company_name=run.meta_company_name,
        meta_product=run.meta_product,
        meta_rfq_date=run.meta_rfq_date,
        meta_rfq_number=run.meta_rfq_number,
        data_points=data_points_out,
    )


@router.post("/{run_id}/confirm", response_model=RfqConfirmResponse)
def confirm(
    run_id: UUID,
    body: RfqConfirmRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Step 2: User confirms/edits metadata. Triggers data-point extraction or queues pipeline."""
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.pending_confirmation:
        raise HTTPException(status_code=409, detail=f"Run is not awaiting confirmation (status={run.status.value})")
    if user.role not in (UserRole.admin, UserRole.super_admin) and run.submitted_by != user.id:
        raise HTTPException(status_code=403, detail="Not your run")

    rfq_service.save_metadata(db, run.id, {
        "meta_company_name": body.meta_company_name,
        "meta_product": body.meta_product,
        "meta_rfq_date": body.meta_rfq_date,
        "meta_rfq_number": body.meta_rfq_number,
    })
    rfq_service.set_confirmed(db, run.id)

    # Save user-edited data points (submitted together with metadata — single step)
    if body.data_points:
        existing = {dp.field_key: dp for dp in rfq_service.get_data_points(db, run_id)}
        all_rows = []
        user_map = {dp.key: dp.value for dp in body.data_points}
        for key, dp in existing.items():
            all_rows.append({
                "key": key,
                "label": dp.field_label,
                "value": user_map.get(key, dp.value),
                "source": "user_input" if key in user_map else dp.source,
            })
        for key, val in user_map.items():
            if key not in existing:
                all_rows.append({"key": key, "label": key, "value": val, "source": "user_input"})
        rfq_service.save_data_points(db, run.id, all_rows)

        # Patch result_json (the structured extraction) with user edits so the
        # generator consumes the corrected values. Prefix-aware:
        #   customer__X / required__X  → top-level X (+ grouped dict)
        #   section__sub               → nested structured[section][sub]
        #   plain key                  → top-level
        _patch_structured_from_edits(db, run.id, user_map)

    rfq_service.set_data_confirmed(db, run.id)
    rfq_service.set_status(db, run.id, RunStatus.queued)
    from app.worker.tasks import process_rfq_task  # lazy
    task = process_rfq_task.delay(run_id=str(run.id))
    rfq_service.set_task_id(db, run.id, task.id)
    db.refresh(run)
    return RfqConfirmResponse(run_id=str(run.id), status=RunStatus.queued.value, data_points=[])


@router.post("/{run_id}/submit-data", response_model=RfqRunOut)
def submit_data(
    run_id: UUID,
    body: RfqDataSubmitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Step 3: User fills missing required data points. Validates then enqueues pipeline."""
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.pending_data:
        raise HTTPException(status_code=409, detail=f"Run is not awaiting data (status={run.status.value})")
    if user.role not in (UserRole.admin, UserRole.super_admin) and run.submitted_by != user.id:
        raise HTTPException(status_code=403, detail="Not your run")

    product_def = product_service.get_product_fields(db, run.meta_product or "") if run.meta_product else None

    # Build merged value map: existing extracted + user-submitted (user wins)
    existing_dps = {dp.field_key: dp.value for dp in rfq_service.get_data_points(db, run_id)}
    user_values = {dp.key: dp.value for dp in body.data_points}
    merged = {**existing_dps, **user_values}

    # Validate all required fields are present
    if product_def and product_def.fields:
        missing = [
            f["key"] for f in product_def.fields
            if f.get("required", True) and not merged.get(f["key"])
        ]
        if missing:
            raise HTTPException(
                status_code=422,
                detail={"message": "Required fields missing", "missing_keys": missing},
            )

    # Save user-input data points
    user_dp_rows = [
        {"key": dp.key, "label": None, "value": dp.value, "source": "user_input"}
        for dp in body.data_points
        if dp.value is not None
    ]
    if user_dp_rows:
        # Merge with existing extracted rows
        all_rows = []
        if product_def and product_def.fields:
            for f in product_def.fields:
                if f["key"] in user_values and user_values[f["key"]] is not None:
                    all_rows.append({"key": f["key"], "label": f.get("label"), "value": user_values[f["key"]], "source": "user_input"})
                elif f["key"] in existing_dps and existing_dps[f["key"]] is not None:
                    all_rows.append({"key": f["key"], "label": f.get("label"), "value": existing_dps[f["key"]], "source": "extracted"})
        rfq_service.save_data_points(db, run.id, all_rows)

    rfq_service.set_data_confirmed(db, run.id)
    rfq_service.set_status(db, run.id, RunStatus.queued)

    from app.worker.tasks import process_rfq_task  # lazy
    task = process_rfq_task.delay(run_id=str(run.id))
    rfq_service.set_task_id(db, run.id, task.id)

    db.refresh(run)
    return _out(run)


@router.patch("/{run_id}/content", response_model=RfqRunOut)
def save_content(
    run_id: UUID,
    body: RfqContentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Save TipTap HTML edited content."""
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.done:
        raise HTTPException(status_code=409, detail="Run is not done yet")
    if user.role not in (UserRole.admin, UserRole.super_admin) and run.submitted_by != user.id:
        raise HTTPException(status_code=403, detail="Not your run")
    rfq_service.save_content(db, run.id, body.content)
    db.refresh(run)
    return _out(run)


@router.get("/{run_id}/export")
def export_docx(
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Export run as Word .docx document."""
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != RunStatus.done:
        raise HTTPException(status_code=409, detail="Run is not done yet")
    if user.role not in (UserRole.admin, UserRole.super_admin) and run.submitted_by != user.id:
        raise HTTPException(status_code=403, detail="Not your run")

    from app.services.docx_export import generate_docx_from_html
    from app.services.docx_exporter import create_quote_docx
    if run.edited_content:
        docx_bytes = generate_docx_from_html(run.edited_content, run)
    else:
        buf = create_quote_docx(run.result_json or {})
        docx_bytes = buf.read()

    filename = f"quote_{str(run.id)[:8]}.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Approval workflow endpoints ────────────────────────────────────────────────

def _approval_request_out(req) -> ApprovalRequestOut:
    stages = []
    for stage in sorted(req.stages, key=lambda s: s.stage_index):
        assignments = [
            AssignmentOut(
                id=str(a.id),
                approver_id=str(a.approver_id),
                approver_name=a.approver.full_name if a.approver else None,
                approver_email=a.approver.email if a.approver else None,
                decision=a.decision.value,
                comment=a.comment,
                decided_at=a.decided_at.isoformat() if a.decided_at else None,
            )
            for a in stage.assignments
        ]
        stages.append(StageOut(
            id=str(stage.id),
            stage_index=stage.stage_index,
            name=approval_service.effective_stage_name(req, stage),
            required_count=stage.required_count,
            status=stage.status.value,
            assignments=assignments,
        ))
    return ApprovalRequestOut(
        id=str(req.id),
        run_id=str(req.run_id),
        submitted_by=str(req.submitted_by),
        status=req.status.value,
        current_stage_index=req.current_stage_index,
        created_at=req.created_at.isoformat(),
        completed_at=req.completed_at.isoformat() if req.completed_at else None,
        stages=stages,
    )


@router.post("/{run_id}/submit-approval", response_model=ApprovalRequestOut, status_code=201)
def submit_approval(
    run_id: UUID,
    body: SubmitApprovalRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if user.role not in (UserRole.admin, UserRole.super_admin) and run.submitted_by != user.id:
        raise HTTPException(status_code=403, detail="Not your run")
    req = approval_service.create_request(run, str(user.id), body.stages, db, body.template_id)
    return _approval_request_out(req)


@router.get("/{run_id}/approval", response_model=ApprovalRequestOut)
def get_approval(
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if user.role not in (UserRole.admin, UserRole.super_admin) and run.submitted_by != user.id:
        raise HTTPException(status_code=403, detail="Not your run")
    req = approval_service.get_active_request(str(run_id), db)
    if not req:
        raise HTTPException(status_code=404, detail="No approval request found")
    return _approval_request_out(req)


@router.post("/{run_id}/mark-sent", response_model=RfqRunOut)
def mark_sent_to_customer(
    run_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.approval_state != ApprovalState.approved:
        raise HTTPException(
            status_code=400,
            detail="Run must be internally approved before marking as sent to customer",
        )
    run.approval_state = ApprovalState.sent_to_customer
    db.commit()
    db.refresh(run)
    return _out(run)


@router.post("/{run_id}/mark-customer-approved", response_model=RfqRunOut)
def mark_customer_approved(
    run_id: UUID,
    body: CustomerApprovedRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from datetime import datetime as dt
    run = rfq_service.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.approval_state != ApprovalState.sent_to_customer:
        raise HTTPException(
            status_code=400,
            detail="Run must be marked as sent to customer before recording customer approval",
        )
    try:
        run.customer_approved_at = dt.fromisoformat(body.customer_approved_at)
    except ValueError:
        raise HTTPException(status_code=422, detail="customer_approved_at must be a valid ISO date")
    run.customer_po_reference = body.customer_po_reference
    run.approval_state = ApprovalState.customer_approved
    db.commit()
    db.refresh(run)
    return _out(run)
