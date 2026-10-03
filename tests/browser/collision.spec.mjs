import { test, expect } from '@playwright/test';
import { startJourney } from './controls.mjs';
import { createWorld, START, PERSON, SCOOTER, makeTraffic, poseCollides } from '../../src/world.js';
import { collisionBody, obstacleBody, bodiesOverlap } from '../../src/physics.js';
import { createSession, serializeSession, SAVE_KEY } from '../../src/session.js';

const snapshot = page => page.evaluate(() => window.taipeiRide.snapshot());

async function captureContact(page, testInfo, name) {
  const pixels = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const gl = document.querySelector('#world').getContext('webgl2'), pixel = new Uint8Array(4), colors = new Set();
    if (!gl) return resolve({ webgl2: false });
    for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) {
      gl.readPixels(Math.floor(gl.drawingBufferWidth * x / 12), Math.floor(gl.drawingBufferHeight * y / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      colors.add([...pixel].join(','));
    }
    resolve({ webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), error: gl.getError(), colors: colors.size, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight });
  })));
  expect(pixels.webgl2).toBe(true);
  expect(pixels.contextLost).toBe(false);
  expect(pixels.error).toBe(0);
  expect(pixels.colors).toBeGreaterThan(10);
  await testInfo.attach(`${name}-pixels`, { body: JSON.stringify(pixels), contentType: 'application/json' });
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function loadFixture(page, save) {
  await page.addInitScript(({ save, key }) => {
    localStorage.setItem(key, JSON.stringify(save));
    localStorage.setItem('taipei-ride:menu:v1', JSON.stringify({ reducedMotion: true, language: 'zh' }));
  }, { save, key: SAVE_KEY });
  await page.goto(process.env.TAIPEI_SAMPLE==='refined'?'/?sample=refined':'/');
  await page.waitForFunction(() => window.taipeiRide);
  if(process.env.TAIPEI_SAMPLE==='refined')await page.waitForFunction(()=>window.taipeiRide.snapshot().view.sample?.ready);
  await startJourney(page);
  expect((await snapshot(page)).renderMode).toBe('3d');
}

function buildingFixture(mode) {
  const world = createWorld(), extent = mode === 'walking' ? PERSON.radius : SCOOTER.length / 2;
  for (const building of world.buildings.filter(item => item.type === 'building')) {
    const obstacle = world.obstacles.find(item => item.type === 'building' && item.x === building.x && item.y === building.y);
    const others = { ...world, obstacles: world.obstacles.filter(item => item !== obstacle) };
    for (const fraction of [.5, .25, .75]) {
      const start = { x: building.x + building.w * fraction, y: building.y + building.d + extent + 7, angle: -Math.PI / 2 };
      const contactY = building.y + building.d + extent;
      if (poseCollides(start, mode, world) || poseCollides({ ...start, y: contactY }, mode, others)) continue;
      const state = createSession(world);
      state.mode = mode;
      Object.assign(state.player, start);
      Object.assign(state.vehicle, mode === 'riding' ? start : START);
      return { save: serializeSession(state), start, obstacle, contactY };
    }
  }
  throw new Error(`No clear production building contact fixture for ${mode}`);
}

for (const mode of ['riding', 'walking']) test(`live ${mode} building contact stops translation and permits reversing`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Targeted collision fixtures run once; all layouts run continuous normal controls in the smoke test.');
  const fixture = buildingFixture(mode), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // A valid user-save fixture establishes the starting pose through the normal
  // loader. All movement/contact below uses real controls; the continuous quest
  // test has no save injection or teleportation at all.
  await loadFixture(page, fixture.save);
  let state = await snapshot(page);
  expect(state.renderMode).toBe('3d');
  expect(state.mode).toBe(mode);
  expect(state.player.x).toBeCloseTo(fixture.start.x, 6);
  expect(state.player.y).toBeCloseTo(fixture.start.y, 6);
  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeLessThan(fixture.start.y - 1);
  await expect.poll(async () => Math.abs((await snapshot(page)).player.y - fixture.contactY)).toBeLessThan(.06);
  await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(.1);
  const contact = await snapshot(page);
  expect(contact.physics.buildingHit).toBe(true);
  expect(bodiesOverlap(collisionBody(contact.player, mode), obstacleBody(fixture.obstacle))).toBe(false);
  await page.waitForTimeout(800);
  const heldAgainstWall = await snapshot(page);
  expect(Math.hypot(heldAgainstWall.player.x - contact.player.x, heldAgainstWall.player.y - contact.player.y)).toBeLessThan(.01);
  expect(heldAgainstWall.player.distance - contact.player.distance).toBeLessThan(.01);
  await page.keyboard.up('w');
  await captureContact(page, testInfo, `${mode}-building-stopped`);
  await page.keyboard.down('s');
  await expect.poll(async () => (await snapshot(page)).player.y).toBeGreaterThan(contact.player.y + 2);
  await page.keyboard.up('s');
  await page.keyboard.down('Space');
  await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(.2);
  await page.keyboard.up('Space');
  state = await snapshot(page);
  expect(bodiesOverlap(collisionBody(state.player, mode), obstacleBody(fixture.obstacle))).toBe(false);
  expect(state.renderMode).toBe('3d');
  expect(errors).toEqual([]);
  await testInfo.attach(`${mode}-contact-evidence`, { body: JSON.stringify({ setup: 'normal v2 save loader', input: 'normal keyboard', fixture, contact, heldAgainstWall, reversed: state }, null, 2), contentType: 'application/json' });
});

