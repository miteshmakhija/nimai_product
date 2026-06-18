# NimAI RFQ Generator — Progress

> Updated: 2026-06-14

## Status: Feature-complete, E2E tested

All backend routes, frontend pages, and the three-step pipeline are implemented and working.
E2E tested end-to-end with `RFQ EEPL 711.docx` using Google Gemini 2.5 Flash via OpenAI-compatible endpoint.

## E2E Results (RFQ EEPL 711.docx — Process Column)

| Step | Result |
|---|---|
| Step 1 — DOCX upload + Docling parse + metadata extract | ✅ company=EEPL, product=Process Column, rfq_no + date correct |
| Step 2 — Confirm + extract 6 data points | ✅ design_pressure, design_temperature, shell_id, height_tl_tl, moc, design_code |
| Step 3 — Submit data → Celery pipeline | ✅ full extraction + generation completes |
| RunDetail — TipTap editor + docx export | ✅ |

Current LLM config: `EXTRACTOR_PROVIDER=openai`, `GENERATOR_PROVIDER=openai`, model=`gemini-2.5-flash`, base URL = Gemini OpenAI-compatible endpoint.

## Open Items

- [ ] **Populate vector store** — FAISS store at `data/vector_store/` is empty; write ingestion script for historical quotation JSONs
- [ ] **Pagination on `GET /rfqs`** — currently returns all runs; add `skip`/`limit` at scale
- [ ] **File deduplication** — same filename in `data/uploads/` overwrites; add UUID prefix
- [ ] **Frontend Vitest tests** — no frontend unit tests yet
- [ ] **Docker Compose** — `docker-compose.yml` exists but not end-to-end tested

## Known Quirks

- **Celery on Windows** — must use `--pool=solo`; prefork silently drops tasks
- **`extract_rfq_structured` is slow with small local LLMs** — use Gemini/OpenAI/large Ollama model
- **Legacy DB tables** (`conversations`, `rfqs`, `quotes`, `conversation_messages`) — unused, from original scaffold
- **Encoding artifacts** — some DOCX files render `°` as `Â°`; Docling handles this better than python-docx
