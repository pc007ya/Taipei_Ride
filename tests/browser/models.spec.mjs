import { test, expect } from '@playwright/test';

// This isolated inspection page imports the production mesh factories. It uses
// actual WebGL, but is deliberately labelled as an asset inspection camera;
// ordinary gameplay screenshots and the continuous quest live in other tests.
test('production models in real WebGL: rider contacts, street scale and props', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Close model inspection runs once; all three viewports exercise normal gameplay.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/__model-inspection', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#e6ece8;color:#18392f;font:16px system-ui}header{box-sizing:border-box;height:82px;padding:15px 28px;background:#fafcf8}h1{font-size:23px;margin:0 0 5px}p{margin:0}canvas{display:block;width:100vw;height:calc(100vh - 130px)}footer{box-sizing:border-box;height:48px;padding:12px 28px;background:#fafcf8}</style></head><body><header><h1 id="title">Production mesh inspection</h1><p>Actual Chromium WebGL 2 · original game meshes · inspection camera</p></header><canvas id="inspection"></canvas><footer id="caption"></footer></body></html>',
  }));
  await page.goto('/__model-inspection');
  await page.evaluate(async () => {
    const THREE = await import('/vendor/three.module.js');
    const models = await import('/src/renderer3d.js');
    const { applyCharacterPalette } = await import('/src/models.js');
    const { createWorld } = await import('/src/world.js');
    const scale = await import('/src/scale.js');
    const canvas = document.querySelector('#inspection');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(innerWidth, innerHeight - 130, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    window.inspection = { THREE, models, applyCharacterPalette, scale, createWorld, renderer };
  });
  for (const shot of ['rider-left', 'rider-right', 'two-character-models', 'street-residents', 'human-vehicle-building-scale', 'tree-lamp-scale']) {
    const evidence = await page.evaluate(shot => {
      const { THREE, models, applyCharacterPalette, scale, createWorld, renderer } = window.inspection;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xe6ece8);
      scene.add(new THREE.HemisphereLight(0xe9f5ff, 0x687663, 2.4));
      const sun = new THREE.DirectionalLight(0xffefcb, 2.3);
      sun.position.set(-60, 100, 70); scene.add(sun);
      const group = new THREE.Group(); scene.add(group);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0xbcc8bb, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -.05; scene.add(floor);
      const sizes = {};
      function visibleBounds(object) {
        object.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3();
        object.traverseVisible(part => {
          if (!part.isMesh) return;
          if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
          bounds.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));
        });
        return bounds;
      }
      function add(name, object, x = 0, z = 0) {
        object.position.set(x, 0, z); group.add(object);
        const bounds = visibleBounds(object);
        sizes[name] = bounds.getSize(new THREE.Vector3()).toArray();
        return object;
      }
      let camera;
      const aspect = innerWidth / (innerHeight - 130);
      if (shot.startsWith('rider-')) {
        const scooter = models.createScooter(shot === 'rider-left' ? 'male' : 'female');
        applyCharacterPalette(scooter, shot === 'rider-left' ? 'sunset' : 'river');
        add('mountedScooter', scooter);
        document.querySelector('#title').textContent = shot === 'rider-left' ? 'Cheng · mounted rider, left/front inspection' : 'Qing · mounted rider, right/rear inspection';
        document.querySelector('#caption').textContent = 'Production seated pose: saddle contact, hands at grips, shoes on the footboard';
      } else if (shot === 'two-character-models') {
        const cheng = models.createWalker(undefined, true, 'male'), qing = models.createWalker(undefined, true, 'female');
        applyCharacterPalette(cheng, 'sunset'); applyCharacterPalette(qing, 'river');
        add('Cheng', cheng, 0, -5);
        add('Qing', qing, 0, 5);
        document.querySelector('#title').textContent = 'Cheng and Qing · production character geometry';
        document.querySelector('#caption').textContent = 'Original head, hair, hands, clothing, articulated limbs and shoes at their real shared scale';
      } else if (shot === 'street-residents') {
        add('warmClothedResident', models.createPedestrian(0xc78062), 0, -5);
        add('blueClothedResident', models.createPedestrian(0x719baa), 0, 5);
        document.querySelector('#title').textContent = 'Street residents · production batched vertex colors';
        document.querySelector('#caption').textContent = 'Skin, hair, trousers and two different clothing colors must survive the production mesh batching path';
      } else if (shot === 'human-vehicle-building-scale') {
        const source = createWorld().buildings.find(building => building.type === 'building' && building.floorCount === 2);
        if (!source) throw new Error('Expected an actual two-storey city building');
        const building = { ...source, x: 700, y: 700 };
        const { city } = models.createCity({ buildings: [building], trees: [], lamps: [], stalls: [], obstacles: [] });
        scene.add(city);
        const cx = building.x + building.w / 2, front = building.y + building.d + 15;
        add('walker', models.createWalker(), cx - 48, front);
        const parked = models.createScooter(); models.setMountedRiderVisible(parked, false);
        add('parkedScooter', parked, cx - 25, front);
        add('car', models.createCar({ color: '#efbc50' }), cx + 22, front);
        floor.visible = false;
        camera = new THREE.PerspectiveCamera(42, aspect, .1, 1800);
        camera.position.set(cx + 24, 52, front + 155);
        camera.lookAt(cx, 27, front - 9);
        sizes.building = [building.w, building.h, building.d];
        document.querySelector('#title').textContent = 'One shared scale · person, parked scooter, car and shop entrance';
        document.querySelector('#caption').textContent = `10 world units = 1 m · person ${scale.PERSON.height / 10} m · scooter ${scale.SCOOTER.length / 10} m · car ${scale.CAR.length / 10} m · door ${scale.BUILDING.doorHeight / 10} m`;
      } else {
        const world = createWorld();
        add('tree', models.createTree({ ...world.trees[0], x: 0, y: 0 }), -18, 0);
        add('lamp', models.createLamp({ ...world.lamps[0], x: 0, y: 0 }), 17, 0);
        add('walker', models.createWalker(), 1, 9);
        document.querySelector('#title').textContent = 'Street props · tree trunk, crown, lamp base and light housing';
        document.querySelector('#caption').textContent = 'Production meshes at the same scale as the pedestrian; collision behavior is tested separately';
      }
      if (!camera) {
        const bounds = visibleBounds(group);
        const center = bounds.getCenter(new THREE.Vector3());
        const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
        camera = new THREE.PerspectiveCamera(40, aspect, .1, 1800);
        const direction = shot === 'rider-right' ? new THREE.Vector3(-1.5, .7, -3) : ['two-character-models', 'street-residents'].includes(shot) ? new THREE.Vector3(3, .5, 1.2) : new THREE.Vector3(1.2, .7, 3);
        camera.position.copy(center).addScaledVector(direction.normalize(), radius / Math.sin(THREE.MathUtils.degToRad(20)) * 1.1);
        camera.lookAt(center);
      }
      renderer.render(scene, camera);
      const gl = renderer.getContext(), pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4), colors = new Set();
      // The first run's sparse 15×11 grid missed almost all thin lamp/actor
      // pixels. Sample every fourth pixel throughout the actual framebuffer;
      // keep the nonempty-image threshold unchanged and retain the evidence.
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      for (let offset = 0; offset < pixels.length; offset += 16) colors.add(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]},${pixels[offset + 3]}`);
      return { shot, webgl2: gl instanceof WebGL2RenderingContext, contextLost: gl.isContextLost(), glError: gl.getError(), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, sampledPixels: Math.ceil(pixels.length / 16), uniqueColors: colors.size, sizes, camera: camera.position.toArray(), calls: renderer.info.render.calls };
    }, shot);
    await testInfo.attach(`${shot}-evidence`, { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
    const path = testInfo.outputPath(`${shot}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(shot, { path, contentType: 'image/png' });
    expect(evidence.webgl2).toBe(true);
    expect(evidence.contextLost).toBe(false);
    expect(evidence.glError).toBe(0);
    expect(evidence.uniqueColors).toBeGreaterThan(15);
  }
  expect(errors).toEqual([]);
});