for (const approach of ['stopped', 'moving']) test(`live rider meets ${approach} traffic without overlap or forced displacement`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Deterministic saved starting pose with normal production traffic; desktop contact inspection.');
  const world = createWorld(), generatedCar = makeTraffic()[0], state = createSession(world);
  // Car 0 starts on the production eastbound lane. The save places the rider
  // ahead, facing it. No car factory, movement function or render call is changed.
  const pose = { x: generatedCar.x + 60, y: generatedCar.y, angle: Math.PI };
  expect(poseCollides(pose, 'riding', world)).toBe(false);
  Object.assign(state.player, pose); Object.assign(state.vehicle, pose);
  const telemetry = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function sample(label) {
    const current = await snapshot(page), car = current.traffic[0];
    expect(current.renderMode).toBe('3d');
    expect(bodiesOverlap(collisionBody(current.player, 'riding'), collisionBody(car, 'car'))).toBe(false);
    const entry = { label, time: Date.now(), physics: current.physics, player: current.player, car, actorBody: collisionBody(current.player, 'riding').vertices, carBody: collisionBody(car, 'car').vertices };
    telemetry.push(entry);
    return current;
  }
  try {
    await loadFixture(page, serializeSession(state));
    const initial = await sample('initial');
    if (approach === 'stopped') {
      await expect.poll(async () => (await sample('car-approaching')).traffic[0].x).toBeGreaterThan(initial.traffic[0].x + .5);
      await expect.poll(async () => (await sample('car-yields')).traffic[0].yielding, { timeout: 60_000 }).toBe(true);
      const waiting = await sample('stationary-car-before-input');
      expect(waiting.traffic[0].actualSpeed).toBe(0);
      expect(waiting.player.x).toBe(pose.x);
      expect(waiting.player.y).toBe(pose.y);
    }
    await page.keyboard.down('w');
    if (approach === 'moving') {
      await expect.poll(async () => (await sample('both-moving')).player.distance).toBeGreaterThan(.5);
      expect((await sample('car-travelled')).traffic[0].x).toBeGreaterThan(initial.traffic[0].x + .5);
    }
    // Read the actual main-loop result: initial zero velocity is no pass.
    await expect.poll(async () => (await sample('contact')).physics.vehicleHit, { timeout: 60_000 }).toBe(true);
    await expect.poll(async () => Math.abs((await sample('stopping')).player.speed)).toBeLessThan(.1);
    const stopped = await sample('stopped');
    expect(stopped.traffic[0].actualSpeed).toBe(0);
    await page.waitForTimeout(800);
    const held = await sample('throttle-held-against-car');
    expect(Math.hypot(held.player.x - stopped.player.x, held.player.y - stopped.player.y)).toBeLessThan(.01);
    expect(Math.hypot(held.traffic[0].x - stopped.traffic[0].x, held.traffic[0].y - stopped.traffic[0].y)).toBeLessThan(.01);
    await page.keyboard.up('w');
    await captureContact(page, testInfo, `${approach}-car-contact`);
    await page.keyboard.down('s');
    await expect.poll(async () => (await sample('reversing-away')).player.x).toBeGreaterThan(stopped.player.x + 2);
    await page.keyboard.up('s');
    expect(errors).toEqual([]);
  } finally {
    await page.keyboard.up('w').catch(() => {});
    await page.keyboard.up('s').catch(() => {});
    await testInfo.attach(`${approach}-traffic-contact`, { body: JSON.stringify({ setup: 'normal v2 actor save plus unchanged makeTraffic()', input: 'normal keyboard', generatedCar, initialPose: pose, telemetry }, null, 2), contentType: 'application/json' });
  }
});

test('live scooter slides along a building after an oblique contact', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Targeted production-building fixture; desktop collision inspection.');
  const world = createWorld(), angle = -Math.PI / 4;
  const extent = (SCOOTER.length + SCOOTER.occupiedWidth) / 2 / Math.SQRT2;
  let fixture;
  for (const building of world.buildings.filter(item => item.type === 'building')) {
    const start = { x: building.x + building.w / 4, y: building.y + building.d + extent + 5, angle };
    const finish = { ...start, x: start.x + 10, y: building.y + building.d + extent + .01 };
    if (!poseCollides(start, 'riding', world) && !poseCollides(finish, 'riding', world)) { fixture = { building, start, contactY: building.y + building.d + extent }; break; }
  }
  expect(fixture).toBeTruthy();
  const state = createSession(world);
  Object.assign(state.player, fixture.start); Object.assign(state.vehicle, fixture.start);
  await loadFixture(page, serializeSession(state));
  const initial = await snapshot(page);
  await page.keyboard.down('w');
  await expect.poll(async () => (await snapshot(page)).physics.buildingHit).toBe(true);
  const contact = await snapshot(page);
  expect(Math.abs(contact.player.y - fixture.contactY)).toBeLessThan(.06);
  await expect.poll(async () => (await snapshot(page)).player.x).toBeGreaterThan(contact.player.x + 3);
  const sliding = await snapshot(page);
  expect(Math.abs(sliding.player.y - contact.player.y)).toBeLessThan(.06);
  expect(sliding.player.speed).toBeGreaterThan(1);
  expect(poseCollides(sliding.player, 'riding', world)).toBe(false);
  await page.keyboard.up('w');
  await page.keyboard.down('Space');
  await expect.poll(async () => Math.abs((await snapshot(page)).player.speed)).toBeLessThan(.2);
  await page.keyboard.up('Space');
  await captureContact(page, testInfo, 'scooter-oblique-building-slide');
  await testInfo.attach('oblique-slide-evidence', { body: JSON.stringify({ fixture, initial, contact, sliding }, null, 2), contentType: 'application/json' });
});
