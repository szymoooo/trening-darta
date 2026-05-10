import { test, expect } from '@playwright/test';
import { login, startMatch, enterScore, clearNumpad } from './fixtures/test-helpers';

test.describe('Match', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await startMatch(page, 501);
  });

  test('starts with correct score (501)', async ({ page }) => {
    const scoreText = await page.locator('#match-score').textContent();
    expect(scoreText?.trim()).toBe('501');
  });

  test('score decreases after valid entry', async ({ page }) => {
    await enterScore(page, 60);
    const scoreText = await page.locator('#match-score').textContent();
    expect(parseInt(scoreText?.trim() || '0')).toBe(441);
  });

  test('BUST when score exceeds remaining', async ({ page }) => {
    // Enter a score higher than 501 isn't possible via numpad (max 180)
    // So first reduce to a low score, then bust
    await enterScore(page, 180);
    await enterScore(page, 180);
    await enterScore(page, 100);
    // Now remaining is 41, enter 42 which busts (needs double checkout)
    await enterScore(page, 42);
    await page.waitForTimeout(500);

    // Score should remain at 41 (bust reverts the round)
    const scoreText = await page.locator('#match-score').textContent();
    const score = parseInt(scoreText?.trim() || '0');
    expect(score).toBe(41);
  });

  test('BUST when score_after equals 1 (impossible checkout)', async ({ page }) => {
    // Reduce to 41, then enter 40 → leaves 1 which is impossible (can't checkout on 1)
    await enterScore(page, 180);
    await enterScore(page, 180);
    await enterScore(page, 100);
    // Now at 41, enter 40 → leaves 1
    await enterScore(page, 40);
    await page.waitForTimeout(500);

    const scoreText = await page.locator('#match-score').textContent();
    const score = parseInt(scoreText?.trim() || '0');
    // Should bust — score stays at 41
    expect(score).toBe(41);
  });

  test('entering 0 is valid (pudło serii)', async ({ page }) => {
    await enterScore(page, 0);
    await page.waitForTimeout(500);

    const scoreText = await page.locator('#match-score').textContent();
    expect(parseInt(scoreText?.trim() || '0')).toBe(501);

    // Round should be recorded in history
    const historyItems = page.locator('.round-row, .round-item, [class*="round"]');
    const count = await historyItems.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('max 180 per round enforced by numpad', async ({ page }) => {
    // Try to type 180 — should work
    await page.click('#np-1');
    await page.click('#np-8');
    await page.click('#np-0');
    await page.click('#np-ok');
    await page.waitForTimeout(500);

    const scoreText = await page.locator('#match-score').textContent();
    expect(parseInt(scoreText?.trim() || '0')).toBe(321);
  });

  test('entering 181 is rejected', async ({ page }) => {
    await page.click('#np-1');
    await page.click('#np-8');
    await page.click('#np-1');
    await page.click('#np-ok');
    await page.waitForTimeout(500);

    // Score should remain at 501 (181 rejected)
    const scoreText = await page.locator('#match-score').textContent();
    expect(parseInt(scoreText?.trim() || '0')).toBe(501);
  });

  test('rounds appear in history list', async ({ page }) => {
    await enterScore(page, 60);
    await enterScore(page, 45);
    await page.waitForTimeout(500);

    const historyItems = page.locator('.round-row, .round-item, [class*="round"]');
    const count = await historyItems.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('checkout hint shown when score <= 170', async ({ page }) => {
    // Get score down to <= 170
    await enterScore(page, 180);
    await enterScore(page, 160);
    // Now at 161
    await page.waitForTimeout(500);

    const hintArea = page.locator('#hint-area');
    await expect(hintArea).toBeVisible();
    const hintText = await hintArea.textContent();
    expect(hintText?.length).toBeGreaterThan(0);
  });

  test('win flow when score reaches 0', async ({ page }) => {
    // Fast game: 501 = 180 + 180 + 141 (T20 T19 D12)
    await enterScore(page, 180);
    await enterScore(page, 180);
    await enterScore(page, 141);
    await page.waitForTimeout(1000);

    // Should show win state — either a modal, overlay, or redirect
    const winIndicator = page.locator('#ca-overlay.show, .win-screen, [class*="win"], #match-score:has-text("0")');
    await expect(winIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('new match button works', async ({ page }) => {
    await page.click('#match-new-btn');
    await page.waitForTimeout(1000);

    // Should show match modal or reset score
    const matchModal = page.locator('#match-modal.show');
    const scoreReset = page.locator('#match-score');
    const modalVisible = await matchModal.isVisible().catch(() => false);
    if (modalVisible) {
      await expect(matchModal).toBeVisible();
    } else {
      const score = await scoreReset.textContent();
      // Score should be back to a starting value
      expect(['501', '301', '701']).toContain(score?.trim());
    }
  });

  test('single throw mode: 3 throws accumulate before saving', async ({ page }) => {
    // First navigate to profile to enable single throw mode
    await page.click('#match-back');
    await page.waitForTimeout(500);

    // Handle possible exit confirmation
    const dialogVisible = await page.locator('#ca-overlay.show').isVisible().catch(() => false);
    if (dialogVisible) {
      await page.locator('#ca-overlay.show .ca-btn.primary').click();
      await page.waitForTimeout(500);
    }

    await page.click('#nav-profile-btn');
    await page.waitForSelector('#screen-profile.active', { timeout: 5000 });
    await page.click('#profile-mode-single');
    await page.click('#profile-save');
    await page.waitForTimeout(1000);

    // Start a new match
    await startMatch(page, 501);

    // In single throw mode, enter 3 individual throws
    await page.click('#np-2');
    await page.click('#np-0');
    await page.click('#np-ok');
    await page.waitForTimeout(300);

    await page.click('#np-2');
    await page.click('#np-0');
    await page.click('#np-ok');
    await page.waitForTimeout(300);

    await page.click('#np-2');
    await page.click('#np-0');
    await page.click('#np-ok');
    await page.waitForTimeout(800);

    // After 3 throws, total 60 should be subtracted
    const scoreText = await page.locator('#match-score').textContent();
    expect(parseInt(scoreText?.trim() || '0')).toBe(441);
  });
});
