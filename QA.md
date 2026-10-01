# Taipei Ride validation

Validated on 2026-10-01 with Node.js 24.19.0.

## Passed

- Clean lockfile install: `npm ci --ignore-scripts`
- `npm test`: 33 tests passed, 0 failed
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

## Verification limits

DOM-flow tests simulate a document with jsdom and stub drawing calls. They are not real-browser end-to-end tests. Offline scene inspection is not a screenshot of the WebGL renderer.

A live desktop/mobile WebGL playthrough and full browser-layout visual review have not been completed in the available validation environment. Check those on a browser with WebGL 2 before claiming device-wide compatibility or production visual sign-off. The application automatically identifies and uses the separately labeled Canvas 2D compatibility renderer when WebGL initialization fails.

## Occlusion investigation and corrections

An initial SVG-only projection experiment produced a visibly invalid image: large ground triangles painted over foreground objects and the scooter. This image was rejected and removed. Three.js SVGRenderer uses polygon painter sorting through Projector (a single averaged screen-depth value per triangle); it does not provide the per-fragment depth buffer used by WebGLRenderer. That experiment cannot validate this overlapping 3D scene. The offline ray-traced mesh inspection does show the roadway and scooter in the correct positions.

Separate code review also found a real chase-camera defect: at the legal road position `(800, 550)`, facing west, the original desired camera `(919, 66, 550)` was behind a building wall. The camera now casts from the rider toward its desired position, shortens before building/stall bounds, and constrains the interpolated position again so turning interpolation cannot cut through a wall. A follow-up regression caught foliage bounds pushing the camera inside the rider; foliage was removed from hard blocking entirely. Extremely short wall clearance now selects a higher/side safe view rather than placing the camera inside the rider or behind its near plane. Close cameras adjust the look target. Tree crowns, trunks and narrow lamp posts in the rider sightline fade locally rather than obscuring the rider.

These corrections have automated raycast/geometry regression coverage. They do not replace a live WebGL playthrough, especially for camera feel, transparency sorting, runtime performance and phone layout.

## Recommended live smoke test

1. Run `npm ci && npm run dev` and open the displayed local URL in a current browser.
2. Confirm the `3D 漫遊` label, visible scooter and third-person chase camera.
3. Start, ride north to the first glowing landmark ring, brake, and press E to collect it.
4. Open the map and select another stop, then test turning, reversing, collision and R reset. Hold throttle + left/right through several turns; the rider should remain visible as the camera shortens near buildings.
5. Toggle night with N, pause/resume with P, and switch browser tabs while accelerating. Returning should leave the game paused.
6. Refresh to confirm stamp/night persistence. Cancel the journey-reset prompt once, then explicitly reset if desired.
7. On a touch device, hold steering and throttle together; release, drag away and interrupt the gesture to check cancellation. Check landscape: the speed display and minimap must sit above the touch controls. If browser storage is disabled, the visible warning must explain that progress will not survive refresh.
8. Open `?renderer=2d` to verify the clearly labeled compatibility mode. Test both portrait and landscape layouts.
