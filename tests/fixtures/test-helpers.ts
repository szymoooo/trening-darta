import { Page, expect, TestInfo } from '@playwright/test';

// ═══════════════════════════════════════════════
//  SCREENSHOT HELPER
// ═══════════════════════════════════════════════
let stepCounter = 0;

/**
 * Takes a named screenshot and attaches it to the test report.
 * Use at key steps in tests for the gallery.
 */
export async function screenshot(page: Page, name: string, testInfo?: TestInfo) {
  stepCounter++;
  const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
  const fileName = `step-${String(stepCounter).padStart(2, '0')}-${safeName}.png`;

  const buffer = await page.screenshot({ fullPage: false });

  if (testInfo) {
    await testInfo.attach(safeName, { body: buffer, contentType: 'image/png' });
  }

  return buffer;
}

/** Reset step counter — call in beforeEach */
export function resetStepCounter() {
  stepCounter = 0;
}

// ═══════════════════════════════════════════════
//  AUTH HELPERS
// ═══════════════════════════════════════════════
export async function login(page: Page, username: string, password: string, testInfo?: TestInfo) {
  await page.goto('/');
  await page.waitForSelector('#screen-login.active', { timeout: 15000 });
  if (testInfo) await screenshot(page, 'login-form-visible', testInfo);

  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  if (testInfo) await screenshot(page, 'credentials-filled', testInfo);

  await page.click('#login-submit');
  await page.waitForSelector('#screen-home.active, #screen-admin.active', { timeout: 15000 });
  if (testInfo) await screenshot(page, 'logged-in', testInfo);
}

export async function logout(page: Page, testInfo?: TestInfo) {
  await page.click('#logout-btn');
  await page.waitForSelector('#screen-login.active', { timeout: 5000 });
  if (testInfo) await screenshot(page, 'logged-out', testInfo);
}

export async function loginAsAdmin(page: Page, testInfo?: TestInfo) {
  await login(page, 'admin', 'admin123', testInfo);
  await page.waitForSelector('#screen-admin.active', { timeout: 10000 });
  if (testInfo) await screenshot(page, 'admin-panel', testInfo);
}

// ═══════════════════════════════════════════════
//  TRAINING HELPERS
// ═══════════════════════════════════════════════
export async function startFirstExercise(page: Page, testInfo?: TestInfo) {
  await page.click('#nav-train-btn');
  await page.waitForSelector('#screen-training.active', { timeout: 10000 });
  if (testInfo) await screenshot(page, 'training-started', testInfo);
}

export async function clickThrow(page: Page, type: 'miss' | 'single' | 'double' | 'triple') {
  // Buttons are dynamically generated with onclick, use text content
  const labels = { miss: 'Pudło', single: 'Single', double: 'Double', triple: 'Treble' };
  await page.locator(`#dart-btns .dbtn:has-text("${labels[type]}")`).click();
}

export async function completeRound(page: Page, throws: Array<'miss' | 'single' | 'double' | 'triple'>, testInfo?: TestInfo) {
  for (const t of throws) {
    await clickThrow(page, t);
  }
  // Wait for auto-advance
  await page.waitForTimeout(500);
  if (testInfo) await screenshot(page, 'round-completed', testInfo);
}

// ═══════════════════════════════════════════════
//  MATCH HELPERS
// ═══════════════════════════════════════════════
export async function startMatch(page: Page, variant: 301 | 501 | 701 = 501, testInfo?: TestInfo) {
  await page.click('#nav-game-btn');
  await page.waitForSelector('#game-modal.show', { timeout: 5000 });
  if (testInfo) await screenshot(page, 'game-modal-open', testInfo);

  await page.locator('#game-modal .block-btn:has-text("Solo")').click();
  await page.waitForSelector('#screen-match.active', { timeout: 5000 });
  // Wait for match modal to appear
  await page.waitForSelector('#match-modal.show', { timeout: 5000 });
  if (testInfo) await screenshot(page, 'match-variant-select', testInfo);

  // Click the variant button
  await page.locator(`#match-modal .match-type-btn:has-text("${variant}")`).click();
  await page.waitForSelector('#match-modal:not(.show)', { timeout: 5000 });
  if (testInfo) await screenshot(page, 'match-started', testInfo);
}

export async function enterScore(page: Page, score: number, testInfo?: TestInfo) {
  const digits = score.toString();
  for (const d of digits) {
    await page.click(`#np-${d}`);
  }
  if (testInfo) await screenshot(page, `numpad-entered-${score}`, testInfo);
  await page.click('#np-ok');
  // Small delay for DB save
  await page.waitForTimeout(800);
  if (testInfo) await screenshot(page, `score-after-${score}`, testInfo);
}

export async function clearNumpad(page: Page) {
  // Click delete until display shows —
  for (let i = 0; i < 3; i++) {
    await page.click('#np-del');
  }
}

// ═══════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════
export async function waitForToast(page: Page, textContains?: string, timeout = 4000, testInfo?: TestInfo) {
  const toast = page.locator('#toast-message');
  await toast.waitFor({ state: 'visible', timeout });
  if (textContains) {
    await expect(toast).toContainText(textContains);
  }
  if (testInfo) await screenshot(page, 'toast-visible', testInfo);
  return toast;
}

export async function dismissAlert(page: Page) {
  await page.locator('#ca-overlay.show .ca-btn.primary').click();
  await page.waitForSelector('#ca-overlay:not(.show)', { timeout: 3000 });
}

export async function confirmDialog(page: Page) {
  // Click the second button (Tak / primary)
  await page.locator('#ca-overlay.show .ca-btn.primary').click();
  await page.waitForSelector('#ca-overlay:not(.show)', { timeout: 3000 });
}

export async function cancelDialog(page: Page) {
  await page.locator('#ca-overlay.show .ca-btn.outline').first().click();
  await page.waitForSelector('#ca-overlay:not(.show)', { timeout: 3000 });
}

export async function navigateTo(page: Page, tab: 'home' | 'history' | 'profile' | 'game', testInfo?: TestInfo) {
  const btnMap = { home: '#nav-home-btn', history: '#nav-history-btn', profile: '#nav-profile-btn', game: '#nav-game-btn' };
  await page.click(btnMap[tab]);
  if (testInfo) await screenshot(page, `navigated-to-${tab}`, testInfo);
}
