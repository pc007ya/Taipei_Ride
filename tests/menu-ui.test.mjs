import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createFrontEnd } from '../src/front-end.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function setup({ reducedMotion = false, blockedStorage = false, firstArrival = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://taipei-ride.test/', pretendToBeVisual: true });
  const { window } = dom;
  for (const key of ['window', 'document', 'localStorage']) globalThis[key] = window[key];
  window.matchMedia = () => ({ matches: reducedMotion });
  let queued = [], time = 0, playing = false, paused = false, night = false, starts = 0, returns = 0, saves = 0;
  const camera = [], appearanceCalls = [], lookCalls = [], cinemaCalls = [], messages = [], progress = { quest: 'carrying', coins: 300, stamps: ['market'], position: [410, 710] };
  globalThis.requestAnimationFrame = callback => { queued.push(callback); return queued.length; };
  globalThis.devicePixelRatio = 1;
  const context = new Proxy({}, {get: () => () => {}, set: () => true});
  window.HTMLCanvasElement.prototype.getContext = () => context;
  window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({width:164,height:164});
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  if (blockedStorage) {
    window.Storage.prototype.getItem = () => { throw new Error('blocked'); };
    window.Storage.prototype.setItem = () => { throw new Error('blocked'); };
  }
  const $ = id => document.getElementById(id);
  const close = () => { for (const dialog of document.querySelectorAll('dialog')) if (dialog.open) dialog.close(); paused = false; };
  const open = id => { close(); $(id).showModal(); paused = true; };
  const menu = createFrontEnd({ getRenderer: () => ({ setIntroProgress: value => camera.push(value), setAppearance: value => appearanceCalls.push(value), setLookSettings: value => lookCalls.push(value) }),
    shouldPlayArrival: () => firstArrival, setCinematicActive: value => { paused = value; cinemaCalls.push(value); },
    getJourneySnapshot: () => ({player:{x:progress.position[0],y:progress.position[1],angle:0,distance:1200},vehicle:{x:800,y:515},mode:'riding',stamps:progress.stamps,coins:progress.coins,quest:{stage:progress.quest}}),
    onStart: () => { starts++; playing = true; document.body.classList.add('playing'); },
    onReturn: () => { returns++; saves++; playing = false; document.body.classList.remove('playing'); },
    openDialog: open, closeDialog: close, isPlaying: () => playing, getNight: () => night,
    setNight: () => { night = !night; saves++; }, getRenderMode: () => '3d', notify: message => messages.push(message) });
  return { $, menu, camera, appearanceCalls, lookCalls, cinemaCalls, progress, messages, snapshot: () => ({ playing, paused, night, starts, returns, saves }),
    frame(ms = 20) { time += ms; const callbacks = queued; queued = []; callbacks.forEach(callback => callback(time)); },
    key(code, repeat = false) { window.dispatchEvent(new window.KeyboardEvent('keydown', { code, repeat, bubbles: true, cancelable: true })); },
    cancel(id) { $(id).dispatchEvent(new window.Event('cancel', { cancelable: true })); },
    cleanup() { menu.dispose(); dom.window.close(); } };
}

test('intro skips to menu, replay starts fresh, and repeated start is idempotent', () => {
  const f = setup();
  assert.equal(f.menu.snapshot().phase, 'intro');
  assert.equal(f.$('skip-intro').hidden, false);
  f.key('Escape');
  assert.equal(f.menu.snapshot().phase, 'menu');
  f.$('menu-settings').click();
  assert.equal(f.$('settings-dialog').open, true);
  f.$('replay-intro').click();
  assert.equal(f.$('settings-dialog').open, false);
  assert.equal(f.menu.snapshot().phase, 'intro');
  assert.equal(document.activeElement.id, 'skip-intro');
  f.$('skip-intro').click(); f.$('skip-intro').click();
  assert.equal(f.menu.snapshot().phase, 'menu');
  f.$('start').click(); f.$('start').click();
  assert.equal(f.snapshot().starts, 1);
  assert.equal(f.menu.snapshot().phase, 'playing');
  assert.equal(f.camera.at(-1), null);
  assert.equal(f.$('welcome').hidden, true);
  f.cleanup();
});

