import { test, expect } from '@playwright/test';
import { login, navigateTo } from './fixtures/test-helpers';

test.describe('Home Screen', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await expect(page.locator('#screen-home')).toHaveClass(/active/);
  });

  test('displays user name and streak', async ({ page }) => {
    // Wait for async renderHome to populate the fields
    await expect(page.locator('#home-name')).not.toHaveText('—', { timeout: 10000 });
    const name = await page.locator('#home-name').textContent();
    expect(name && name.trim().length > 0).toBeTruthy();
    // Streak indicator should be visible and populated
    await expect(page.locator('#home-streak')).toBeVisible();
    const streakText = await page.locator('#home-streak').textContent();
    expect(streakText && streakText.length > 0 && !streakText.includes('Ładowanie')).toBeTruthy();
  });

  test('displays best score and session count', async ({ page }) => {
    // Stats are populated async by renderHome()
    await expect(page.locator('#stat-best')).toBeVisible();
    await expect(page.locator('#stat-sess')).toBeVisible();
    // Best score is a number or em-dash when no sessions
    const bestText = await page.locator('#stat-best').textContent();
    expect(bestText && bestText.trim().length > 0).toBeTruthy();
    // Session count should be numeric (or initial "0")
    const sessText = await page.locator('#stat-sess').textContent();
    expect(sessText && /\d/.test(sessText)).toBeTruthy();
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
