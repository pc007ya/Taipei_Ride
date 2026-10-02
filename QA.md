# Taipei Ride validation

Validated on 2026-10-01 with Node.js 24.19.0.

## Current refinement: evidence required for its own commit

This revision replaces the actor/vehicle geometry and collision system, changes building scale, and adds the intro/menu presentation. Earlier successful runs below are historical baselines, not evidence that this revision passed. Check the exact commit's completed `Test and build` run before treating the current version as validated.

Local second-refinement checks on 2026-10-01: **154 tests passed, 0 failed**, `npm run build` passed, and changed JavaScript syntax plus `git diff --check` passed. This count includes the scaled geometry/contact, collision, intro, menu, synthesized-audio, arrival, camera-control and gamepad-mapping regressions. It does not count new live browser tests as passed.

The live suite now separates the long continuous delivery journey from the desktop/portrait/landscape jobs. It keeps normal keyboard input, the full delivery route and the existing route budgets. The desktop suite additionally checks:

- Actual application-loop contact against production buildings in riding and walking modes, sustained stopped position under throttle, and reversing away
- A normal saved actor starting pose with the unchanged, deterministic production traffic: allow a car to stop before approaching it, or approach while it moves; record both oriented footprints, speeds and displacement, and reject overlap
- Oblique scooter/building contact that retains motion along the wall without moving through its normal boundary
- Real WebGL framebuffer evidence and screenshots at contact, plus normal gameplay street views
- A separately labelled model inspection camera using the production Three.js mesh factories: both rider poses, character geometry, shared person/vehicle/shop-entrance scale, trees and lamps. These images are not passed off as the normal gameplay camera
- Real browser menu interruption, replay/skip, settings, help, both implemented characters, return without journey loss, persistence, native range-keyboard volume input and actual drawing-buffer dimensions after changing quality

Collision fixtures use the normal v2 save loader only to establish a reproducible starting pose. They do not replace physics, traffic generation, browser timing, WebGL calls or input handlers. The independent continuous quest does not inject a saved pose or teleport. Unit tests cover the wider stationary/moving, head-on/rear-end/crossing, glancing, corner, parked-vehicle, tree and lamp collision matrix.

Traffic lane centres now sit at one quarter of the seven-metre road width (17.5 world units). This leaves 2.7 units between a centreline scooter's occupied footprint and an adjacent car's mirrors. Tests cover four cardinal headings, same/opposite-direction passage and three turn-entry phases without reducing either collider. Trees and lamp bases are solid, non-destructible obstacles in this implementation; that is not a claim about untested destruction behavior in the reference game.

Native Chromium in the editing environment cannot start because its process socket is not permitted. GitHub Actions runs the official Chromium build with actual WebGL 2 through SwiftShader. New browser tests being present or discovered is not a passing result; mobile viewport emulation does not establish physical-phone or hardware-GPU behavior.

### First refinement checkpoint and its failures

