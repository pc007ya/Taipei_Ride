import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createWorld, makeTraffic, START, poseCollides } from '../../src/world.js';
import { createSession, serializeSession, SAVE_KEY } from '../../src/session.js';
import { startJourney } from './controls.mjs';

const BASELINE = 'fafab1e9ed056ecca6c2e0c1ae8ff8d9d16b5188';
const variants = [
  { id: 'before', origin: 'http://127.0.0.1:4176', query: '', description: `Published ${BASELINE.slice(0, 7)}` },
  { id:'previous',origin:'http://127.0.0.1:4177',query:'?sample=refined',description:'Previous sample 2c8b0cb' },
  { id: 'after', origin: 'http://127.0.0.1:4175', query: '?sample=refined', description: 'Opt-in material sample' },
];
const shots = [
  { id: 'walker-three-quarter', kind: 'walker', camera: [26, 14, 23], target: [0, 9, 0] },
  { id: 'mounted-rider-three-quarter', kind: 'rider', camera: [24, 19, 30], target: [0, 8, 0] },
  { id: 'parked-scooter-side', kind: 'scooter', camera: [0, 13, 40], target: [0, 7, 0] },
];

async function record(testInfo, name, evidence) {
  const path = testInfo.outputPath(`${name}.json`);
  await writeFile(path, JSON.stringify(evidence, null, 2));
  await testInfo.attach(`${name}-evidence`, { path, contentType: 'application/json' });
}

async function photograph(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function realFrameWindow(page) {
  return page.evaluate(() => new Promise(resolve => {
    const entries = [], began = performance.now();
    const next = timestamp => {
      const state = window.taipeiRide.snapshot();
      entries.push({ timestamp, performance: state.performance, player: { x: state.player.x, y: state.player.y, speed: state.player.speed, actualSpeed: state.player.actualSpeed }, shadow: state.view.sample?.shadow || null, scale: state.effectiveRenderScale, buffer: [state.drawingBufferWidth, state.drawingBufferHeight] });
      if (timestamp - began >= 6000 && entries.length >= 6) resolve(entries); else requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }));
}

async function inspectionPage(page, variant) {
  await page.route('**/__sample-inspection*', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#e6ece8;color:#18392f;font:16px system-ui}header{box-sizing:border-box;height:82px;padding:15px 28px;background:#fafcf8}h1{font-size:23px;margin:0 0 5px}p{margin:0}canvas{display:block;width:100vw;height:calc(100vh - 130px)}footer{box-sizing:border-box;height:48px;padding:12px 28px;background:#fafcf8}</style></head><body><header><h1 id="title"></h1><p>Actual Chromium WebGL 2 · matched inspection camera, exposure and resolution</p></header><canvas id="inspection"></canvas><footer id="caption"></footer></body></html>',
  }));
  await page.goto(`${variant.origin}/__sample-inspection${variant.query}`);
}

