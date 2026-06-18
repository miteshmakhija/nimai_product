import { test, expect, type Page } from '@playwright/test';

/**
 * UI test for the Approvals screen.
 *
 * Fully deterministic: all backend calls are stubbed with page.route, so the
 * test needs neither a running API, a seeded DB, nor the (slow, LLM-backed)
 * RFQ pipeline. Auth is seeded directly into localStorage so we land on the
 * authenticated Approvals route without driving the login form.
 */

const ME = {
  id: 'u-alice',
  email: 'alice.finance@nimai.ai',
  full_name: 'Alice Finance',
  role: 'admin',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

const PENDING = [
  {
    id: 'aaaaaaaa-1111-2222-3333-444444444444',
    approver_id: 'u-alice',
    approver_name: 'Alice Finance',
    approver_email: 'alice.finance@nimai.ai',
    decision: 'pending',
    comment: null,
    decided_at: null,
  },
];

const REVIEWED = [
  {
    id: 'bbbbbbbb-5555-6666-7777-888888888888',
    approver_id: 'u-alice',
    approver_name: 'Alice Finance',
    approver_email: 'alice.finance@nimai.ai',
    decision: 'approved',
    comment: 'Numbers check out',
    decided_at: '2026-06-10T10:00:00Z',
  },
];

/**
 * Install auth + approvals stubs. `queueRef` lets a test mutate the pending
 * list after an action (e.g. a decision removes the item on refresh).
 */
async function setupApprovals(
  page: Page,
  opts: { pending?: typeof PENDING; reviewed?: typeof REVIEWED } = {},
) {
  const state = {
    pending: opts.pending ?? PENDING,
    reviewed: opts.reviewed ?? REVIEWED,
    decideCalls: [] as { id: string; body: unknown }[],
  };

  // Seed auth so AuthProvider authenticates on first load.
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'test-access');
    localStorage.setItem('refresh_token', 'test-refresh');
  });

  await page.route('**/auth/me', (route) => route.fulfill({ json: ME }));

  await page.route('**/approvals/queue', (route) =>
    route.fulfill({ json: state.pending }),
  );
  await page.route('**/approvals/reviewed', (route) =>
    route.fulfill({ json: state.reviewed }),
  );

  await page.route('**/approvals/*/decide', async (route) => {
    const url = new URL(route.request().url());
    const id = url.pathname.split('/').slice(-2, -1)[0];
    state.decideCalls.push({ id, body: route.request().postDataJSON() });
    // A decision removes the item from the pending queue on the UI refresh.
    state.pending = [];
    await route.fulfill({ json: { ok: true } });
  });

  return state;
}

test.describe('Approvals screen', () => {
  test('renders pending queue with count badge', async ({ page }) => {
    await setupApprovals(page);
    await page.goto('/approvals');

    await expect(
      page.getByRole('heading', { name: 'Approvals' }),
    ).toBeVisible();

    // Pending tab badge shows the queue length.
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible();

    // The seeded assignment card is shown (id is sliced to 8 chars in the UI).
    await expect(page.getByText('Assignment #aaaaaaaa')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();
  });

  test('approving an item calls decide and removes it from the queue', async ({
    page,
  }) => {
    const state = await setupApprovals(page);
    await page.goto('/approvals');

    await page.getByRole('button', { name: 'Approve' }).click();

    // Item disappears, empty state appears.
    await expect(page.getByText("You're all caught up")).toBeVisible();

    expect(state.decideCalls).toHaveLength(1);
    expect(state.decideCalls[0].id).toBe(
      'aaaaaaaa-1111-2222-3333-444444444444',
    );
    expect(state.decideCalls[0].body).toMatchObject({ decision: 'approved' });
  });

  test('rejecting prompts for a comment and sends it', async ({ page }) => {
    const state = await setupApprovals(page);
    await page.goto('/approvals');

    // The page uses window.prompt for the rejection reason.
    page.once('dialog', (dialog) => dialog.accept('Pricing too high'));

    await page.getByRole('button', { name: 'Reject' }).click();

    await expect(page.getByText("You're all caught up")).toBeVisible();

    expect(state.decideCalls).toHaveLength(1);
    expect(state.decideCalls[0].body).toMatchObject({
      decision: 'rejected',
      comment: 'Pricing too high',
    });
  });

  test('reviewed tab shows previously decided items', async ({ page }) => {
    await setupApprovals(page);
    await page.goto('/approvals');

    await page.getByRole('button', { name: 'reviewed' }).click();

    await expect(page.getByText('Assignment #bbbbbbbb')).toBeVisible();
    await expect(page.getByText('Numbers check out')).toBeVisible();
    // No action buttons on reviewed items.
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('empty pending queue shows the caught-up state', async ({ page }) => {
    await setupApprovals(page, { pending: [] });
    await page.goto('/approvals');

    await expect(page.getByText("You're all caught up")).toBeVisible();
  });
});
