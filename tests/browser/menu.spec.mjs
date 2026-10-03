import { test, expect } from '@playwright/test';
import { activateWithKeyboard, observePresentationKeys, selectSetting, startJourney } from './controls.mjs';

const snapshot = page => page.evaluate(() => window.taipeiRide.snapshot());
const position = state => ({ x: state.player.x, y: state.player.y, angle: state.player.angle });

function captureFor(page, testInfo) {
  return async name => {
    await testInfo.attach(`${name}-state`, { body: JSON.stringify(await snapshot(page), null, 2), contentType: 'application/json' });
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: 'image/png' });
  };
}
function recordErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
}
async function enterMenu(page) {
  await page.goto(process.env.TAIPEI_SAMPLE==='refined'?'/?sample=refined':'/');
  await page.waitForFunction(() => window.taipeiRide?.snapshot().menu);
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  expect((await snapshot(page)).renderMode).toBe('3d');
}

// Keep the same coverage in independently budgeted flows. The previous single
// desktop case exhausted its 240-second software-GPU budget while still making
// progress; no assertion, input path, or production timing is relaxed here.
test('menu preferences: help, characters, audio, quality and saved settings', async ({ page }, testInfo) => {
  const errors = recordErrors(page), capture = captureFor(page, testInfo);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterMenu(page);
  expect((await snapshot(page)).menu.reducedMotion).toBe(true);
  const initial = await snapshot(page);
  for (const id of ['start', 'menu-character', 'menu-settings', 'menu-controls', 'menu-about']) {
    const control = page.locator(`#${id}`);
    await expect(control).toBeVisible();
    const bounds = await control.boundingBox(), viewport = page.viewportSize();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  await capture('menu-01-main');
  await page.locator('#menu-controls').click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await page.locator('#help-done').click();
  await expect(page.locator('#help-dialog')).not.toBeVisible();
  expect((await snapshot(page)).menu.phase).toBe('menu');
  expect((await snapshot(page)).started).toBe(false);

  await page.locator('#menu-character').click();
  await expect(page.locator('#character-dialog')).toBeVisible();
  await page.locator('[data-appearance="river"]').click();
  await expect(page.locator('[data-appearance="river"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await snapshot(page)).menu.appearance).toBe('river');
  await capture('menu-02-character');
  await page.keyboard.press('Escape');
  await expect(page.locator('#character-dialog')).not.toBeVisible();
  expect(position(await snapshot(page))).toEqual(position(initial));

  await page.locator('#menu-language').click();
  await expect.poll(async () => (await snapshot(page)).menu.language).toBe('en');
  await page.locator('#menu-settings').click();
  await expect(page.locator('#setting-language input[value="en"]')).toBeChecked();
  await page.locator('#setting-effects').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.locator('#setting-music').focus();
  await page.keyboard.press('End');
  await page.locator('#setting-master').focus();
  await page.keyboard.press('Home');
  await expect.poll(async () => (await snapshot(page)).menu.audio).toMatchObject({ master: 0, music: 1, effects: .01, available: true, activated: true, running: true });
  await selectSetting(page, 'setting-quality', 'low');
  await expect.poll(async () => (await snapshot(page)).effectiveRenderScale).toBeLessThanOrEqual(.75);
  const low = await page.evaluate(() => {
    const gl = document.querySelector('#world').getContext('webgl2');
    return { ...window.taipeiRide.snapshot(), actualBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight], css: [innerWidth, innerHeight] };
  });
  expect(low.menu.quality).toBe('low');
  expect(low.renderMode).toBe('3d');
  expect(low.actualBuffer).toEqual([low.drawingBufferWidth, low.drawingBufferHeight]);
  expect(low.css).toEqual([low.renderCssWidth, low.renderCssHeight]);
  await testInfo.attach('menu-low-quality-evidence', { body: JSON.stringify(low, null, 2), contentType: 'application/json' });
  await selectSetting(page, 'setting-quality', 'high');
  await expect.poll(async () => (await snapshot(page)).menu.quality).toBe('high');
  await selectSetting(page, 'setting-quality', 'medium');
  await expect.poll(async () => (await snapshot(page)).menu.quality).toBe('medium');
  expect((await snapshot(page)).effectiveRenderScale).toBeLessThanOrEqual(1.2);
  await page.locator('#setting-night').check();
  await expect.poll(async () => (await snapshot(page)).night).toBe(true);
  await selectSetting(page, 'setting-language', 'zh');
  await page.locator('#setting-motion').uncheck();
  expect((await snapshot(page)).menu.reducedMotion).toBe(false);
  await page.locator('#setting-motion').check();
  await capture('menu-03-settings');
  await page.locator('#settings-dialog .front-back').click();
  await page.locator('#menu-about').click();
  await expect(page.locator('#about-dialog')).toBeVisible();
  await page.locator('#about-dialog .front-back').click();
  await expect(page.locator('#about-dialog')).not.toBeVisible();
  expect((await snapshot(page)).started).toBe(false);
  await page.reload();
  await page.waitForFunction(() => window.taipeiRide?.snapshot().menu);
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  const restored = await snapshot(page);
  expect(restored.menu).toMatchObject({ reducedMotion: true, language: 'zh', appearance: 'river', quality: 'medium' });
  expect(restored.menu.audio).toMatchObject({ master: 0, music: 1, effects: .01 });
  expect(restored.night).toBe(true);
  expect(position(restored)).toEqual(position(initial));
  expect(errors).toEqual([]);
});

test('title intro naturally finishes and accepts trusted keyboard skip', async ({ page }, testInfo) => {
  const errors = recordErrors(page), capture = captureFor(page, testInfo);
  await observePresentationKeys(page);
  await enterMenu(page);
  const initial = await snapshot(page);
  await page.locator('#menu-settings').click();
  await activateWithKeyboard(page, '#replay-intro');
  await expect(page.locator('#skip-intro')).toBeVisible();
  await capture('menu-04-intro-transition');
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  await page.locator('#menu-settings').click();
  // Replay/skip is separate from the natural-playback screenshot above. Send
  // the two documented native keys back-to-back, without GPU frame waits.
  await activateWithKeyboard(page, '#replay-intro');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  const skipEvidence = await page.evaluate(() => window.__presentationKeys);
  expect(skipEvidence.some(event => event.code === 'Escape' && event.trusted && event.phase === 'intro')).toBe(true);
  await testInfo.attach('trusted-title-skip-input', { body: JSON.stringify(skipEvidence, null, 2), contentType: 'application/json' });
  expect((await snapshot(page)).started).toBe(false);
  expect(position(await snapshot(page))).toEqual(position(initial));

  expect(errors).toEqual([]);
});

test('returning to the title preserves a moving journey and preferences', async ({ page, isMobile }, testInfo) => {
  const errors = recordErrors(page), capture = captureFor(page, testInfo);
  // A normal preference fixture isolates return/resume from the settings-edit
  // flow above. Do not overwrite preferences on reload: their persistence is
  // one of this test's acceptance conditions.
  await page.addInitScript(() => {
    if (localStorage.getItem('taipei-ride:menu:v1') === null) localStorage.setItem('taipei-ride:menu:v1', JSON.stringify({ reducedMotion: false, language: 'zh', appearance: 'river', quality: 'medium', arrivalSeen: true, audio: { master: 0, music: 1, effects: .01 } }));
  });
  await enterMenu(page);
  await startJourney(page, { isMobile });
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('playing');
  await page.keyboard.press('n');
  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).player.distance).toBeGreaterThan(1);
  await page.keyboard.up('w');
  await page.keyboard.press('p');
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#pause-settings').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await page.locator('#setting-motion').check();
  await page.locator('#settings-dialog .front-back').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  const paused = await snapshot(page);
  await page.locator('#return-menu').click();
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  const returned = await snapshot(page);
  expect(position(returned)).toEqual(position(paused));
  for (const key of ['quest', 'coins', 'stamps', 'mode']) expect(returned[key]).toEqual(paused[key]);
  for (const key of ['x', 'y', 'angle']) expect(returned.vehicle[key]).toBe(paused.vehicle[key]);
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  expect(position(await snapshot(page))).toEqual(position(returned));
  await capture('menu-05-return-preserves-journey');
  await page.reload();
  await page.waitForFunction(() => window.taipeiRide?.snapshot().menu);
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  expect((await snapshot(page)).menu.reducedMotion).toBe(true);
  expect((await snapshot(page)).menu.language).toBe('zh');
  expect((await snapshot(page)).menu.appearance).toBe('river');
  expect((await snapshot(page)).menu.quality).toBe('medium');
  expect((await snapshot(page)).menu.audio).toMatchObject({ master: 0, music: 1, effects: .01 });
  expect((await snapshot(page)).night).toBe(true);
  expect(position(await snapshot(page))).toEqual(position(returned));
  await startJourney(page, { isMobile });
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('playing');
  expect((await snapshot(page)).renderMode).toBe('3d');
  expect(errors).toEqual([]);
});
