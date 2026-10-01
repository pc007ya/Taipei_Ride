import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.taipeiRide.snapshot());

async function capture(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function assertLiveWebGL(page, testInfo) {
  await expect(page.locator('#render-mode')).toHaveText('3D 漫遊');
  await expect.poll(async () => (await snapshot(page)).renderMode).toBe('3d');
  const evidence = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const canvas = document.querySelector('#world');
    const gl = canvas.getContext('webgl2');
    if (!gl) return resolve({ webgl2: false });
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const colors = new Set(), pixel = new Uint8Array(4);
    // Sample the live framebuffer during the render frame, before the browser
    // discards a non-preserved drawing buffer. No drawing APIs are replaced.
    for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) {
      gl.readPixels(Math.floor(gl.drawingBufferWidth*x/12), Math.floor(gl.drawingBufferHeight*y/10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      colors.add([...pixel].join(','));
    }
    resolve({ webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, uniqueColors: colors.size, error: gl.getError(), renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), version: gl.getParameter(gl.VERSION) });
  })));
  await testInfo.attach('webgl-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
  expect(evidence.webgl2).toBe(true);
  expect(evidence.contextLost).toBe(false);
  expect(evidence.width).toBeGreaterThan(0);
  expect(evidence.height).toBeGreaterThan(0);
  expect(evidence.uniqueColors).toBeGreaterThan(10);
  expect(evidence.error).toBe(0);
}

test('real WebGL game: drive, stamp, map, pause, save, reset and touch layout', async ({ page, isMobile }, testInfo) => {
  const errors = [], failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`));
  await page.goto('/');
  await page.waitForFunction(() => window.taipeiRide);
  await assertLiveWebGL(page, testInfo);
  await capture(page, testInfo, '01-welcome-webgl');
  await page.locator('#start').click();
  await expect.poll(async () => (await snapshot(page)).started).toBe(true);
  await page.locator('#stamp-rail button').first().click();
  await capture(page, testInfo, '02-playing-day');

  // Keyboard input traverses the real animation loop to the first landmark.
  await page.keyboard.down('w');
  await page.waitForFunction(() => window.taipeiRide.snapshot().player.y < 447);
  await page.keyboard.up('w');
  await page.keyboard.down('Space');
  await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(1);
  await page.keyboard.up('Space');
  await page.keyboard.press('e');
  await expect(page.locator('#stamp-dialog')).toBeVisible();
  await expect.poll(async () => (await snapshot(page)).stamps).toContain('market');
  await capture(page, testInfo, '03-stamp');
  await page.locator('#next-stop').click();

  await page.keyboard.press('m');
  await expect(page.locator('#map-dialog')).toBeVisible();
  if (isMobile && page.viewportSize().width > page.viewportSize().height) {
    const map = await page.locator('#large-map').boundingBox();
    const dialog = await page.locator('#map-dialog').boundingBox();
    expect(map.y).toBeGreaterThanOrEqual(dialog.y);
    expect(map.y + map.height).toBeLessThanOrEqual(dialog.y + dialog.height);
    expect(map.y + map.height).toBeLessThanOrEqual(page.viewportSize().height);
  }
  await capture(page, testInfo, '04-map');
  await page.locator('#map-destinations button').nth(4).click();
  await expect.poll(async () => (await snapshot(page)).target).toBe('temple');
  await expect(page.locator('#map-dialog')).not.toBeVisible();

  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).player.speed).toBeGreaterThan(3);
  await page.keyboard.press('p');
  await page.keyboard.up('w');
  await expect(page.locator('#pause-dialog')).toBeVisible();
  const paused = (await snapshot(page)).player;
  await page.waitForTimeout(500);
  expect((await snapshot(page)).player).toEqual(paused);
  await page.locator('#resume').click();
  await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(1);

  await page.keyboard.press('n');
  await expect(page.locator('body')).toHaveClass(/night/);
  await capture(page, testInfo, '05-playing-night');
  await assertLiveWebGL(page, testInfo);
  await page.reload();
  await page.waitForFunction(() => window.taipeiRide);
  expect((await snapshot(page)).stamps).toContain('market');
  expect((await snapshot(page)).night).toBe(true);
  await page.locator('#start').click();

  const parked = (await snapshot(page)).vehicle;
  await page.keyboard.press('f');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('walking');
  expect((await snapshot(page)).vehicle).toEqual(parked);
  await capture(page, testInfo, '06-walking-night');
  await page.keyboard.press('f');
  await expect.poll(async () => (await snapshot(page)).mode).toBe('riding');
  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).player.speed).toBeGreaterThan(10);
  await page.keyboard.press('f');
  expect((await snapshot(page)).mode).toBe('riding');
  await page.keyboard.up('w');
  await page.keyboard.down('Space');
  await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(1);
  await page.keyboard.up('Space');

  if (isMobile) {
    const controls = page.locator('.touch-controls');
    await expect(controls).toBeVisible();
    const throttle = page.locator('[data-control="throttle"]');
    const button = await throttle.boundingBox();
    const viewport = page.viewportSize();
    expect(button.y).toBeGreaterThanOrEqual(0);
    expect(button.y + button.height).toBeLessThanOrEqual(viewport.height + 1);
    // Chromium's native touch injection exercises simultaneous touch and cancel,
    // without JS dispatchEvent, replaced handlers, or game-state mutation.
    const right = await page.locator('[data-control="right"]').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    const initialAngle = (await snapshot(page)).player.angle;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
      { id: 1, x: button.x + button.width/2, y: button.y + button.height/2 },
      { id: 2, x: right.x + right.width/2, y: right.y + right.height/2 },
    ] });
    await expect.poll(async () => (await snapshot(page)).player.speed).toBeGreaterThan(3);
    await expect.poll(async () => (await snapshot(page)).player.angle-initialAngle).toBeGreaterThan(.02);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    await cdp.detach();
    await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(1);
    await expect(throttle).not.toHaveClass(/pressed/);
    const speed = await page.locator('.speed-panel').boundingBox();
    const minimap = await page.locator('#minimap-button').boundingBox();
    const touch = await controls.boundingBox();
    expect(speed.y + speed.height).toBeLessThanOrEqual(touch.y + 1);
    expect(minimap.y + minimap.height).toBeLessThanOrEqual(touch.y + 1);
    await capture(page, testInfo, '06-touch-layout');
  }

  await page.keyboard.press('p');
  await page.locator('#reset-trip').click();
  await expect(page.locator('#reset-dialog')).toBeVisible();
  await page.locator('#cancel-reset').click();
  expect((await snapshot(page)).stamps).toContain('market');
  await page.locator('#reset-trip').click();
  await page.locator('#confirm-reset').click();
  await expect.poll(async () => (await snapshot(page)).stamps).toEqual([]);
  await expect.poll(async () => (await snapshot(page)).player.distance).toBe(0);
  await page.keyboard.press('r');
  expect((await snapshot(page)).player.x).toBe(800);
  expect((await snapshot(page)).player.y).toBe(515);
  await capture(page, testInfo, '07-reset');
  await assertLiveWebGL(page, testInfo);
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
