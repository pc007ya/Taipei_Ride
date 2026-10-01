# Taipei Ride validation

Validated on 2026-10-01 with Node.js 24.19.0.

## Passed

- Clean lockfile install: `npm ci --ignore-scripts`
- `npm test`: 52 tests passed, 0 failed
- `npm run build`: complete static `dist/` output, with bundled Three.js and its MIT license
- `npm audit --omit=dev`: 0 runtime vulnerabilities reported at validation time; full development-dependency audit also reported 0
- HTTP smoke test: HTML, JavaScript modules, both Three.js vendor modules, license and favicon returned 200; missing paths returned 404
- JavaScript syntax checks for application modules
- Deterministic original city generation, reachable landmark markers, clear roads, building/world collisions, steering, braking, reverse, capped time steps and traffic loops
- Actual Three.js volumetric city and scooter meshes, instanced windows, vertical landmark geometry and third-person camera projection
- DOM-flow simulation: automatic WebGL-failure fallback label, keyboard riding to a landmark, collecting/saving a stamp, route selection, pause/resume, held-key clearing, vehicle reset, touch cancellation, night save, journey-reset cancel/confirm and focus-loss pause
- Saved-progress restore and sixth-stamp completion into free-roam mode
- Canvas 2D scene images visually inspected in desktop and mobile dimensions
- Original 3D scene geometry inspected with an offline ray-tracing renderer; this is geometry inspection, not WebGL or browser-layout sign-off
- World X/Y → Three.js X/Z mapping, horizontal ground/road bounds and depth-test flags
- Camera visibility: rider rays at desktop/portrait spawn, the west-facing road regression at (800, 550), 144 turning views, and 12 seconds each of continuous throttle + left/right steering
- Actual `Renderer3D.render` camera loop tested at 1440×960, 390×844 and 844×390 for 600 left-turn and 600 right-turn frames per size: rider head/torso remain inside the full camera frustum (including near plane), with no opaque sightline obstruction; only the final GPU draw call is stubbed
- Hard blockers exclude foliage; extremely close walls use a higher/side camera instead of pushing into the rider
- Thin foreground trees/lamp posts fade locally to preserve rider visibility; distant materials remain opaque
- Blocked storage: persistent notice before play plus one-time save-failure notification
- Landscape CSS regression: short desktop rules require fine pointer; coarse-pointer HUD stays above touch controls (static rule verification)

## P0 gameplay extension

- Shared walking/riding modes, independent parked-vehicle position, low-speed and near-distance restrictions, safe dismount paths and blocked through-wall boarding
- Original tea-delivery quest: accept → pick up → ride at least 100 game units → dismount → deliver → one-time 300-coin reward
- Wrong station, missing acceptance/pickup, walking-only transport and mounted delivery are rejected
- Version 2 save round trips preserve separate actor/vehicle positions, mode, quest, reward flag, coins, stamps and atmosphere; legacy v1 migrates safely
- Invalid coordinates, nonfinite values, unsupported stages and inconsistent reward flags are sanitized
- DOM integration covers F/E and touch-button mode changes, delivery, reward persistence, retracking and full reset
- Actual 3D scene-state tests verify mounted-rider visibility, separate walking actor/parked scooter, and transfer/removal of the delivery parcel

## Live browser CI (separate evidence)

Playwright runs against actual Chromium WebGL 2 (SwiftShader software graphics) in desktop, portrait and landscape viewports. It records framebuffer evidence, milestone screenshots and DOM/API traces; the full delivery route uses normal keyboard controls without teleportation or clock modification. An optional, separate reference capture does not determine whether this game's own tests pass.

