import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundscape, clampVolume, DEFAULT_AUDIO } from '../src/audio.js';

test('audio preferences are clamped and unsupported audio does not break play', async () => {
  assert.equal(clampVolume(-1), 0); assert.equal(clampVolume(3), 1); assert.equal(clampVolume(NaN), 0);
  const sound = createSoundscape({ AudioContext: null, preferences: { master: 4, music: -.5 } });
  assert.deepEqual(sound.snapshot(), { master: 1, music: 0, effects: DEFAULT_AUDIO.effects, available: false, activated: false, running: false });
  assert.equal(await sound.activate(), false);
  sound.update({ playing: true, speed: 60 }); sound.click(); sound.silence();
  sound.setVolume('effects', .25); sound.setVolume('not-a-channel', .4);
  assert.equal(sound.snapshot().effects, .25);
  await sound.dispose();
});

test('sound starts only on explicit activation, honors all volumes, and silences paused play', async () => {
  let constructed = 0; const gains = [], tones = [];
  const parameter = value => ({ value, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; }, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } });
  class Context {
    constructor() { constructed++; this.state = 'suspended'; this.currentTime = 10; this.destination = {}; }
    createGain() { const node = { gain: parameter(1), connect() {}, disconnect() {} }; gains.push(node); return node; }
    createOscillator() { const node = { frequency: parameter(440), connect() {}, disconnect() {}, start() { tones.push(this); }, stop() {} }; return node; }
    createBiquadFilter() { return { frequency: parameter(0), connect() {} }; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const sound = createSoundscape({ AudioContext: Context });
  sound.update({ playing: true }); assert.equal(constructed, 0);
  assert.equal(await sound.activate(), true); assert.equal(constructed, 1);
  await sound.activate(); assert.equal(constructed, 1);
  sound.setVolume('master', .22); sound.setVolume('music', .33); sound.setVolume('effects', .44);
  assert.equal(gains[0].gain.value, .22); assert.equal(gains[1].gain.value, .33); assert.equal(gains[2].gain.value, .44);
  sound.update({ playing: true, speed: 30 }); assert.ok(gains[3].gain.value > 0); assert.ok(tones.length > 1);
  sound.update({ playing: true, paused: true }); assert.equal(gains[3].gain.value, 0); assert.equal(gains[1].gain.value, 0);
  sound.update({ playing: true, walking: true }); assert.equal(gains[3].gain.value, 0); assert.equal(gains[1].gain.value, .33);
  sound.silence(); assert.equal(gains[1].gain.value, 0);
  await sound.dispose(); assert.equal(sound.snapshot().running, false);
  assert.equal(await sound.activate(), false);
});
