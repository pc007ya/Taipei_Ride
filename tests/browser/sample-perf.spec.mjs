import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createWorld, makeTraffic, START, poseCollides } from '../../src/world.js';
import { createSession } from '../../src/session.js';

const previousCommit = '82d7119e97eae5a0af7809de7bc7ecc9a7184cdf';
const versions = [
  { id: 'previous-sample', origin: 'http://127.0.0.1:4177' },
  { id: 'optimized-sample', origin: 'http://127.0.0.1:4175' },
];

// This is a controlled renderer benchmark, separately labelled from the normal
// application's real input/frame-clock tests in sample.spec.mjs. Both renderers
// receive the same stationary or frame-indexed actor pose and animation offset.
// No application physics, input, clock, WebGL context or materials are replaced.
for (const moving of [false, true]) test(`controlled sample render cost: ${moving ? 'moving actor every frame' : 'stationary scene'}`, async ({ page }, testInfo) => {
  const world = createWorld(), state = createSession(world), evidence = [], errors = [];
  state.mode = 'walking'; Object.assign(state.player, { ...START, x: START.x + 16 });
  Object.assign(state.vehicle, START); state.traffic = makeTraffic(); state.target = null; state.night = false;
  expect(poseCollides(state.player, 'walking', world)).toBe(false);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__sample-render-benchmark*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#e6ece8;color:#18392f;font:16px system-ui}header{box-sizing:border-box;height:82px;padding:15px 28px;background:#fafcf8}h1{font-size:23px;margin:0 0 5px}p{margin:0}canvas{display:block}footer{box-sizing:border-box;height:48px;padding:12px 28px;background:#fafcf8}</style></head><body><header><h1 id="title"></h1><p>Controlled production-renderer benchmark · fixed pose sequence and 0.55 drawing scale</p></header><canvas id="benchmark"></canvas><footer>GPU completion is measured explicitly. This is not normal gameplay FPS or hardware-device performance.</footer></body></html>' }));
  for (const version of versions) {
    await page.goto(`${version.origin}/__sample-render-benchmark?sample=refined`);
    await page.evaluate(async ({ state, version, moving }) => {
      const { Renderer3D } = await import('/src/renderer3d.js');
      const { createWorld } = await import('/src/world.js');
      const renderer = new Renderer3D(document.querySelector('#benchmark'), createWorld());
      renderer.setAppearance('sunset');
      await renderer.sampleReady;
      if (!renderer.getViewMetrics().sample.ready) throw new Error('Sample is not ready');
      renderer.setQuality('low');
      // resize's explicit pixelRatio argument is an existing production API.
      // It fixes this inspection's rendering budget identically in both versions.
      renderer.resize(innerWidth, innerHeight - 130, .55);
      renderer.resetCamera(state.player);
      let shadowRefreshes = 0;
      const hooks = [];
      renderer.scene.traverse(light => {
        if (!light.isLight || !light.shadow) return;
        const shadow = light.shadow, original = shadow.updateMatrices;
        // Count actual Three.js shadow-map matrix updates transparently. The
        // original method is called unchanged; no pass is forced or suppressed.
        shadow.updateMatrices = function (...args) { shadowRefreshes++; return original.apply(this, args); };
        hooks.push({ shadow, original });
      });
      document.querySelector('#title').textContent = `${version.id} · ${moving ? 'moving actor each measured frame' : 'stationary scene'}`;
      window.renderBenchmark = { renderer, state, originalPlayer: { ...state.player }, hooks, getShadowRefreshes: () => shadowRefreshes };
    }, { state, version, moving });
    const result = await page.evaluate(async ({ moving, previousCommit, version }) => {
      const { renderer, state, originalPlayer, getShadowRefreshes } = window.renderBenchmark;
      const gl = renderer.renderer.getContext();
      for (let i = 0; i < 3; i++) {
        await new Promise(requestAnimationFrame); renderer.render(state, 0); gl.finish();
      }
      const warmShadowRefreshes = getShadowRefreshes(), frames = [];
      for (let i = 0; i < 30; i++) {
        await new Promise(requestAnimationFrame);
        Object.assign(state.player, { ...originalPlayer, y: originalPlayer.y - (moving ? (i + 1) * .08 : 0), speed: moving ? 14 : 0, actualSpeed: moving ? 14 : 0 });
        const shadowBefore = getShadowRefreshes(), start = performance.now();
        renderer.render(state, moving ? 1 / 60 : 0);
        gl.finish();
        const durationMs = performance.now() - start;
        frames.push({ index: i, durationMs, shadowRefreshes: getShadowRefreshes() - shadowBefore, player: { x: state.player.x, y: state.player.y, angle: state.player.angle }, animationTime: renderer.time, camera: { position: renderer.camera.position.toArray(), target: renderer.look.toArray() }, scale: renderer.getRenderMetrics(), performance: renderer.getPerformanceMetrics(), shadow: renderer.getViewMetrics().sample.shadow || null });
      }
      const durations = frames.map(frame => frame.durationMs).sort((a, b) => a - b);
      const sum = durations.reduce((a, b) => a + b, 0), pixel = new Uint8Array(4), colors = new Set();
      for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) {
        gl.readPixels(Math.floor(gl.drawingBufferWidth * x / 12), Math.floor(gl.drawingBufferHeight * y / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); colors.add([...pixel].join(','));
      }
      return { previousCommit, version: version.id, moving, setup: 'Identical production scene, fixed 1440x830 CSS/0.55 buffer, three warm-up frames, 30 measured render+gl.finish calls. Frame-indexed motion is only a controlled rendering fixture, not the application simulation.', frames, summary: { meanRenderMs: sum / frames.length, medianRenderMs: (durations[14] + durations[15]) / 2, p95RenderMs: durations[Math.ceil(durations.length * .95) - 1], equivalentSerialRenderHz: frames.length * 1000 / sum, warmShadowRefreshes, measuredShadowRefreshes: getShadowRefreshes() - warmShadowRefreshes }, sample: renderer.getViewMetrics().sample, light: { position: renderer.sun.position.toArray(), target: renderer.sun.target.position.toArray(), hemisphere: renderer.light.intensity, exposure: renderer.renderer.toneMappingExposure }, pixels: { webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), error: gl.getError(), colors: colors.size } };
    }, { moving, previousCommit, version });
    const label = `controlled-${moving ? 'moving' : 'static'}-${version.id}`;
    const jsonPath = testInfo.outputPath(`${label}.json`); await writeFile(jsonPath, JSON.stringify(result, null, 2));
    await testInfo.attach(`${label}-evidence`, { path: jsonPath, contentType: 'application/json' });
    const pngPath = testInfo.outputPath(`${label}.png`); await page.screenshot({ path: pngPath, fullPage: true });
    await testInfo.attach(label, { path: pngPath, contentType: 'image/png' });
    expect(result.pixels.webgl2).toBe(true); expect(result.pixels.contextLost).toBe(false); expect(result.pixels.error).toBe(0); expect(result.pixels.colors).toBeGreaterThan(10);
    expect(result.sample.enabled).toBe(true); expect(result.sample.ready).toBe(true); expect(result.sample.error).toBeFalsy();
    expect(result.frames).toHaveLength(30);
    if (version.id === 'optimized-sample') expect(result.summary.measuredShadowRefreshes).toBe(moving ? 30 : 0);
    for (const frame of result.frames) { expect(frame.durationMs).toBeGreaterThan(0); expect(frame.scale.effectiveRenderScale).toBe(.55); }
    evidence.push(result);
  }
  for (let i = 0; i < evidence[0].frames.length; i++) {
    const before = evidence[0].frames[i], after = evidence[1].frames[i];
    expect(before.player).toEqual(after.player); expect(before.camera).toEqual(after.camera); expect(before.scale).toEqual(after.scale); expect(before.animationTime).toBe(after.animationTime);
  }
  expect(evidence[0].light).toEqual(evidence[1].light);
  // Improvement is a reviewed numeric finding, not an arbitrary timing pass
  // threshold. Retain the complete samples even when a candidate is slower.
  expect(errors).toEqual([]);
});
