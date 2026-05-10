import { test, expect } from '@playwright/test';
import { login, waitForToast } from './fixtures/test-helpers';

test.describe('Profile', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await page.click('#nav-profile-btn');
    await page.waitForSelector('#screen-profile.active', { timeout: 10000 });
  });

  test('displays all profile fields', async ({ page }) => {
    await expect(page.locator('#profile-firstname')).toBeVisible();
    await expect(page.locator('#profile-age')).toBeVisible();
    await expect(page.locator('#profile-favplayer')).toBeVisible();
    await expect(page.locator('#profile-dartbrand')).toBeVisible();
    await expect(page.locator('#profile-dartweight')).toBeVisible();
    await expect(page.locator('#profile-save')).toBeVisible();
  });

  test('saves profile successfully (toast)', async ({ page }) => {
    await page.fill('#profile-firstname', 'Jan');
    await page.fill('#profile-age', '28');
    await page.fill('#profile-favplayer', 'Michael van Gerwen');
    await page.fill('#profile-dartbrand', 'Target');
    await page.fill('#profile-dartweight', '22');
    await page.click('#profile-save');

    await waitForToast(page);
  });

  test('switch to single throw mode', async ({ page }) => {
    await page.click('#profile-mode-single');
    // Button should have .on class immediately (client-side toggle)
    await expect(page.locator('#profile-mode-single')).toHaveClass(/on/);
    await expect(page.locator('#profile-mode-series')).not.toHaveClass(/on/);

    await page.click('#profile-save');
    await page.waitForTimeout(1000);

    // Still single after save
    await expect(page.locator('#profile-mode-single')).toHaveClass(/on/);
  });

  test('switch back to series mode', async ({ page }) => {
    // First set to single
    await page.click('#profile-mode-single');
    await expect(page.locator('#profile-mode-single')).toHaveClass(/on/);
    await page.click('#profile-save');
    await page.waitForTimeout(500);

    // Then switch back to series
    await page.click('#profile-mode-series');
    await expect(page.locator('#profile-mode-series')).toHaveClass(/on/);
    await expect(page.locator('#profile-mode-single')).not.toHaveClass(/on/);
    await page.click('#profile-save');
    await page.waitForTimeout(500);

    await expect(page.locator('#profile-mode-series')).toHaveClass(/on/);
  });

  test('avatar upload button visible', async ({ page }) => {
    await expect(page.locator('#profile-avatar-edit')).toBeVisible();
  });

  test('avatar upload rejects file > 5MB (mock)', async ({ page }) => {
    // Create a mock file input event with a large file
    const fileInput = page.locator('#profile-avatar-input');

    // Use page.evaluate to simulate a large file selection
    await page.evaluate(() => {
      const input = document.querySelector('#profile-avatar-input') as HTMLInputElement;
      if (!input) return;
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big-avatar.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(largeFile);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await page.waitForTimeout(1000);

    // Should show error toast or alert about file size
    const errorIndicator = page.locator('#toast-message, #ca-overlay.show, [class*="error"]');
    await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('doubles picker toggles on/off', async ({ page }) => {
    const picker = page.locator('#doubles-picker');
    const isVisibleBefore = await picker.isVisible().catch(() => false);

    // Find the toggle that controls the doubles picker
    const toggleBtn = page.locator('[data-toggle="doubles"], .doubles-toggle, label:has-text("Double")');
    const toggleExists = await toggleBtn.count();
    if (toggleExists > 0) {
      await toggleBtn.first().click();
      await page.waitForTimeout(300);
      const isVisibleAfter = await picker.isVisible().catch(() => false);
      expect(isVisibleAfter).not.toBe(isVisibleBefore);
    } else {
      // Directly test picker visibility
      await expect(picker).toBeVisible();
    }
  });

  test('statistics section displays', async ({ page }) => {
    const stats = page.locator('#profile-stats');
    await expect(stats).toBeVisible();
    // Wait for async renderProfile to populate stats (it does a DB fetch)
    await expect(stats).toContainText(/Pseudonim|Sesji|Najlepszy|Streak|Wynik|pkt|Błąd/i, { timeout: 10000 });
  });
});
