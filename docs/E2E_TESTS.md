# Frontend E2E Tests (Playwright)

UI tests for the Approvals workflow. Two layers: fast **mocked** tests (no
backend) and one **live** test that drives the real API.

## Layout

| File | Type | Needs backend? |
|---|---|---|
| [frontend/e2e/approvals.spec.ts](../frontend/e2e/approvals.spec.ts) | Mocked (5 tests) | No |
| [frontend/e2e/approvals-live.spec.ts](../frontend/e2e/approvals-live.spec.ts) | Live (1 test) | Yes — auto-skips if `:8000` down |
| [frontend/playwright.config.ts](../frontend/playwright.config.ts) | Config | — |
| [backend/scripts/seed_approval_e2e.py](../backend/scripts/seed_approval_e2e.py) | Seed for live test | Yes |

## Running

```powershell
cd frontend
npm run test:e2e                              # everything (live auto-skips if backend down)
npm run test:e2e:ui                           # interactive UI mode
npx playwright test approvals.spec.ts         # mocked only
npx playwright test approvals-live.spec.ts    # live only (requires .\start.ps1 up)
```

First-time setup (already done once on this machine):

```powershell
cd frontend
npm install -D @playwright/test
npx playwright install chromium
```

## What each layer covers

**Mocked** (`approvals.spec.ts`) — all API calls stubbed with `page.route`, auth
seeded into `localStorage`. Deterministic, no DB or LLM:

1. Pending queue renders with count badge
2. Approve → calls `/approvals/{id}/decide` with `{decision:"approved"}`, item leaves queue
3. Reject → `window.prompt` dialog → sends `{decision:"rejected", comment}`
4. Reviewed tab lists decided items, no action buttons
5. Empty queue → "You're all caught up"

**Live** (`approvals-live.spec.ts`) — drives the real stack:

1. `beforeAll` checks `/health`; skips the suite if the backend is unreachable.
2. Runs [seed_approval_e2e.py](../backend/scripts/seed_approval_e2e.py) to create a
   `done` run + 1-stage approval assigned to Alice Finance.
3. Logs in through the UI as Alice (`Test@1234`).
4. Approves the seeded card (row-scoped, since Alice may hold other pending items).
5. Asserts the item leaves Pending and appears under Reviewed.

## Notes

- Spec files are ESM — use `import.meta.url`, not `__dirname`.
- The seed is idempotent: it deletes prior runs tagged `meta_rfq_number="E2E-APPROVAL"`
  before creating a fresh one.