test('character, controls and about return without auto-start or changing progress', () => {
  const f = setup(); f.key('Escape');
  const before = structuredClone(f.progress);
  for (const [button, dialog] of [['menu-character', 'character-dialog'], ['menu-controls', 'help-dialog'], ['menu-about', 'about-dialog']]) {
    f.$(button).click();
    assert.equal(f.$(dialog).open, true);
    if (dialog === 'help-dialog') f.$('help-done').click(); else f.cancel(dialog);
    assert.equal(f.$(dialog).open, false);
    assert.equal(f.snapshot().playing, false);
    assert.equal(f.snapshot().starts, 0);
    assert.equal(document.activeElement.id, button);
  }
  f.$('menu-character').click(); document.querySelector('[data-appearance=river]').click(); f.cancel('character-dialog');
  assert.equal(f.menu.snapshot().appearance, 'river');
  assert.equal(JSON.parse(localStorage.getItem('taipei-ride:menu:v1')).appearance, 'river');
  assert.deepEqual(f.progress, before);
  assert.equal(document.querySelectorAll('[data-appearance]').length, 2, 'Both implemented original characters are offered');
  f.cleanup();
});

test('pause settings returns to pause, and returning to menu preserves progress', () => {
  const f = setup(); f.$('start').click();
  const before = structuredClone(f.progress);
  f.$('pause-settings').click();
  assert.equal(f.snapshot().paused, true);
  assert.equal(f.$('replay-intro').hidden, true);
  f.cancel('settings-dialog');
  assert.equal(f.$('pause-dialog').open, true);
  assert.equal(f.snapshot().paused, true);
  f.$('return-menu').click(); f.$('return-menu').click();
  assert.equal(f.snapshot().returns, 1);
  assert.equal(f.snapshot().saves, 1);
  assert.equal(f.snapshot().playing, false);
  assert.equal(f.snapshot().paused, false);
  assert.equal(f.menu.snapshot().phase, 'menu');
  assert.deepEqual(f.progress, before);
  f.$('start').click();
  assert.equal(f.snapshot().starts, 2);
  assert.deepEqual(f.progress, before);
  f.cleanup();
});

test('language, night and reduced-motion controls work and persist validated preferences', () => {
  const f = setup({ reducedMotion: true });
  assert.equal(f.menu.snapshot().phase, 'menu');
  f.$('menu-language').click();
  assert.equal(f.$('menu-settings').querySelector('b').textContent, 'Settings');
  assert.equal(f.menu.snapshot().language, 'en');
  f.$('menu-settings').click();
  assert.equal(document.querySelector('#setting-language input:checked').value, 'en');
  assert.equal(f.$('setting-motion').checked, true);
  f.$('setting-motion').checked = false; f.$('setting-motion').dispatchEvent(new window.Event('change'));
  assert.equal(f.menu.snapshot().reducedMotion, false);
  f.$('setting-night').checked = true; f.$('setting-night').dispatchEvent(new window.Event('change'));
  assert.equal(f.snapshot().night, true);
  assert.equal(f.snapshot().saves, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem('taipei-ride:menu:v1')), { language: 'en', reducedMotion: false, appearance: 'sunset', quality: 'auto', showFps:false, hudScale:1, sensitivity:1, invertY:false, hints:true, arrivalSeen:false, audio: {master: .8, music: .6, effects: .9} });
  document.querySelector('#setting-quality input[value=low]').click();
  f.$('setting-master').value = '20'; f.$('setting-master').dispatchEvent(new window.Event('input'));
  assert.equal(f.menu.snapshot().quality, 'low');
  assert.equal(f.menu.snapshot().audio.master, .2);
  assert.equal(f.$('master-value').textContent, '20%');
  f.$('replay-intro').click(); f.frame(); f.frame(2500);
  assert.equal(f.menu.snapshot().phase, 'menu');
  f.cleanup();
});

test('keyboard navigation wraps, and hidden gameplay shortcuts do not escape the menu', () => {
  const f = setup(); let leaked = 0;
  window.addEventListener('keydown', () => leaked++);
  f.key('ArrowUp');
  assert.equal(document.activeElement.id, 'menu-about');
  f.key('ArrowDown');
  assert.equal(document.activeElement.id, 'start');
  f.key('End'); assert.equal(document.activeElement.id, 'menu-about');
  f.key('Home'); assert.equal(document.activeElement.id, 'start');
  for (const key of ['KeyW', 'KeyN', 'KeyR', 'KeyM', 'KeyF', 'KeyE']) f.key(key);
  assert.equal(leaked, 0);
  assert.equal(f.snapshot().playing, false);
  f.cleanup();
});

test('blocked preferences and unsupported fullscreen fail gracefully without trapping the menu', async () => {
  const f = setup({ blockedStorage: true });
  f.$('menu-language').click(); f.$('menu-language').click();
  assert.equal(f.messages.length, 1);
  f.$('menu-fullscreen').click(); await Promise.resolve();
  assert.equal(f.messages.length, 2);
  assert.match(f.messages.at(-1), /全螢幕/);
  f.$('start').click();
  assert.equal(f.snapshot().playing, true);
  f.cleanup();
});


