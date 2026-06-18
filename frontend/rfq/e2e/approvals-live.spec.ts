import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * LIVE end-to-end test for the approval flow.
 *
 * Unlike approvals.spec.ts (fully mocked), this drives the REAL backend:
 *   1. A Python seed script creates a `done` run + a 1-stage approval request
 *      assigned to Alice Finance.
 *   2. We log in through the real UI as Alice.
 *   3. We approve the seeded item and assert it leaves the pending queue.
 *
 * Requires the full stack running (`.\\start.ps1`): backend on :8000, Postgres,
 * and the seeded test users. If the backend is unreachable the whole suite is
 * skipped instead of failing, so mocked runs stay green on machines without a DB.
 */

const ALICE = { email: 'alice.finance@nimai.ai', password: 'Test@1234' };

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(here, '..', '..', 'backend');
const pyExe = resolve(backendDir, '.venv', 'Scripts', 'python.exe');
const seedScript = resolve(backendDir, 'scripts', 'seed_approval_e2e.py');

type SeedResult = {
  run_id: string;
  request_id: string;
  assignment_id: string;
  approver_email: string;
};

let seed: SeedResult | null = null;

test.describe('Approval flow (live backend)', () => {
  test.beforeAll(async ({ request }) => {
    // Skip cleanly if the stack isn't up.
    if (!existsSync(pyExe)) {
      test.skip(true, `backend venv python not found at ${pyExe}`);
      return;
    }
    try {
      const health = await request.get('http://localhost:8000/health', {
        timeout: 4000,
      });
      test.skip(!health.ok(), 'backend /health not OK');
    } catch {
      test.skip(true, 'backend not reachable on :8000');
      return;
    }

    const out = execFileSync(pyExe, [seedScript], {
      cwd: backendDir,
      encoding: 'utf-8',
    });
    // The script may emit warnings on stderr; stdout is the final JSON line.
    const lastLine = out.trim().split(/\r?\n/).pop() as string;
    seed = JSON.parse(lastLine) as SeedResult;
    expect(seed.assignment_id).toBeTruthy();
  });

  test('Alice logs in and approves the seeded request', async ({ page }) => {
    test.skip(!seed, 'seed did not run');

    // Real login through the UI.
    await page.goto('/login');
    await page.getByPlaceholder('you@company.com').fill(ALICE.email);
    await page.getByPlaceholder('••••••••').fill(ALICE.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Land on an authenticated page, then go to Approvals.
    await page.waitForURL('**/');
    await page.goto('/approvals');

    await expect(
      page.getByRole('heading', { name: 'Approvals' }),
    ).toBeVisible();

    // The seeded assignment card (id sliced to first 8 chars in the UI).
    const shortId = seed!.assignment_id.slice(0, 8);
    const card = page.getByText(`Assignment #${shortId}`);
    await expect(card).toBeVisible();

    // Click Approve on THIS card's row (Alice may have other pending items),
    // by walking up to the nearest ancestor row that holds an Approve button.
    const row = card.locator(
      'xpath=ancestor::div[.//button[normalize-space()="Approve"]][1]',
    );
    await row.getByRole('button', { name: 'Approve' }).click();

    // After approval the item leaves the pending queue.
    await expect(page.getByText(`Assignment #${shortId}`)).toHaveCount(0);

    // And appears under the Reviewed tab as approved.
    await page.getByRole('button', { name: 'reviewed' }).click();
    await expect(page.getByText(`Assignment #${shortId}`)).toBeVisible();
  });
});
