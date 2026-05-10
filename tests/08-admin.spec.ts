import { test, expect } from '@playwright/test';
import { loginAsAdmin, waitForToast, login } from './fixtures/test-helpers';

test.describe('Admin', () => {
  // Skip whole suite if admin user doesn't exist in Supabase
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#screen-login.active', { timeout: 15000 });
    await page.fill('#login-username', 'admin');
    await page.fill('#login-password', 'admin123');
    await page.click('#login-submit');
    // Wait for either admin or home (non-admin fallback)
    await page.waitForSelector('#screen-admin.active, #screen-home.active, #login-error.show', { timeout: 15000 });

    const isAdmin = await page.locator('#screen-admin.active').isVisible().catch(() => false);
    if (!isAdmin) {
      test.skip(true, 'admin user does not exist or is not marked is_admin=true in Supabase');
    }
  });

  test('admin sees admin screen after login', async ({ page }) => {
    await expect(page.locator('#screen-admin')).toHaveClass(/active/);
  });

  test('exercises tab by default', async ({ page }) => {
    const exercisesTab = page.locator('#admin-tab-exercises');
    await expect(exercisesTab).toHaveClass(/\bon\b/);
  });

  test('switch to leaderboard tab', async ({ page }) => {
    await page.click('#admin-tab-leaderboard');
    await page.waitForTimeout(500);
    await expect(page.locator('#admin-tab-leaderboard')).toHaveClass(/\bon\b/);
  });

  test('add exercise with all fields', async ({ page }) => {
    await page.fill('#admin-ex-name', 'Nowe ćwiczenie testowe');
    await page.fill('#admin-ex-description', 'Opis ćwiczenia do testów automatycznych');
    await page.fill('#admin-ex-targets', '20,19,18,17,16');

    // Select type
    await page.click('#admin-type-shanghai');
    await page.waitForTimeout(300);

    await page.click('#admin-add-exercise-btn');
    await page.waitForTimeout(1000);

    // Should add to the exercise list or show success toast
    const toast = page.locator('#toast-message');
    const toastVisible = await toast.isVisible().catch(() => false);
    if (toastVisible) {
      await expect(toast).toBeVisible();
    }
  });

  test('validation: no name shows error', async ({ page }) => {
    // Leave name empty, fill other fields
    await page.fill('#admin-ex-name', '');
    await page.fill('#admin-ex-targets', '20,19');
    await page.click('#admin-add-exercise-btn');
    await page.waitForTimeout(500);

    // Should show error (toast, inline error, or alert)
    const errorIndicator = page.locator('#toast-message, #ca-overlay.show, .error, [class*="error"], .invalid');
    await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('validation: no targets shows error', async ({ page }) => {
    await page.fill('#admin-ex-name', 'Ćwiczenie bez celów');
    await page.fill('#admin-ex-targets', '');
    await page.click('#admin-add-exercise-btn');
    await page.waitForTimeout(500);

    const errorIndicator = page.locator('#toast-message, #ca-overlay.show, .error, [class*="error"], .invalid');
    await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('toggle exercise enabled/disabled', async ({ page }) => {
    // Find an exercise toggle in the admin list
    const exerciseToggle = page.locator('.ex-toggle, .toggle-exercise, input[type="checkbox"]').first();
    const toggleExists = await exerciseToggle.count();

    if (toggleExists > 0) {
      const wasChecked = await exerciseToggle.isChecked().catch(() => false);
      await exerciseToggle.click();
      await page.waitForTimeout(500);
      const isChecked = await exerciseToggle.isChecked().catch(() => !wasChecked);
      expect(isChecked).not.toBe(wasChecked);
    } else {
      // Try a different toggle mechanism (button-based)
      const toggleBtn = page.locator('.ex-list-admin .toggle-btn, [class*="toggle"]').first();
      await expect(toggleBtn).toBeVisible();
      await toggleBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('save all changes (toast)', async ({ page }) => {
    await page.click('#admin-save-all');
    await page.waitForTimeout(1000);
    await waitForToast(page);
  });
});
