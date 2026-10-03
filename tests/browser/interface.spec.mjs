import { test, expect } from '@playwright/test';
import { activateWithKeyboard, observePresentationKeys, selectSetting, startJourney } from './controls.mjs';

const snapshot = page => page.evaluate(() => window.taipeiRide.snapshot());
const pose = state => ({ x: state.player.x, y: state.player.y, angle: state.player.angle, distance: state.player.distance });
async function capture(page, testInfo, name) {
  await testInfo.attach(`${name}-state`, { body: JSON.stringify(await snapshot(page), null, 2), contentType: 'application/json' });
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test('new arrival uses the live scene, locks movement, completes and stays seen', async ({ page, isMobile }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TAIPEI_SAMPLE==='refined'?'/?sample=refined':'/');
  await page.waitForFunction(() => window.taipeiRide);
  if(process.env.TAIPEI_SAMPLE==='refined')await page.waitForFunction(()=>window.taipeiRide.snapshot().view.sample?.ready);
  const initial = await snapshot(page);
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  await activateWithKeyboard(page, '#start');
  await expect.poll(async () => (await snapshot(page)).cinematic).toBe(true);
  await page.keyboard.down('w');
  await page.waitForFunction(() => {
    const state = window.taipeiRide.snapshot();
    return state.menu.arrival.active && state.menu.arrival.stage === 'greeting';
  });
  const greeting = await snapshot(page);
  expect(greeting.renderMode).toBe('3d');
  expect(greeting.paused).toBe(true);
  expect(pose(greeting)).toEqual(pose(initial));
  expect(greeting.quest).toEqual(initial.quest);
  await capture(page, testInfo, 'arrival-01-greeting');
  // Let the unmodified 8.4-second presentation finish while forward remains
  // held. Its completion must clear input rather than start driving the actor.
  await expect.poll(async () => (await snapshot(page)).cinematic).toBe(false);
  await page.keyboard.up('w');
  const skipped = await snapshot(page);
  expect(skipped.menu.arrivalSeen).toBe(true);
  expect(skipped.paused).toBe(false);
  expect(pose(skipped)).toEqual(pose(initial));
  await expect(page.locator('#arrival-intro')).not.toBeVisible();
  await capture(page, testInfo, 'arrival-02-ready-to-play');
  await page.reload();
  await page.waitForFunction(() => window.taipeiRide);
  if(process.env.TAIPEI_SAMPLE==='refined')await page.waitForFunction(()=>window.taipeiRide.snapshot().view.sample?.ready);
  await startJourney(page, { isMobile });
  const resumed = await snapshot(page);
  expect(resumed.menu.arrival.active).toBe(false);
  expect(resumed.menu.arrivalSeen).toBe(true);
  expect(pose(resumed)).toEqual(pose(initial));
  expect(errors).toEqual([]);
});

test('fresh arrival accepts an immediate trusted keyboard skip', async ({ page }, testInfo) => {
  await observePresentationKeys(page);
  await page.goto(process.env.TAIPEI_SAMPLE==='refined'?'/?sample=refined':'/');
  await page.waitForFunction(() => window.taipeiRide);
  if(process.env.TAIPEI_SAMPLE==='refined')await page.waitForFunction(()=>window.taipeiRide.snapshot().view.sample?.ready);
  await expect.poll(async () => (await snapshot(page)).menu.phase).toBe('menu');
  const initial = await snapshot(page);
  await activateWithKeyboard(page, '#start');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await snapshot(page)).cinematic).toBe(false);
  const evidence = await page.evaluate(() => window.__presentationKeys);
  expect(evidence.some(event => event.code === 'Escape' && event.trusted && event.arrivalActive)).toBe(true);
  const after = await snapshot(page);
  expect(after.menu.arrivalSeen).toBe(true);
  expect(after.paused).toBe(false);
  expect(pose(after)).toEqual(pose(initial));
  expect(after.quest).toEqual(initial.quest);
  await testInfo.attach('trusted-arrival-skip-input', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});