[Run 36937244997](https://github.com/pc007ya/Taipei_Ride/actions/runs/36937244997), commit `29f7a078be94d3ed9fd6154c0fd2bca30464ac63`, finished with an overall **failure**, retained for diagnosis:

- 133 unit tests/build passed; complete gameplay smoke passed in desktop (2.7 minutes), portrait (2.0 minutes) and landscape (2.4 minutes)
- All five live application collision tests passed. Riding/walking wall contacts had speed 0 and zero displacement while holding forward input. Stopped/moving traffic contacts left actor and car at speed 0 without overlap or forced actor displacement. Oblique wall contact moved 7.651 world units along the wall and 0 units through its normal
- The unchanged continuous delivery route passed in 14.8 minutes at 1280×720, with actual WebGL scale 0.55, one 300-coin reward, reload persistence and reset
- The menu test failed on every viewport when the 2.4-second title transition finished while `locator.click` waited for stable frames before clicking Skip. The next test revision reads the visible button's real bounds and immediately uses native mouse/touch input. It does not change the animation clock, extend the intro or force a hidden element click
- Four production-model inspection images were captured. The final tree/lamp view rendered visibly, but a sparse 15×11 framebuffer grid returned 14 sampled colors against the >15 threshold. The next test reads the full real framebuffer and samples every fourth pixel, retaining the threshold and attaching images before assertions
- Visual inspection found white pedestrians: the second mesh-baking pass lost existing vertex colors. The second refinement preserves source vertex color multiplied by material color, adds a concrete palette regression, and adds a separate real WebGL street-resident image

### Second refinement coverage

The next live run also needs to validate the 8.4-second original arrival scene with real city/NPC rendering, locked movement, manual skip and no forced replay on resume; right-side settings/control panels and full pause dashboard; five quality presets, FPS/HUD preferences, native range input, and actual mouse dragging with sensitivity and inverted Y. Model inspection and collision contact jobs are separate so a long UI/route test cannot hide their evidence.

CI has no physical controller attached. Gamepad mapping, dead zones, edge-triggered actions, disconnect and neutral-release behavior have unit coverage, and browser tests record API availability. This does not establish real-controller hardware behavior or physical audio output.

[Run 36940930870](https://github.com/pc007ya/Taipei_Ride/actions/runs/36940930870), commit `005b94072ff478ffd1c0e6b62cf4c83fe223b001`, passed verify, all five runtime collision cases, the complete delivery journey, all production-model inspections and the full portrait browser job. Desktop gameplay and actual mouse sensitivity/inverted-Y/FPS/HUD/pause controls passed; landscape gameplay, arrival and dashboard/control flows passed. The overall run still failed: desktop's arrival screenshot work outlasted the 8.4-second clip before its later Skip lookup, and desktop/landscape title replays could finish before the first post-click bounds lookup.

The final harness revision separates unmodified natural playback/screenshots from immediate keyboard skipping. It focuses the visible launch/replay button before the timed presentation, sends native Enter then Escape, and requires read-only event evidence that a trusted Escape was received while the corresponding presentation was active. No game timing, rendering or input handlers are replaced. Character inspection also includes a rear/side view and explicit factory character metadata, so the female ponytail is not hidden by a front-facing camera.

[Run 36943484021](https://github.com/pc007ya/Taipei_Ride/actions/runs/36943484021), commit `604704421e7f7158c2f75c924c595009cc33b77e`, passed verify, model inspection, runtime contacts, the complete delivery journey, portrait and landscape. Desktop passed gameplay, natural arrival, trusted immediate arrival skip, and the full dashboard/mouse/HUD test. Trusted title-skip evidence also passed on desktop. Its remaining long combined menu case exhausted the 240-second total budget at the subsequent, visible pause-settings button while continuing to make progress. The next revision retains all inputs and assertions but separates preferences/reload, title replay/skip, and journey return/reload into independently budgeted cases. No production runtime or asset changed between these validation refinements.

## Previous baseline: commit df30b3f

[Run 36885386269](https://github.com/pc007ya/Taipei_Ride/actions/runs/36885386269) completed successfully for commit `df30b3fae0e471c3553bef0ef93f7e788ae2336d`: 62 tests/build, three live WebGL viewport flows, and the complete normal-keyboard delivery journey. Desktop smoke took 2.3 minutes at 1440×960; delivery took 12.4 minutes at 1280×720. The actual drawing buffer adapted to scale 0.55 while CSS/UI dimensions remained unchanged. Reward, persistence and reset passed. This baseline predates the model, scale, collision and menu changes described above.

## Earlier passed local checks

- Clean lockfile install: `npm ci --ignore-scripts`
- `npm test`: 62 tests passed, 0 failed
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

## First visual refinement

- Original proportional human figures with articulated arms/legs, shoes and smaller heads; mounted and walking poses retain the existing camera visibility regressions
- Recognizable scooter shield, footboard, saddle, lights, mirrors, fork, exhaust and plate
- Authored sidewalk tile texture, segmented curbs and center-line markings
- Original Traditional Chinese storefront atlas plus batched arcade columns, awnings, glazing and shutters inside existing building footprints
- Repeated static details are instanced; decorative pedestrians use shared single-mesh geometry/materials
- Four added geometry/footprint tests bring the local suite to 56 passing tests; gameplay, collision rules and save schema are unchanged
- Offline geometry images are diagnostic only. This visual revision needs its own live WebGL CI evidence; successful screenshots from earlier commits do not establish its appearance

## Adaptive rendering correction

The visual revision's [run 36880136179](https://github.com/pc007ya/Taipei_Ride/actions/runs/36880136179), commit `672ba0bac190da8084caa7edbfe5d83f10572d93`, passed 56 unit tests/build, portrait and landscape browser flows, and the complete 1440×960 desktop smoke test (3.6 minutes). Its continuous desktop delivery route did **not** pass: after acceptance, pickup and the riding requirement, the 600-second final-road-leg budget ended around `(144.6, 849.8)`, approximately 162 game units before delivery. The 19-minute trace records continued movement, rather than a stationary collision deadlock. The separate reference job captured both desktop and portrait after Start without a CAPTCHA or JavaScript error.

The correction measures actual frame-to-frame wall time independently of simulation `dt`. A window needs at least three seconds, six frames and 70% slow frames before reducing the drawing pixel ratio by 20%, down to 0.55. Recovery requires twelve seconds of sustained fast frames, with smaller upward steps. Hidden tabs and isolated long hitches do not masquerade as sustained load. The WebGL renderer, world geometry, physics, quest distance and normal controls remain unchanged; the CSS/UI size and camera aspect stay at the viewport size.

Six independent controller/resize/render-state tests bring the local suite to 62 passing tests. Read-only snapshots report the effective pixel ratio, actual drawing-buffer size and CSS dimensions. Live browser tests now compare these metrics with the actual WebGL buffer, check the retained viewport size after orientation/size changes, and preserve all prior gameplay steps and assertions. The final road-route timeout has **not** been increased again. Successful final CI and clear new screenshots are required before claiming the adaptive revision passed.

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

Completed live checkpoint: [run 36877239121](https://github.com/pc007ya/Taipei_Ride/actions/runs/36877239121), commit `0a9eed6cb0d5844d9fb0363d65eaeb0d36d846ec`:

- All jobs completed successfully: 52 unit tests/build, portrait, landscape, desktop and the independent reference-capture job
- Desktop smoke passed at 1440×960 in 2.0 minutes
- The full original quest passed at 1280×720 in 10.8 minutes using normal keyboard input through the live renderer: acceptance, pickup, continuous road travel, required riding distance, mounted-delivery rejection, dismounting, delivery, exactly one 300-coin reward, reload persistence and full reset
- Successful desktop screenshots visibly show the parked scooter, walking delivery and the completed reward dialog; no WebGL calls, game clock or gameplay state were stubbed or rewritten
- The independent reference capture produced a genuine portrait screenshot after Start. Its desktop after-Start screenshot exceeded the 30-second capture budget, so no desktop-reference success is claimed
- The fixed official Noto font downloaded and matched its pinned integrity hash

These results establish this exact checkpoint. Later renderer or gameplay changes must pass their own CI run before reusing the result as current validation.

## Verification limits

DOM-flow tests simulate a document with jsdom and stub drawing calls. They are not real-browser end-to-end tests. Offline scene inspection is not a screenshot of the WebGL renderer.

The completed mobile-viewport Chromium results above are real browser rendering, but mobile emulation is not a physical-device test. Desktop and map-correction completion are established only for the exact successful checkpoint above. Hardware GPU performance, physical phone browsers and device-wide compatibility are not established by software-renderer CI or unit tests. The application automatically identifies and uses the separately labeled Canvas 2D compatibility renderer when WebGL initialization fails.

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

## Isolated material sample evidence

The opt-in `?sample=refined` study remains on an isolated preview branch. It changes the character, scooter materials and three existing street buildings; it is not an approval to replace the whole city or a claim of parity with the reference game.

First sample checkpoint: [`82d7119`](https://github.com/pc007ya/Taipei_Ride/commit/82d7119e97eae5a0af7809de7bc7ecc9a7184cdf), [run 36950826082](https://github.com/pc007ya/Taipei_Ride/actions/runs/36950826082):

- 165 unit tests/build and six actual Chromium WebGL comparison/control cases passed
- Neutral-light walker, mounted-rider and parked-scooter comparisons use identical camera, target, exposure, viewport and DPR 1 against the fixed `fafab1e` checkout
- Day street inspection preserves actor pose, camera, sun direction, exposure and drawing buffer. The new shadow/ambient/environment treatment is recorded explicitly rather than presented as unchanged lighting
- Normal application tests separately drive, brake, dismount, walk and turn with real keyboard input. Screenshots bracket a moving gait, and read-only foot-bone/shoe data verifies attachment
- Visual review found improved face/body continuity, scooter surfaces, paving and shop depth, but also standing hands intersecting the trousers
- Software-renderer performance regressed: roughly 5.15 to 1.50 observed FPS at the same 1440×960 CSS viewport and 0.55 drawing scale. The final actor locations differ by about seven world units, so these samples are a runtime warning rather than a controlled-pose benchmark

The follow-up performance fixture compares the fixed first sample against the new candidate with identical poses, frame-indexed movement, animation offsets, camera and 0.55 drawing scale. It records thirty render-to-next-`requestAnimationFrame` intervals after warm-up and transparently counts real Three.js shadow-map updates. Synchronous `render()` plus `gl.finish()` time is recorded separately: it did not include the browser's later canvas presentation delay on this Chromium runner, so it must not be converted into FPS. These controlled browser-frame measurements are distinct from normal gameplay FPS. A successful test only establishes valid rendering and matching inputs; the numeric cost and image quality must also be reviewed. Physical-device performance and wider-city suitability remain unverified.
