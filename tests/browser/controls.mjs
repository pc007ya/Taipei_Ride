import { expect } from '@playwright/test';

export async function observePresentationKeys(page) {
  // Read-only evidence is installed before the app's capturing handlers. It
  // never prevents input, invokes a game action, or changes presentation time.
  await page.addInitScript(() => {
    const evidence = [];
    Object.defineProperty(window, '__presentationKeys', { value: evidence });
    window.addEventListener('keydown', event => {
      if (!['Enter', 'Escape'].includes(event.code)) return;
      const state = window.taipeiRide?.snapshot();
      evidence.push({ code: event.code, trusted: event.isTrusted, timestamp: performance.now(), phase: state?.menu.phase, arrivalActive: Boolean(state?.menu.arrival.active) });
    }, true);
  });
}

export async function activateWithKeyboard(page, selector) {
  // All actionability/layout waiting happens before a short presentation starts.
  await page.locator(selector).scrollIntoViewIfNeeded();
  await expect(page.locator(selector)).toBeVisible();
  await page.locator(selector).focus();
  await page.keyboard.press('Enter');
}

export async function clickCurrentTarget(page, selector, isMobile = false) {
  const bounds = await page.locator(selector).boundingBox();
  expect(bounds, `${selector} must be visible before native input`).not.toBeNull();
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

export async function selectSetting(page, id, value) {
  const radio = page.locator(`#${id} input[value="${value}"]`);
  await page.locator(`#${id} label:has(input[value="${value}"])`).click();
  await expect(radio).toBeChecked();
}

export async function startJourney(page, { isMobile = false } = {}) {
  await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => window.taipeiRide.snapshot().started)).toBe(true);
  if (await page.evaluate(() => Boolean(window.taipeiRide.snapshot().cinematic))) {
    await clickCurrentTarget(page, '#skip-arrival', isMobile);
  }
  await expect.poll(() => page.evaluate(() => {
    const state = window.taipeiRide.snapshot();
    return state.started && !state.paused && !state.cinematic;
  })).toBe(true);
}
