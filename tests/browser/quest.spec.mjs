import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.taipeiRide.snapshot());

async function stop(page) {
  for (const key of ['w', 'a', 'd']) await page.keyboard.up(key);
  await page.keyboard.down('Space');
  await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(.3);
  await page.keyboard.up('Space');
}

// A feedback driver uses only normal keyboard controls and read-only snapshots.
// No teleport, changed clock, injected input handler, or mutable debug API.
async function followRoad(page, waypoints, telemetry) {
  const held = new Set();
  async function hold(key, enabled) {
    if (enabled === held.has(key)) return;
    await page.keyboard[enabled ? 'down' : 'up'](key);
    if (enabled) held.add(key); else held.delete(key);
  }
  const deadline = Date.now() + 600_000;
  try {
    for (const [x, y] of waypoints) {
      while (true) {
        const { player, mode, quest } = await snapshot(page);
        const remaining = Math.hypot(x-player.x, y-player.y);
        if (remaining < 10) break;
        if (Date.now() > deadline) throw new Error(`Road traversal timed out near ${player.x.toFixed(1)},${player.y.toFixed(1)}, heading ${player.angle.toFixed(2)}; goal ${x},${y}`);
        const desired = Math.atan2(y-player.y, x-player.x);
        const error = Math.atan2(Math.sin(desired-player.angle), Math.cos(desired-player.angle));
        const speedLimit = Math.abs(error) > .18 || remaining < 55 ? 12 : 55;
        const braking = player.speed > speedLimit + 2;
        await hold('a', error < -.035);
        await hold('d', error > .035);
        await hold('Space', braking);
        await hold('w', !braking);
        if (telemetry.length === 0 || Date.now()-telemetry.at(-1).time > 1500) telemetry.push({ time: Date.now(), x: player.x, y: player.y, angle: player.angle, speed: player.speed, goal: [x,y], mode, stage: quest.stage });
        await page.waitForTimeout(80);
      }
    }
  } finally { for (const key of held) await page.keyboard.up(key); }
  await stop(page);
}

test('complete original delivery quest through live WebGL and real controls', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Long continuous driving route runs once; all layouts run the general live browser smoke test.');
  test.setTimeout(1_200_000);
  const errors = [], telemetry = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  async function capture(name) {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: 'image/png' });
  }
  try {
    // The separate desktop smoke test retains 1440×960. A conventional 720p
    // desktop viewport reduces software-GPU fill cost for this long real route.
    await page.setViewportSize({ width: 1280, height: 720 });
    await testInfo.attach('execution-viewport', { body: JSON.stringify({ width: 1280, height: 720, graphics: 'real WebGL 2 via Chromium SwiftShader', input: 'normal keyboard', clock: 'unmodified' }), contentType: 'application/json' });
    await page.goto('/');
    await page.waitForFunction(() => window.taipeiRide);
    await expect(page.locator('#render-mode')).toHaveText('3D 漫遊');
    await page.locator('#start').click();
    expect((await snapshot(page)).quest.stage).toBe('available');
    await followRoad(page, [[800, 420]], telemetry);
    await page.keyboard.press('e');
    await expect.poll(async () => (await snapshot(page)).quest.stage).toBe('pickup');
    await capture('quest-01-accepted');

    // Reverse direction at low speed, then follow the actual road grid.
    await followRoad(page, [[800,480], [1120,480], [1120,680]], telemetry);
    await page.keyboard.press('e');
    await expect.poll(async () => (await snapshot(page)).quest.stage).toBe('carrying');
    await capture('quest-02-picked-up');
    await page.keyboard.press('p');
    const beforeReload = await snapshot(page);
    await page.reload();
    await page.waitForFunction(() => window.taipeiRide);
    const restored = await snapshot(page);
    expect(restored.quest).toEqual(beforeReload.quest);
    expect(restored.mode).toBe(beforeReload.mode);
    expect(restored.vehicle.x).toBeCloseTo(beforeReload.vehicle.x, 4);
    expect(restored.vehicle.y).toBeCloseTo(beforeReload.vehicle.y, 4);
    await page.locator('#start').click();

    await followRoad(page, [[1120,800], [800,800], [480,800], [160,800], [160,1010]], telemetry);
    await expect.poll(async () => (await snapshot(page)).quest.stage).toBe('deliver');
    expect((await snapshot(page)).quest.rideDistance).toBe(100);
    await page.keyboard.press('e');
    expect((await snapshot(page)).quest.stage).toBe('deliver');
    expect((await snapshot(page)).coins).toBe(0);
    await page.keyboard.press('f');
    await expect.poll(async () => (await snapshot(page)).mode).toBe('walking');
    await capture('quest-03-on-foot-delivery');
    await page.keyboard.press('e');
    await expect.poll(async () => (await snapshot(page)).quest.stage).toBe('completed');
    expect((await snapshot(page)).coins).toBe(300);
    await page.keyboard.press('e');
    expect((await snapshot(page)).coins).toBe(300);
    await capture('quest-04-completed');
    await page.reload();
    await page.waitForFunction(() => window.taipeiRide);
    expect((await snapshot(page)).quest.stage).toBe('completed');
    expect((await snapshot(page)).coins).toBe(300);
    expect((await snapshot(page)).mode).toBe('walking');
    await page.locator('#start').click();
    await page.keyboard.press('p');
    await page.locator('#reset-trip').click();
    await page.locator('#confirm-reset').click();
    expect((await snapshot(page)).quest.stage).toBe('available');
    expect((await snapshot(page)).coins).toBe(0);
    expect((await snapshot(page)).mode).toBe('riding');
    expect((await snapshot(page)).renderMode).toBe('3d');
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach('continuous-route', { body: JSON.stringify(telemetry, null, 2), contentType: 'application/json' });
    await capture('quest-last-frame').catch(() => {});
  }
});
