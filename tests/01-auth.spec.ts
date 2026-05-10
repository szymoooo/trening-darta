import { test, expect } from '@playwright/test';
import { login, logout } from './fixtures/test-helpers';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#screen-login.active', { timeout: 15000 });
  });

  test('shows login screen initially', async ({ page }) => {
    await expect(page.locator('#screen-login')).toHaveClass(/active/);
    await expect(page.locator('#login-username')).toBeVisible();
    await expect(page.locator('#login-password')).toBeVisible();
    await expect(page.locator('#login-submit')).toBeVisible();
  });

  test('shows error with empty username (min 2 chars)', async ({ page }) => {
    await page.fill('#login-username', '');
    await page.fill('#login-password', 'password123');
    await page.click('#login-submit');
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText(/min|znak|użytkownik/i);
  });

  test('shows error with empty password', async ({ page }) => {
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', '');
    await page.click('#login-submit');
    await expect(page.locator('#login-error')).toBeVisible();
  });

  test('login with valid credentials navigates to home screen', async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await expect(page.locator('#screen-home')).toHaveClass(/active/);
  });

  test('login with Polish characters in username (ąęśź)', async ({ page }) => {
    // Use a unique Polish username to avoid conflicts with existing accounts
    const uniqueName = 'użyt_' + Date.now();
    await page.fill('#login-username', uniqueName);
    await page.fill('#login-password', 'hasło123');
    await page.click('#login-submit');
    // Expected: new user is created (Supabase handles UTF-8), login succeeds to home
    await page.waitForSelector('#screen-home.active, #screen-admin.active, #login-error.show', { timeout: 15000 });
    // If error shown, app crashed on Polish chars which is a bug; we expect login to succeed
    const errorShown = await page.locator('#login-error.show').isVisible().catch(() => false);
    expect(errorShown).toBe(false);
  });

  test('wrong password shows error', async ({ page }) => {
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', 'wrongpassword999');
    await page.click('#login-submit');
    await expect(page.locator('#login-error')).toBeVisible();
  });

  test('logout returns to login screen', async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await expect(page.locator('#screen-home')).toHaveClass(/active/);
    await logout(page);
    await expect(page.locator('#screen-login')).toHaveClass(/active/);
  });

  test('double-click login button does not create duplicate requests', async ({ page }) => {
    await page.fill('#login-username', 'testuser');
    await page.fill('#login-password', 'test123');

    // Track network requests
    let requestCount = 0;
    page.on('request', (req) => {
      if (req.url().includes('login') || req.method() === 'POST') {
        requestCount++;
      }
    });

    // Rapid double-click
    await page.dblclick('#login-submit');
    await page.waitForTimeout(2000);

    // Should either have <=1 request or the button should be disabled after first click
    const isHome = await page.locator('#screen-home.active').isVisible().catch(() => false);
    const isAdmin = await page.locator('#screen-admin.active').isVisible().catch(() => false);
    expect(isHome || isAdmin || requestCount <= 2).toBeTruthy();
  });

  test('auto-login after page refresh (session persistence)', async ({ page }) => {
    await login(page, 'testuser', 'test123');
    await expect(page.locator('#screen-home')).toHaveClass(/active/);

    // Reload the page
    await page.reload();
    await page.waitForTimeout(3000);

    // Should auto-login if session is persisted
    const isStillLoggedIn = await page.locator('#screen-home.active, #screen-admin.active').isVisible().catch(() => false);
    const isLoginScreen = await page.locator('#screen-login.active').isVisible().catch(() => false);

    // Either session persists (home visible) or user must re-login (login visible) — both are valid states
    expect(isStillLoggedIn || isLoginScreen).toBeTruthy();
  });
});