test('pause dashboard, control tabs, HUD preferences and actual mouse look', async ({ page, isMobile }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // This case starts after the already-seen presentation; the separate test
  // above verifies the fresh arrival, including the actual input lock.
  await page.addInitScript(() => localStorage.setItem('taipei-ride:menu:v1', JSON.stringify({ reducedMotion: true, arrivalSeen: true })));
  await page.goto(process.env.TAIPEI_SAMPLE==='refined'?'/?sample=refined':'/');
  await page.waitForFunction(() => window.taipeiRide);
  if(process.env.TAIPEI_SAMPLE==='refined')await page.waitForFunction(()=>window.taipeiRide.snapshot().view.sample?.ready);
  await startJourney(page, { isMobile });
  const initial = await snapshot(page);
  async function settings() {
    await page.keyboard.press('p');
    await expect(page.locator('#pause-dialog')).toBeVisible();
    await page.locator('#pause-settings').click();
    await expect(page.locator('#settings-dialog')).toBeVisible();
  }
  async function resume() {
    await page.locator('#settings-dialog .front-back').click();
    await expect(page.locator('#pause-dialog')).toBeVisible();
    await page.locator('#resume').click();
    await expect.poll(async () => (await snapshot(page)).paused).toBe(false);
  }
  async function drag(dx, dy) {
    // The desktop centre-right canvas is outside HUD buttons and dialogs.
    const viewport = page.viewportSize(), x = viewport.width * .67, y = viewport.height * .43;
    const before = await snapshot(page);
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up();
    if (dx) await expect.poll(async () => {
      const view = (await snapshot(page)).view;
      return Math.hypot(...view.position.map((value, index) => value - before.view.position[index]));
    }).toBeGreaterThan(.1);
    const after = await snapshot(page);
    expect(pose(after)).toEqual(pose(before));
    return { yaw: after.view.yaw - before.view.yaw, pitch: after.view.pitch - before.view.pitch };
  }
  await settings();
  await page.locator('#setting-fps').check();
  await page.locator('#setting-hud').focus(); await page.keyboard.press('End');
  await page.locator('#setting-look').focus(); await page.keyboard.press('Home');
  await page.locator('#setting-hints').uncheck();
  await expect(page.locator('body')).toHaveClass(/hide-tutorial-hints/);
  await page.locator('#reset-hints').click();
  expect((await snapshot(page)).menu.hints).toBe(true);
  await selectSetting(page, 'setting-quality', 'ultra');
  expect((await snapshot(page)).view.quality).toBe('ultra');
  await capture(page, testInfo, 'interface-01-settings');
  await resume();
  await expect(page.locator('#fps-readout')).toBeVisible();
  await expect(page.locator('#fps-readout')).toHaveText(/FPS \d+/);
  const hud = await page.evaluate(() => ({
    scale: new DOMMatrixReadOnly(getComputedStyle(document.querySelector('main')).transform).a,
    configured: window.taipeiRide.snapshot().menu.hudScale,
    touchParent: document.querySelector('.touch-controls').parentElement.tagName,
    viewport: [innerWidth, innerHeight],
  }));
  expect(hud.configured).toBe(1.25);
  expect(hud.scale).toBe(isMobile && hud.viewport[0] > 701 && hud.viewport[1] <= 480 ? 1 : 1.25);
  expect(hud.touchParent).toBe('BODY');
  await testInfo.attach('effective-hud-scale', { body: JSON.stringify(hud), contentType: 'application/json' });
  if (!isMobile) {
    const low = await drag(30, 10);
    expect(Math.abs(low.yaw)).toBeGreaterThan(.01);
    await settings();
    await page.locator('#setting-look').focus(); await page.keyboard.press('End');
    await resume();
    const high = await drag(30, 10);
    expect(Math.abs(high.yaw)).toBeGreaterThan(Math.abs(low.yaw) * 3);
    await settings(); await page.locator('#setting-invert-y').check(); await resume();
    const inverted = await drag(0, 10);
    expect(high.pitch * inverted.pitch).toBeLessThan(0);
    await testInfo.attach('native-mouse-look', { body: JSON.stringify({ low, high, inverted }), contentType: 'application/json' });
    await capture(page, testInfo, 'interface-02-mouse-look');
  }
  await page.keyboard.press('p');
  await capture(page, testInfo, 'interface-03-pause-dashboard');
  await page.locator('#pause-controls').click();
  for (const index of [0, 1, 2]) {
    await page.locator(`#control-tab-${index}`).click();
    await expect(page.locator(`#control-tab-${index}`)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`#control-panel-${index}`)).toBeVisible();
    expect((await snapshot(page)).menu.controls.tab).toBe(index);
    await capture(page, testInfo, `interface-04-controls-${index}`);
  }
  await page.locator('#help-done').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#pause-stats').click();
  await expect(page.locator('#stats-dialog')).toBeVisible();
  await expect(page.locator('#stats-coins')).toHaveText('0');
  await page.locator('#stats-dialog .front-back').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#pause-map').click();
  await expect(page.locator('#map-dialog')).toBeVisible();
  await page.locator('#map-dialog [data-close]').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  expect(pose(await snapshot(page))).toEqual(pose(initial));
  const pad = await page.evaluate(() => ({ api: typeof navigator.getGamepads, state: window.taipeiRide.snapshot().gamepad }));
  expect(pad.api).toBe('function');
  await testInfo.attach('gamepad-capability', { body: JSON.stringify({ ...pad, limit: 'No physical controller is connected to CI; hardware interaction is not claimed.' }), contentType: 'application/json' });
  expect(errors).toEqual([]);
});
