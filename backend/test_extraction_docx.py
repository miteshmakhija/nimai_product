"""Standalone test: RFQ extraction + quotation DOCX generation.

No server, no Celery, no database. Calls the services directly so you can
verify the LLM extraction and the Word-document output in one shot.

Run from the `backend/` folder:

    .venv\\Scripts\\python.exe test_extraction_docx.py
    .venv\\Scripts\\python.exe test_extraction_docx.py "data/samples/rfq/RFQ EEPL 925.docx"

Outputs (written to data/samples/output/):
    <name>.extracted.json   -> structured fields pulled from the RFQ
    <name>.draft.json       -> quotation data the LLM generated
    <name>.quotation.docx   -> final Word document
"""
import json
import sys
import time
from pathlib import Path

from app.services.parser import extract_text
from app.services.extractor import extract_rfq_structured
from app.services.retriever import retrieve_similar_structured
from app.services.generator import generate_quote_from_structured
from app.services.docx_exporter import create_quote_docx


DEFAULT_RFQ = "data/samples/rfq/RFQ EEPL 711.docx"
OUTPUT_DIR = Path("data/samples/output")


def _step(n: int, msg: str) -> float:
    print(f"\n[{n}] {msg}")
    return time.time()


def _done(t0: float) -> None:
    print(f"    ...ok ({time.time() - t0:.1f}s)")


def main() -> int:
    rfq_path = Path(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RFQ)
    if not rfq_path.exists():
        print(f"ERROR: input file not found: {rfq_path}")
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = rfq_path.stem.replace(" ", "_")

    print(f"Input RFQ : {rfq_path}")

    # 1. Parse document -> raw text
    t0 = _step(1, "Parsing document to text...")
    raw_text = extract_text(str(rfq_path))
    print(f"    {len(raw_text)} chars extracted")
    _done(t0)

    # 2. LLM extraction -> structured fields
    t0 = _step(2, "Extracting structured fields (LLM)...")
    structured = extract_rfq_structured(raw_text)
    extracted_file = OUTPUT_DIR / f"{stem}.extracted.json"
    extracted_file.write_text(json.dumps(structured, indent=2, default=str), encoding="utf-8")
    print(f"    customer_name : {structured.get('customer_name')}")
    print(f"    rfq_number    : {structured.get('rfq_number')}")
    print(f"    rfq_date      : {structured.get('rfq_date')}")
    print(f"    equipment_type: {structured.get('equipment_type')}")
    print(f"    saved -> {extracted_file}")
    _done(t0)

    # 3. Retrieve similar past quotes (FAISS, optional context)
    t0 = _step(3, "Retrieving similar past quotes...")
    try:
        similar = retrieve_similar_structured(structured)
    except Exception as e:
        print(f"    (skipped: {e})")
        similar = []
    print(f"    {len(similar)} similar doc(s)")
    _done(t0)

    # 4. LLM generation -> quotation draft JSON
    t0 = _step(4, "Generating quotation draft (LLM)...")
    draft = generate_quote_from_structured(structured, similar)
    draft_file = OUTPUT_DIR / f"{stem}.draft.json"
    draft_file.write_text(json.dumps(draft, indent=2, default=str), encoding="utf-8")
    print(f"    draft keys : {list(draft.keys()) if isinstance(draft, dict) else type(draft)}")
    print(f"    saved -> {draft_file}")
    _done(t0)

    # 5. Build the DOCX
    t0 = _step(5, "Building quotation DOCX...")
    buf = create_quote_docx(draft)
    docx_file = OUTPUT_DIR / f"{stem}.quotation.docx"
    docx_file.write_bytes(buf.getvalue())
    print(f"    saved -> {docx_file}")
    _done(t0)

    print("\nDONE. Open the .quotation.docx to review the formatted output.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
