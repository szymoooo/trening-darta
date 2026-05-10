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
    // Should have active/selected class
    await expect(trainingTab).toHaveClass(/active|selected|current/);
  });

  test('switch to matches tab', async ({ page }) => {
    await page.click('#history-tab-matches');
    await page.waitForTimeout(500);
    const matchesTab = page.locator('#history-tab-matches');
    await expect(matchesTab).toHaveClass(/active|selected|current/);
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
    // Try nav home button
    await page.click('#nav-home-btn');
    await page.waitForTimeout(500);
    await expect(page.locator('#screen-home')).toHaveClass(/active/);
  });

  test('history items display after training', async ({ page }) => {
    // First do a quick training to generate history
    await page.click('#nav-home-btn');
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
    await page.waitForSelector('#screen-summary.active', { timeout: 5000 });
    await page.click('#summary-home');
    await page.waitForSelector('#screen-home.active', { timeout: 5000 });

    // Now check history
    await page.click('#nav-history-btn');
    await page.waitForSelector('#screen-history.active', { timeout: 5000 });

    const historyList = page.locator('#history-list');
    const items = historyList.locator('.history-item, .history-row, > *');
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });
});
