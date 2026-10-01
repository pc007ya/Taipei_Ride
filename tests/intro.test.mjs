import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntroTimeline, INTRO_DURATION_MS, MENU_ORBIT_MS } from '../src/intro.js';

test('loading, introduction, menu and gameplay transitions are explicit and idempotent', () => {
  const intro = createIntroTimeline();
  assert.equal(intro.snapshot().phase, 'loading');
  assert.equal(intro.play(), false);
  assert.equal(intro.skip(), false);
  assert.equal(intro.ready(), true);
  assert.equal(intro.ready(), false);
  intro.advance(INTRO_DURATION_MS - 1);
  assert.equal(intro.snapshot().phase, 'intro');
  intro.advance(1);
  assert.equal(intro.snapshot().phase, 'menu');
  assert.equal(intro.play(), true);
  assert.equal(intro.play(), false);
  const playing = intro.snapshot();
  intro.advance(MENU_ORBIT_MS);
  assert.deepEqual(intro.snapshot(), playing);
  assert.equal(intro.returnToMenu(), true);
  assert.equal(intro.returnToMenu(), false);
  assert.equal(intro.snapshot().phase, 'menu');
});

test('skip, repeat replay and cancellation cannot enter gameplay or carry a stale timer', () => {
  const intro = createIntroTimeline();
  intro.ready();
  assert.equal(intro.skip(), true);
  assert.equal(intro.skip(), false);
  assert.equal(intro.replay(), true);
  intro.advance(1000);
  assert.equal(intro.replay(), true);
  assert.equal(intro.snapshot().progress, 0);
  intro.advance(1400);
  assert.equal(intro.snapshot().phase, 'intro');
  intro.skip();
  assert.equal(intro.snapshot().phase, 'menu');
  intro.play();
  assert.equal(intro.replay(), false);
});

test('reduced motion keeps a still menu and handles a preference change during intro', () => {
  const intro = createIntroTimeline({ reducedMotion: true });
  intro.ready();
  assert.equal(intro.snapshot().phase, 'menu');
  const before = intro.snapshot();
  intro.advance(9000);
  assert.deepEqual(intro.snapshot(), before);
  intro.setReducedMotion(false);
  intro.replay();
  intro.advance(1000);
  intro.setReducedMotion(true);
  assert.equal(intro.snapshot().phase, 'menu');
  intro.play();
  intro.setReducedMotion(false);
  assert.equal(intro.snapshot().phase, 'playing');
});

test('invalid elapsed times cannot corrupt camera motion', () => {
  const intro = createIntroTimeline();
  intro.ready();
  for (const elapsed of [NaN, Infinity, -1, undefined]) intro.advance(elapsed);
  assert.equal(intro.snapshot().progress, 0);
  assert.equal(intro.snapshot().orbit, 0);
  intro.advance(MENU_ORBIT_MS + 9000);
  assert.equal(intro.snapshot().orbit, .25);
  assert.equal(intro.snapshot().progress, 1);
});
