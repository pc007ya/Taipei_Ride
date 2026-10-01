# Taipei Ride validation

Validated on 2026-10-01 with Node.js 24.19.0.

## Passed

- Clean lockfile install: `npm ci --ignore-scripts`
- `npm test`: 51 tests passed, 0 failed
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

The workflow now runs Playwright against actual Chromium WebGL 2 in desktop, portrait and landscape viewports. It records framebuffer evidence, screenshots and traces; it includes a full delivery route driven with normal keyboard controls. The local test result above does **not** assert that this new CI browser run has passed. Inspect the exact commit's completed CI jobs and artifacts for that evidence. An optional, separate reference capture does not determine whether this game's own tests pass.

## Verification limits

DOM-flow tests simulate a document with jsdom and stub drawing calls. They are not real-browser end-to-end tests. Offline scene inspection is not a screenshot of the WebGL renderer.

No live WebGL/browser-layout result is claimed by this local validation checkpoint. The GitHub Actions browser jobs are the independent route for current Chromium/WebGL evidence; do not claim device-wide compatibility or production visual sign-off from unit tests or mere workflow configuration. The application automatically identifies and uses the separately labeled Canvas 2D compatibility renderer when WebGL initialization fails.

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