test('new arrival locks play, skips once, and never replays on continuing the same journey', () => {
 const f=setup({firstArrival:true});const before=structuredClone(f.progress);
 f.$('start').click();assert.equal(f.menu.snapshot().arrival.active,true);assert.equal(f.snapshot().paused,true);assert.equal(f.$('arrival-intro').hidden,false);
 f.key('KeyW');f.key('KeyP');assert.equal(f.menu.snapshot().arrival.active,true);
 f.key('Escape');assert.equal(f.menu.snapshot().arrival.active,false);assert.equal(f.snapshot().paused,false);assert.equal(f.$('arrival-intro').hidden,true);assert.deepEqual(f.cinemaCalls,[true,false]);
 f.$('skip-arrival').click();assert.deepEqual(f.cinemaCalls,[true,false]);assert.equal(f.menu.snapshot().arrivalSeen,true);assert.deepEqual(f.progress,before);
 f.$('return-menu').click();f.$('start').click();assert.equal(f.menu.snapshot().arrival.active,false);assert.deepEqual(f.cinemaCalls,[true,false]);f.cleanup();
});

test('arrival completes naturally, reduced motion works, and saved players do not see it', () => {
 const f=setup({firstArrival:true,reducedMotion:true});f.$('start').click();f.frame();f.frame(1800);assert.equal(f.menu.snapshot().arrival.stage,'greeting');f.frame(5000);assert.equal(f.menu.snapshot().arrival.stage,'chapter');f.frame(1700);assert.equal(f.menu.snapshot().arrival.active,false);assert.equal(f.snapshot().paused,false);assert.equal(f.menu.snapshot().arrivalSeen,true);f.cleanup();
 const resumed=setup({firstArrival:false});resumed.$('start').click();assert.equal(resumed.menu.snapshot().arrival.active,false);assert.equal(resumed.snapshot().paused,false);resumed.cleanup();
});

test('HUD size, measured FPS, camera preferences and tutorial controls apply real state', () => {
 const f=setup();f.$('menu-settings').click();
 for(const [id,value]of [['hud','115'],['look','180']]){f.$(`setting-${id}`).value=value;f.$(`setting-${id}`).dispatchEvent(new window.Event('input'));}
 assert.equal(f.menu.snapshot().hudScale,1.15);assert.equal(document.body.style.getPropertyValue('--hud-scale'),'1.15');assert.equal(f.menu.snapshot().sensitivity,1.8);
 f.$('setting-invert-y').click();assert.equal(f.menu.snapshot().invertY,true);assert.deepEqual(f.lookCalls.at(-1),{sensitivity:1.8,invertY:true});
 f.$('setting-fps').click();assert.equal(f.$('fps-readout').hidden,false);f.frame();for(let i=0;i<30;i++)f.frame(20);assert.match(f.$('fps-readout').textContent,/FPS \d+/);
 f.$('setting-hints').click();assert.equal(f.menu.snapshot().hints,false);assert.ok(document.body.classList.contains('hide-tutorial-hints'));f.$('reset-hints').click();assert.equal(f.menu.snapshot().hints,true);assert.ok(document.body.classList.contains('show-tutorial-hints'));
 document.querySelector('#setting-quality input[value=ultra]').click();assert.equal(f.menu.snapshot().quality,'ultra');f.cleanup();
});

test('controls diagrams switch accessible tabs, and stats/map return to pause', () => {
 const f=setup();f.$('menu-controls').click();assert.equal(f.$('control-panel-0').hidden,false);f.$('control-tab-1').click();assert.equal(f.$('control-panel-1').hidden,false);assert.equal(f.$('control-panel-0').hidden,true);f.$('control-tab-1').dispatchEvent(new window.KeyboardEvent('keydown',{code:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(f.$('control-panel-2').hidden,false);assert.equal(document.activeElement.id,'control-tab-2');f.$('help-done').click();
 f.$('start').click();f.$('pause-stats').click();assert.equal(f.$('stats-coins').textContent,'300');assert.equal(f.$('stats-distance').textContent,'0.12 km');f.cancel('stats-dialog');assert.equal(f.$('pause-dialog').open,true);assert.equal(f.snapshot().paused,true);f.$('pause-map').click();assert.equal(f.$('map-dialog').open,true);f.cancel('map-dialog');assert.equal(f.$('pause-dialog').open,true);assert.equal(f.snapshot().paused,true);f.cleanup();
});
