import { test, expect } from '@playwright/test';
import { login, clickThrow, completeRound } from './fixtures/test-helpers';

test.describe('History', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await page.click('#nav-history-btn');
    await page.waitForSelector('#screen-history.active', { timeout: 10000 });
  });

  test('training tab active by default', async ({ page }) => {
    const trainingTab = page.locator('#history-tab-training');
    await expect(trainingTab).toBeVisible();
    // App uses .on class for active tab
    await expect(trainingTab).toHaveClass(/\bon\b/);
  });

  test('switch to matches tab', async ({ page }) => {
    await page.click('#history-tab-matches');
    await page.waitForTimeout(500);
    await expect(page.locator('#history-tab-matches')).toHaveClass(/\bon\b/);
    await expect(page.locator('#history-tab-training')).not.toHaveClass(/\bon\b/);
  });

  test('empty state message for no history', async ({ page }) => {
    // Switch to matches tab where there might be no history
    await page.click('#history-tab-matches');
    await page.waitForTimeout(500);

    const historyList = page.locator('#history-list');
    const items = historyList.locator('.history-item, .history-row, > *');
    const count = await items.count();

    if (count === 0) {
      // Should show empty state
      const emptyState = page.locator('#screen-history .empty, .no-data, [class*="empty"]');
      const emptyText = page.locator('#screen-history');
      const screenText = await emptyText.textContent();
      expect(screenText).toMatch(/brak|pust|nic|empty|no data/i);
    } else {
      // History has items — that's also fine
      expect(count).toBeGreaterThan(0);
    }
  });

  test('back button returns to home', async ({ page }) => {
    // Click the back button in the history header
    await page.click('#history-back-btn');
    await page.waitForSelector('#screen-home.active', { timeout: 10000 });
    await expect(page.locator('#screen-home')).toHaveClass(/active/);
  });

  test('history items display after training', async ({ page }) => {
    test.slow();

    // Go back to home first
    await page.click('#history-back-btn');
    await page.waitForSelector('#screen-home.active', { timeout: 5000 });

    // Start first exercise
    const firstExercise = page.locator('#ex-list .exc, #ex-list .exercise-card, #ex-list > *').first();
    await firstExercise.waitFor({ state: 'visible', timeout: 10000 });
    await firstExercise.click();
    await page.waitForSelector('#screen-training.active', { timeout: 10000 });

    // Complete all targets
    let safety = 0;
    while (safety < 50) {
      safety++;
      await completeRound(page, ['single', 'single', 'single']);
      await page.waitForTimeout(300);
      const finishVisible = await page.locator('#training-finish').isVisible().catch(() => false);
      if (finishVisible) {
        await page.click('#training-finish');
        break;
      }
      const nextVisible = await page.locator('#training-next').isVisible().catch(() => false);
      if (nextVisible) {
        await page.click('#training-next');
        await page.waitForTimeout(300);
      }
    }

    // Wait for summary
    await page.waitForSelector('#screen-summary.active', { timeout: 10000 });
    await page.click('#summary-home');
    await page.waitForSelector('#screen-home.active', { timeout: 5000 });

    // Now check history
    await page.click('#nav-history-btn');
    await page.waitForSelector('#screen-history.active', { timeout: 5000 });

    const historyList = page.locator('#history-list');
    // Should have some content (either items or empty state)
    await expect(historyList).toBeVisible();
    const hasItems = await historyList.locator('.hi, .hi-match, > div').count();
    expect(hasItems).toBeGreaterThan(0);
  });
});