for (const shot of shots) test(`paired neutral-light assets: ${shot.id}`, async ({ page }, testInfo) => {
  const pair = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const variant of variants) {
    await inspectionPage(page, variant);
    const evidence = await page.evaluate(async ({ shot, variant, baseline }) => {
      const THREE = await import('/vendor/three.module.js');
      const production = await import('/src/renderer3d.js');
      const { applyCharacterPalette } = await import('/src/models.js');
      let object;
      if (variant.id !== 'before') {
        // The same factories used by the query-selected runtime sample are
        // imported here. This page is explicitly an asset inspection fixture.
        const sample = await import('/src/sample-characters.js');
        object = shot.kind === 'walker'
          ? await sample.createSampleWalker('sunset')
          : await sample.createSampleScooter('sunset');
      } else {
        object = shot.kind === 'walker' ? production.createWalker(undefined, true, 'male') : production.createScooter('male');
        applyCharacterPalette(object, 'sunset');
      }
      if (shot.kind === 'scooter') production.setMountedRiderVisible(object, false);
      const canvas = document.querySelector('#inspection');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(innerWidth, innerHeight - 130, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe6ece8);
      const hemi = new THREE.HemisphereLight(0xe9f5ff, 0x687663, 2.4); scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xffefcb, 2.3); sun.position.set(-60, 100, 70); scene.add(sun);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0xbcc8bb, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.05; scene.add(floor, object);
      const camera = new THREE.PerspectiveCamera(35, innerWidth / (innerHeight - 130), .1, 1800);
      camera.position.set(...shot.camera); camera.lookAt(...shot.target);
      object.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3(), contacts = {}, materials = [], counts = { meshes: 0, triangles: 0 };
      object.traverseVisible(part => {
        if (part.name.includes('contact') || part.name.includes('anchor')) contacts[part.name] = part.getWorldPosition(new THREE.Vector3()).toArray();
        if (!part.isMesh) return;
        part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
        counts.meshes++; counts.triangles += (part.geometry.index?.count || part.geometry.attributes.position.count) / 3;
        for (const material of Array.isArray(part.material) ? part.material : [part.material]) materials.push({ name: part.name, type: material.type, roughness: material.roughness, metalness: material.metalness, map: Boolean(material.map), bumpMap: Boolean(material.bumpMap), normalMap: Boolean(material.normalMap), roughnessMap: Boolean(material.roughnessMap) });
      });
      document.querySelector('#title').textContent = `${variant.id.toUpperCase()} · ${shot.id} · ${variant.description}`;
      document.querySelector('#caption').textContent = 'Same camera and neutral lights · 10 world units = 1 m · DPR 1 · inspection fixture, not a gameplay frame';
      renderer.render(scene, camera);
      const gl = renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4), colors = new Set();
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let offset = 0; offset < pixels.length; offset += 16) colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`);
      return { variant: variant.id, baselineCommit: baseline, shot: shot.id, sample: object.userData.sample === true, camera: { position: camera.position.toArray(), target: shot.target, fov: camera.fov, near: camera.near, far: camera.far }, light: { hemisphere: { sky: hemi.color.getHex(), ground: hemi.groundColor.getHex(), intensity: hemi.intensity }, sun: { color: sun.color.getHex(), intensity: sun.intensity, position: sun.position.toArray() }, exposure: renderer.toneMappingExposure, shadows: renderer.shadowMap.enabled }, viewport: { width: innerWidth, height: innerHeight }, buffer: { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, scale: renderer.getPixelRatio() }, webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), glError: gl.getError(), colors: colors.size, size: bounds.getSize(new THREE.Vector3()).toArray(), contacts, counts, materials, drawCalls: renderer.info.render.calls, renderedTriangles: renderer.info.render.triangles };
    }, { shot, variant, baseline: BASELINE });
    await record(testInfo, `${shot.id}-${variant.id}`, evidence);
    await photograph(page, testInfo, `${shot.id}-${variant.id}`);
    expect(evidence.webgl2).toBe(true); expect(evidence.contextLost).toBe(false); expect(evidence.glError).toBe(0); expect(evidence.colors).toBeGreaterThan(15);
    expect(evidence.sample).toBe(variant.id !== 'before');
    pair.push(evidence);
  }
  expect(pair[0].camera).toEqual(pair[1].camera); expect(pair[1].camera).toEqual(pair[2].camera);
  expect(pair[0].light).toEqual(pair[1].light); expect(pair[1].light).toEqual(pair[2].light);
  expect(pair[0].viewport).toEqual(pair[1].viewport); expect(pair[1].viewport).toEqual(pair[2].viewport);
  expect(pair[0].buffer).toEqual(pair[1].buffer); expect(pair[1].buffer).toEqual(pair[2].buffer);
  expect(errors).toEqual([]);
});

test('paired day street uses the production renderer at the same fixed pose', async ({ page }, testInfo) => {
  const world = createWorld(), state = createSession(world), pair = [], errors = [];
  Object.assign(state.player, START); Object.assign(state.vehicle, START); state.night = false;
  state.traffic = makeTraffic(); state.target = null;
  page.on('pageerror', error => errors.push(error.message));
  for (const variant of variants) {
    await inspectionPage(page, variant);
    await page.evaluate(async ({ state, variant }) => {
      const THREE = await import('/vendor/three.module.js');
      const { Renderer3D } = await import('/src/renderer3d.js');
      const { createWorld } = await import('/src/world.js');
      const renderer = new Renderer3D(document.querySelector('#inspection'), createWorld());
      renderer.resize(innerWidth, innerHeight - 130, 1);
      renderer.setAppearance('sunset'); renderer.resetCamera(state.player);
      window.sampleInspection = { THREE, renderer, state };
      document.querySelector('#title').textContent = `${variant.id.toUpperCase()} · daylight start street · ${variant.description}`;
      document.querySelector('#caption').textContent = 'Production renderer, static saved pose fixture · same day/sun/camera/exposure/DPR · no simulation or performance claim';
    }, { state, variant });
    if (variant.id !== 'before') await expect.poll(() => page.evaluate(() => window.sampleInspection.renderer.getViewMetrics().sample?.ready)).toBe(true);
    const evidence = await page.evaluate(() => {
      const { THREE, renderer, state } = window.sampleInspection;
      // An inspection fixture uses a stationary pose, the production reset
      // camera and identical zero animation offset. The gameplay clock and
      // actual main loop are exercised separately below and are never replaced.
      renderer.render(state, 0);
      const gl = renderer.renderer.getContext(), pixel = new Uint8Array(4), colors = new Set();
      for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) {
        gl.readPixels(Math.floor(gl.drawingBufferWidth * x / 12), Math.floor(gl.drawingBufferHeight * y / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); colors.add([...pixel].join(','));
      }
      return { camera: { position: renderer.camera.position.toArray(), target: renderer.look.toArray(), fov: renderer.camera.fov }, player: state.player, night: state.night, scale: renderer.getRenderMetrics(), light: { sunPosition: renderer.sun.position.toArray(), sunTarget: renderer.sun.target.position.toArray(), sunDirection: renderer.sun.target.position.clone().sub(renderer.sun.position).normalize().toArray(), sunColor: renderer.sun.color.getHex(), sunIntensity: renderer.sun.intensity, hemisphere: renderer.light.intensity, environmentIntensity: renderer.scene.environmentIntensity, environment: Boolean(renderer.scene.environment), exposure: renderer.renderer.toneMappingExposure, shadows: renderer.renderer.shadowMap.enabled, shadowMapSize: renderer.sun.shadow.mapSize.toArray() }, sample: renderer.getViewMetrics().sample || null, stats: renderer.getPerformanceMetrics(), webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), glError: gl.getError(), colors: colors.size };
    });
    await record(testInfo, `street-day-${variant.id}`, { baselineCommit: BASELINE, variant: variant.id, ...evidence });
    await photograph(page, testInfo, `street-day-${variant.id}`);
    expect(evidence.webgl2).toBe(true); expect(evidence.contextLost).toBe(false); expect(evidence.glError).toBe(0); expect(evidence.colors).toBeGreaterThan(10);
    if (variant.id !== 'before') {
      expect(evidence.sample.enabled).toBe(true); expect(evidence.sample.ready).toBe(true); expect(evidence.sample.error).toBeFalsy();
    }
    pair.push(evidence);
  }
  expect(pair[0].camera).toEqual(pair[1].camera); expect(pair[1].camera).toEqual(pair[2].camera); expect(pair[0].player).toEqual(pair[1].player); expect(pair[1].player).toEqual(pair[2].player); expect(pair[0].scale).toEqual(pair[1].scale); expect(pair[1].scale).toEqual(pair[2].scale);
  expect(pair[0].night).toBe(false); expect(pair[1].night).toBe(false);
  expect(pair[0].light.sunDirection).toEqual(pair[1].light.sunDirection); expect(pair[0].light.exposure).toBe(pair[1].light.exposure);
  expect(errors).toEqual([]);
});

for (const variant of variants) test(`normal runtime sample controls and measured render performance: ${variant.id}`, async ({ page }, testInfo) => {
  const state = createSession(createWorld()), errors = [];
  expect(poseCollides(state.player, 'riding', createWorld())).toBe(false);
  await page.addInitScript(({ save, key }) => {
    localStorage.setItem(key, JSON.stringify(save));
    localStorage.setItem('taipei-ride:menu:v1', JSON.stringify({ reducedMotion: true, language: 'zh', appearance: 'sunset', quality: 'low' }));
  }, { save: serializeSession(state), key: SAVE_KEY });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(variant.origin + '/' + variant.query);
  await page.waitForFunction(() => window.taipeiRide);
  if (variant.id !== 'before') await expect.poll(() => page.evaluate(() => window.taipeiRide.snapshot().view.sample?.ready), { timeout: 60_000 }).toBe(true);
  await startJourney(page);
  const initial = await page.evaluate(() => window.taipeiRide.snapshot());
  expect(initial.renderMode).toBe('3d'); expect(initial.night).toBe(false);
  if (variant.id !== 'before') {
    expect(initial.view.sample.enabled).toBe(true); expect(initial.view.sample.ready).toBe(true); expect(initial.view.sample.error).toBeFalsy();
  }
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => window.taipeiRide.snapshot().player.distance)).toBeGreaterThan(initial.player.distance + 4);
  await page.keyboard.up('w'); await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => Math.abs(window.taipeiRide.snapshot().player.speed))).toBeLessThan(.1);
  await page.keyboard.up('Space');
  await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => window.taipeiRide.snapshot().mode)).toBe('walking');
  const walkStart = await page.evaluate(() => window.taipeiRide.snapshot().player.distance);
  await page.keyboard.down('w');
  await expect.poll(() => page.evaluate(() => window.taipeiRide.snapshot().player.distance)).toBeGreaterThan(walkStart + 2);
  const headingBeforeTurn = await page.evaluate(() => window.taipeiRide.snapshot().player.angle);
  await page.keyboard.down('d');
  await expect.poll(() => page.evaluate(initial => {
    const angle = window.taipeiRide.snapshot().player.angle;
    return Math.abs(Math.atan2(Math.sin(angle - initial), Math.cos(angle - initial)));
  }, headingBeforeTurn)).toBeGreaterThan(.08);
  await page.keyboard.up('d');
  const movingSamples = await realFrameWindow(page);
  const gaitBeforeCapture = await page.evaluate(() => window.taipeiRide.snapshot());
  await photograph(page, testInfo, `runtime-moving-gait-${variant.id}`);
  const gaitAfterCapture = await page.evaluate(() => window.taipeiRide.snapshot());
  await record(testInfo, `runtime-gait-${variant.id}`, { note: 'Real held W and a native D turn; readonly snapshots bracket the moving screenshot.', before: gaitBeforeCapture, after: gaitAfterCapture });
  if (variant.id !== 'before') for (const state of [gaitBeforeCapture, gaitAfterCapture]) for (const side of ['l', 'r']) {
    const pose = state.view.sample.pose[side];
    expect(pose.foot).toHaveLength(3); expect(pose.shoe).toHaveLength(3); expect(pose.localOffset).toHaveLength(3);
    expect([...pose.foot, ...pose.shoe, ...pose.localOffset].every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...pose.shoe.map((value, index) => value - pose.foot[index]))).toBeCloseTo(Math.hypot(...pose.localOffset), 5);
  }
  await page.keyboard.up('w'); await page.keyboard.down('Space');
  await expect.poll(() => page.evaluate(() => Math.abs(window.taipeiRide.snapshot().player.speed))).toBeLessThan(.1);
  await page.keyboard.up('Space');
  const samples = await realFrameWindow(page);
  const final = await page.evaluate(() => window.taipeiRide.snapshot());
  const pixels = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const gl = document.querySelector('#world').getContext('webgl2');
    if (!gl) return resolve({ webgl2: false });
    const pixel = new Uint8Array(4), colors = new Set();
    for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) {
      gl.readPixels(Math.floor(gl.drawingBufferWidth * x / 12), Math.floor(gl.drawingBufferHeight * y / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); colors.add([...pixel].join(','));
    }
    resolve({ webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), glError: gl.getError(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, colors: colors.size });
  })));
  expect(final.renderMode).toBe('3d'); expect(final.mode).toBe('walking'); expect(errors).toEqual([]);
  expect(pixels.webgl2).toBe(true); expect(pixels.contextLost).toBe(false); expect(pixels.glError).toBe(0); expect(pixels.colors).toBeGreaterThan(10);
  await record(testInfo, `runtime-${variant.id}`, { baselineCommit: BASELINE, note: 'Actual main loop and native keyboard. Runtime adaptive resolutions and performance are reported, not forced equal or claimed as a controlled image comparison. movingSamples is a six-second held-W window; samples is a separate six-second stationary window. Gait snapshots bracket the screenshot while W remains held; time and bones are never frozen.', initial, movingSamples, gaitBeforeCapture, gaitAfterCapture, final, samples, pixels, errors });
  await photograph(page, testInfo, `runtime-walking-${variant.id}`);
});
