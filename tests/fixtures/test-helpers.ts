import { Page, expect } from '@playwright/test';

// ═══════════════════════════════════════════════
//  AUTH HELPERS
// ═══════════════════════════════════════════════
export async function login(page: Page, username: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('#screen-login.active', { timeout: 15000 });
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await page.click('#login-submit');
  await page.waitForSelector('#screen-home.active, #screen-admin.active', { timeout: 15000 });
}

export async function logout(page: Page) {
  await page.click('#logout-btn');
  await page.waitForSelector('#screen-login.active', { timeout: 5000 });
}

export async function loginAsAdmin(page: Page) {
  await login(page, 'admin', 'admin123');
  await page.waitForSelector('#screen-admin.active', { timeout: 10000 });
}

// ═══════════════════════════════════════════════
//  TRAINING HELPERS
// ═══════════════════════════════════════════════
export async function startFirstExercise(page: Page) {
  await page.click('#nav-train-btn');
  await page.waitForSelector('#screen-training.active', { timeout: 10000 });
}

export async function clickThrow(page: Page, type: 'miss' | 'single' | 'double' | 'triple') {
  // Buttons are dynamically generated with onclick, use text content
  const labels = { miss: 'Pudło', single: 'Single', double: 'Double', triple: 'Treble' };
  await page.locator(`#dart-btns .dbtn:has-text("${labels[type]}")`).click();
}

export async function completeRound(page: Page, throws: Array<'miss' | 'single' | 'double' | 'triple'>) {
  for (const t of throws) {
    await clickThrow(page, t);
  }
  // Wait for auto-advance
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════
//  MATCH HELPERS
// ═══════════════════════════════════════════════
export async function startMatch(page: Page, variant: 301 | 501 | 701 = 501) {
  await page.click('#nav-game-btn');
  await page.waitForSelector('#game-modal.show', { timeout: 5000 });
  await page.locator('#game-modal .block-btn:has-text("Solo")').click();
  await page.waitForSelector('#screen-match.active', { timeout: 5000 });
  // Wait for match modal to appear
  await page.waitForSelector('#match-modal.show', { timeout: 5000 });
  // Click the variant button
  await page.locator(`#match-modal .match-type-btn:has-text("${variant}")`).click();
  await page.waitForSelector('#match-modal:not(.show)', { timeout: 5000 });
}

export async function enterScore(page: Page, score: number) {
  const digits = score.toString();
  for (const d of digits) {
    await page.click(`#np-${d}`);
  }
  await page.click('#np-ok');
  // Small delay for DB save
  await page.waitForTimeout(800);
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
export async function waitForToast(page: Page, textContains?: string, timeout = 4000) {
  const toast = page.locator('#toast-message');
  await toast.waitFor({ state: 'visible', timeout });
  if (textContains) {
    await expect(toast).toContainText(textContains);
  }
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

export async function navigateTo(page: Page, tab: 'home' | 'history' | 'profile' | 'game') {
  const btnMap = { home: '#nav-home-btn', history: '#nav-history-btn', profile: '#nav-profile-btn', game: '#nav-game-btn' };
  await page.click(btnMap[tab]);
}
