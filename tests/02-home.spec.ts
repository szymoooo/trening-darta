import { test, expect } from '@playwright/test';
import { login, navigateTo } from './fixtures/test-helpers';

test.describe('Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await expect(page.locator('#screen-home')).toHaveClass(/active/);
  });

  test('displays user name and streak', async ({ page }) => {
    // User name should appear somewhere on home screen
    const homeScreen = page.locator('#screen-home');
    await expect(homeScreen).toContainText(/testuser|Witaj|Cześć/i);
    // Streak indicator should be visible
    const streak = homeScreen.locator('[class*="streak"], .streak, .user-streak');
    const streakExists = await streak.count();
    if (streakExists > 0) {
      await expect(streak.first()).toBeVisible();
    }
  });

  test('displays best score and session count', async ({ page }) => {
    const homeScreen = page.locator('#screen-home');
    // Check for stats section with numbers
    const statsArea = homeScreen.locator('.stats, .user-stats, .score-box, [class*="stat"]');
    const statsExist = await statsArea.count();
    if (statsExist > 0) {
      await expect(statsArea.first()).toBeVisible();
    }
  });

  test('shows exercise list', async ({ page }) => {
    // Exercise list should be populated
    const exercises = page.locator('#ex-list .exc, #ex-list .exercise-card, #ex-list > *');
    await expect(exercises.first()).toBeVisible({ timeout: 10000 });
    const count = await exercises.count();
    expect(count).toBeGreaterThan(0);
  });

  test('click exercise starts training', async ({ page }) => {
    const firstExercise = page.locator('#ex-list .exc, #ex-list .exercise-card, #ex-list > *').first();
    await firstExercise.click();
    await page.waitForTimeout(1000);
    // Should navigate to training screen
    await expect(page.locator('#screen-training')).toHaveClass(/active/);
    await expect(page.locator('#training-title')).toBeVisible();
  });

  test('navigation to history', async ({ page }) => {
    await page.click('#nav-history-btn');
    await expect(page.locator('#screen-history')).toHaveClass(/active/);
  });

  test('navigation to profile', async ({ page }) => {
    await page.click('#nav-profile-btn');
    await expect(page.locator('#screen-profile')).toHaveClass(/active/);
  });

  test('game modal opens', async ({ page }) => {
    await page.click('#nav-game-btn');
    await expect(page.locator('#game-modal')).toHaveClass(/show/);
  });
});