First live checkpoint: [run 36873918648](https://github.com/pc007ya/Taipei_Ride/actions/runs/36873918648), commit `c9baed92c7d78603cbf31967445703c2c6affbd0`:

- Unit/build job passed (51 tests at that commit)
- Portrait 390×844 and landscape 844×390 WebGL browser flows passed: actual 3D framebuffer, driving, collecting a stamp, map, pause, night, reload persistence, walking/remounting, high-speed dismount rejection, multi-touch cancellation and full reset
- Portrait framebuffer recorded WebGL 2.0, ANGLE SwiftShader, 27–28 sampled colors, no lost context and GL error 0; screenshots were visually inspected
- Desktop 1440×960 genuinely rendered (41 sampled colors, GL error 0), but both full tests timed out, so desktop completion is **not** claimed for this run. Route telemetry shows continuous progress through acceptance and toward pickup, not a stationary deadlock
- The optional reference job timed out while downloading Ubuntu dependencies/fonts, before opening the reference site; this is not evidence of a site block

Follow-up changes preserve all required interactions and assertions, remove continuous trace screencasting (explicit screenshots remain), and allow longer wall-clock budgets for software graphics. The long continuous delivery route uses a standard 1280×720 desktop viewport to reduce software-GPU fill cost; the separate desktop UI smoke test retains 1440×960. Visual review also found landscape map alignment clipping the initial map; the map is now top-aligned and has a new unit test plus a browser viewport-bounds assertion. Inspect the exact latest commit's completed jobs and screenshot artifacts for the rerun outcome; configuration or a queued run alone does not count as success.

Second live checkpoint: [run 36875789810](https://github.com/pc007ya/Taipei_Ride/actions/runs/36875789810), commit `2fdf5da787c43285fe6fd7637731248f80d7181b`:

- Unit/build passed with 52 tests; portrait and landscape browser flows passed again
- The new landscape map bounds assertion passed, and the corrected full-map screenshot was visually inspected
- The reference site opened without a CAPTCHA or JavaScript error, but captured only its loading/entry view; a verified bilingual Start button is used by the subsequent capture revision
- The desktop runner remained in the Ubuntu font download step at this checkpoint. The next revision replaces the 61.2 MB distro font bundle with one 16.4 MB official Noto TC face, pinned by revision and Git blob hash with bounded retries, solely for CI screenshots

## Verification limits

DOM-flow tests simulate a document with jsdom and stub drawing calls. They are not real-browser end-to-end tests. Offline scene inspection is not a screenshot of the WebGL renderer.

The completed mobile-viewport Chromium results above are real browser rendering, but mobile emulation is not a physical-device test. Desktop completion and the latest map correction require their completed rerun evidence. Hardware GPU performance, physical phone browsers and device-wide compatibility are not established by software-renderer CI or unit tests. The application automatically identifies and uses the separately labeled Canvas 2D compatibility renderer when WebGL initialization fails.

## Occlusion investigation and corrections

An initial SVG-only projection experiment produced a visibly invalid image: large ground triangles painted over foreground objects and the scooter. This image was rejected and removed. Three.js SVGRenderer uses polygon painter sorting through Projector (a single averaged screen-depth value per triangle); it does not provide the per-fragment depth buffer used by WebGLRenderer. That experiment cannot validate this overlapping 3D scene. The offline ray-traced mesh inspection does show the roadway and scooter in the correct positions.

Separate code review also found a real chase-camera defect: at the legal road position `(800, 550)`, facing west, the original desired camera `(919, 66, 550)` was behind a building wall. The camera now casts from the rider toward its desired position, shortens before building/stall bounds, and constrains the interpolated position again so turning interpolation cannot cut through a wall. A follow-up regression caught foliage bounds pushing the camera inside the rider; foliage was removed from hard blocking entirely. Extremely short wall clearance now selects a higher/side safe view rather than placing the camera inside the rider or behind its near plane. Close cameras adjust the look target. Tree crowns, trunks and narrow lamp posts in the rider sightline fade locally rather than obscuring the rider.

These corrections have automated raycast/geometry regression coverage. They do not replace a live WebGL playthrough, especially for camera feel, transparency sorting, runtime performance and phone layout.

## Recommended live smoke test

1. Run `npm ci && npm run dev` and open the displayed local URL in a current browser.
2. Confirm the `3D 漫遊` label, visible scooter and third-person chase camera.
3. Start, ride north to 阿沐茶舖, brake and press E to accept the main quest. Follow the pickup → ride → dismount → delivery flow. Separately select a landmark from the stamp rail to test the collection side quest.
4. Open the map and select another stop, then test turning, reversing, collision and R reset. Hold throttle + left/right through several turns; the rider should remain visible as the camera shortens near buildings.
5. Toggle night with N, pause/resume with P, and switch browser tabs while accelerating. Returning should leave the game paused.
6. Refresh while walking away from a parked scooter and during an active delivery to verify both positions, travel mode, quest stage, stamps and atmosphere. Cancel the full-reset prompt once, then confirm it and verify coins, quest, actor/vehicle positions and collection all reset together.
7. On a touch device, hold steering and throttle together; release, drag away and interrupt the gesture to check cancellation. Check landscape: the speed display and minimap must sit above the touch controls. If browser storage is disabled, the visible warning must explain that progress will not survive refresh.
8. Open `?renderer=2d` to verify the clearly labeled compatibility mode. Test both portrait and landscape layouts.
