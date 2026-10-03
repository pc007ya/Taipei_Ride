import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { createWorld, makeTraffic, START, poseCollides } from '../../src/world.js';
import { createSession } from '../../src/session.js';

const stress=process.env.TAIPEI_PERF_STRESS==='1';
const benchmarkQuality=stress?'ultra':'low',benchmarkScale=stress?2:.55;
const previousCommit = '2c8b0cb5fbadbbdd299ecac400b1f8987dcb00ab';
const versions = [
  { id: 'previous-sample', origin: 'http://127.0.0.1:4177' },
  { id: 'optimized-sample', origin: 'http://127.0.0.1:4175' },
  { id:'main-baseline',origin:'http://127.0.0.1:4176' },
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
  await page.route('**/__sample-render-benchmark*', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#e6ece8;color:#18392f;font:16px system-ui}header{box-sizing:border-box;height:82px;padding:15px 28px;background:#fafcf8}h1{font-size:23px;margin:0 0 5px}p{margin:0}canvas{display:block}footer{box-sizing:border-box;height:48px;padding:12px 28px;background:#fafcf8}</style></head><body><header><h1 id="title"></h1><p>Controlled production-renderer benchmark · fixed pose sequence; CSS size and buffer scale recorded in evidence</p></header><canvas id="benchmark"></canvas><footer>Browser frame cadence includes the next animation-frame boundary. Backend is recorded in JSON; headless cadence is not physical display presentation.</footer></body></html>' }));
  // Rotate version order across repetitions to balance warm GPU/cache effects.
  const rotation=testInfo.repeatEachIndex%versions.length;
  const orderedVersions=[...versions.slice(rotation),...versions.slice(0,rotation)];
  for (const version of orderedVersions) {
    await page.goto(`${version.origin}/__sample-render-benchmark${version.id==='main-baseline'?'':'?sample=refined'}`);
    await page.evaluate(async ({ state, version, moving,benchmarkQuality,benchmarkScale }) => {
      const { Renderer3D } = await import('/src/renderer3d.js');
      const { createWorld } = await import('/src/world.js');
      const renderer = new Renderer3D(document.querySelector('#benchmark'), createWorld());
      renderer.setAppearance('sunset');
      await renderer.sampleReady;
      if (version.id!=='main-baseline'&&!renderer.getViewMetrics().sample.ready) throw new Error('Sample is not ready');
      renderer.setQuality(benchmarkQuality);
      // resize's explicit pixelRatio argument is an existing production API.
      // It fixes this inspection's rendering budget identically in both versions.
      renderer.resize(innerWidth, innerHeight - 130, benchmarkScale);
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
    }, { state, version, moving,benchmarkQuality,benchmarkScale });
    const profiler=process.env.TAIPEI_CPU_PROFILE?await page.context().newCDPSession(page):null;
    if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
    const result = await page.evaluate(async ({ moving, previousCommit, version,benchmarkQuality,benchmarkScale }) => {
      const { renderer, state, originalPlayer, getShadowRefreshes } = window.renderBenchmark;
      const gl = renderer.renderer.getContext();
      for (let i = 0; i < 20; i++) {
        await new Promise(requestAnimationFrame); renderer.render(state, 0); gl.finish();
      }
      const warmShadowRefreshes = getShadowRefreshes(), frames = [];
      const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2'),queries=[];
      let frameTimestamp = await new Promise(requestAnimationFrame);
      for (let i = 0; i < 120; i++) {
        Object.assign(state.player, { ...originalPlayer, y: originalPlayer.y - (moving ? (i + 1) * .08 : 0), speed: moving ? 14 : 0, actualSpeed: moving ? 14 : 0 });
        const shadowBefore = getShadowRefreshes();
        const query=timer?gl.createQuery():null;if(query){gl.beginQuery(timer.TIME_ELAPSED_EXT,query);queries.push(query);}
        const start = performance.now();
        renderer.render(state, moving ? 1 / 60 : 0);
        const submitMs = performance.now() - start;
        if(query)gl.endQuery(timer.TIME_ELAPSED_EXT);
        gl.finish();
        // Chromium may finish this JS/WebGL call well before the compositor
        // presents the canvas. Keep that synchronous cost separate and measure
        // through the next genuine browser animation-frame boundary as well.
        const renderCallMs = performance.now() - start;
        const nextFrameTimestamp = await new Promise(requestAnimationFrame);
        frames.push({ index: i, submitMs, gpuCompletionWaitMs:renderCallMs-submitMs, renderCallMs, frameCadenceMs: nextFrameTimestamp - frameTimestamp, rafStart: frameTimestamp, rafEnd: nextFrameTimestamp, shadowRefreshes: getShadowRefreshes() - shadowBefore, player: { x: state.player.x, y: state.player.y, angle: state.player.angle }, animationTime: renderer.time, camera: { position: renderer.camera.position.toArray(), target: renderer.look.toArray() }, scale: renderer.getRenderMetrics(), performance: renderer.getPerformanceMetrics(), shadow: renderer.getViewMetrics().sample?.shadow || null });
        frameTimestamp = nextFrameTimestamp;
      }
      // GPU elapsed queries are collected after timing; never stall a measured
      // frame to wait for a result. Disjoint/unsupported values remain null.
      for(let attempt=0;timer&&attempt<10&&queries.some(q=>!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE));attempt++)await new Promise(requestAnimationFrame);
      const disjoint=timer?gl.getParameter(timer.GPU_DISJOINT_EXT):null;
      frames.forEach((f,i)=>{const q=queries[i];f.gpuTimeMs=q&&!disjoint&&gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)?gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6:null;if(q)gl.deleteQuery(q);});
      const durations = frames.map(frame => frame.frameCadenceMs).sort((a, b) => a - b);
      const sum = durations.reduce((a, b) => a + b, 0), measuredShadowRefreshes = getShadowRefreshes() - warmShadowRefreshes;
      // Render one unmeasured verification frame after timing. Reading a canvas
      // after the next compositor boundary can otherwise see a cleared buffer
      // when preserveDrawingBuffer is false. This frame is excluded from cost
      // and shadow-update statistics, and uses the unchanged final pose/time.
      renderer.render(state, 0); gl.finish();
      const pixel = new Uint8Array(4), colors = new Set();
      for (let y = 1; y < 10; y++) for (let x = 1; x < 12; x++) {
        gl.readPixels(Math.floor(gl.drawingBufferWidth * x / 12), Math.floor(gl.drawingBufferHeight * y / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); colors.add([...pixel].join(','));
      }
      const debug=gl.getExtension('WEBGL_debug_renderer_info');
      return { device:{gpuTimerSupported:Boolean(timer),gpuTimerDisjoint:disjoint,renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),browser:navigator.userAgent,css:[innerWidth,innerHeight-130],buffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],quality:benchmarkQuality,scale:benchmarkScale}, previousCommit, version: version.id, moving, setup: 'Identical production scene, fixed CSS viewport and explicit buffer scale recorded in device metadata, twenty warm-up frames, 120 render-to-next-rAF intervals. Synchronous render()+gl.finish() cost is recorded separately and never converted to FPS. Frame-indexed motion is only a controlled rendering fixture, not the application simulation. One final pixel-verification render is unmeasured.', frames, summary: { meanFrameCadenceMs: sum / frames.length, medianFrameCadenceMs: (durations[59] + durations[60]) / 2, p95FrameCadenceMs: durations[Math.ceil(durations.length * .95) - 1], observedFrameHz: frames.length * 1000 / sum, meanRenderCallMs: frames.reduce((total, frame) => total + frame.renderCallMs, 0) / frames.length, warmShadowRefreshes, measuredShadowRefreshes }, sample: renderer.getViewMetrics().sample||{enabled:false}, light: { position: renderer.sun.position.toArray(), target: renderer.sun.target.position.toArray(), hemisphere: renderer.light.intensity, exposure: renderer.renderer.toneMappingExposure }, pixels: { webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), error: gl.getError(), colors: colors.size } };
    }, { moving, previousCommit, version,benchmarkQuality,benchmarkScale });
    const label = `controlled-${moving ? 'moving' : 'static'}-${version.id}`;
    if(profiler){const {profile}=await profiler.send('Profiler.stop');const path=testInfo.outputPath(`${label}.cpuprofile`);await writeFile(path,JSON.stringify(profile));await testInfo.attach(`${label}-cpu`,{path,contentType:'application/json'});await profiler.detach();}
    const jsonPath = testInfo.outputPath(`${label}.json`); await writeFile(jsonPath, JSON.stringify(result, null, 2));
    await testInfo.attach(`${label}-evidence`, { path: jsonPath, contentType: 'application/json' });
    const pngPath = testInfo.outputPath(`${label}.png`); await page.screenshot({ path: pngPath, fullPage: true });
    await testInfo.attach(label, { path: pngPath, contentType: 'image/png' });
    expect(result.pixels.webgl2).toBe(true); expect(result.pixels.contextLost).toBe(false); expect(result.pixels.error).toBe(0); expect(result.pixels.colors).toBeGreaterThan(10);
    expect(result.sample.enabled).toBe(version.id!=='main-baseline'); if(version.id!=='main-baseline')expect(result.sample.ready).toBe(true); expect(result.sample.error).toBeFalsy();
    expect(result.frames).toHaveLength(120);
    if (version.id === 'optimized-sample') expect(result.summary.measuredShadowRefreshes).toBe(moving ? 120 : 0);
    for (const frame of result.frames) { expect(frame.renderCallMs).toBeGreaterThan(0); expect(frame.frameCadenceMs).toBeGreaterThan(0); expect(frame.scale.effectiveRenderScale).toBe(benchmarkScale); }
    evidence.push(result);
  }
  evidence.sort((a,b)=>versions.findIndex(v=>v.id===a.version)-versions.findIndex(v=>v.id===b.version));
  for (let i = 0; i < evidence[0].frames.length; i++) {
    const before = evidence[0].frames[i], after = evidence[1].frames[i];
    expect(before.player).toEqual(after.player); expect(before.camera).toEqual(after.camera); expect(before.scale).toEqual(after.scale); expect(before.animationTime).toBe(after.animationTime);
  }
  expect(evidence[0].light).toEqual(evidence[1].light);
  // Improvement is a reviewed numeric finding, not an arbitrary timing pass
  // threshold. Retain the complete samples even when a candidate is slower.
  expect(errors).toEqual([]);
});
