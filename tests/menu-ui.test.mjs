import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createFrontEnd } from '../src/front-end.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function setup({ reducedMotion = false, blockedStorage = false } = {}) {
  const dom = new JSDOM(html, { url: 'https://taipei-ride.test/', pretendToBeVisual: true });
  const { window } = dom;
  for (const key of ['window', 'document', 'localStorage']) globalThis[key] = window[key];
  window.matchMedia = () => ({ matches: reducedMotion });
  let queued = [], time = 0, playing = false, paused = false, night = false, starts = 0, returns = 0, saves = 0;
  const camera = [], messages = [], progress = { quest: 'carrying', coins: 300, stamps: ['market'], position: [410, 710] };
  globalThis.requestAnimationFrame = callback => { queued.push(callback); return queued.length; };
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  if (blockedStorage) {
    window.Storage.prototype.getItem = () => { throw new Error('blocked'); };
    window.Storage.prototype.setItem = () => { throw new Error('blocked'); };
  }
  const $ = id => document.getElementById(id);
  const close = () => { for (const dialog of document.querySelectorAll('dialog')) if (dialog.open) dialog.close(); paused = false; };
  const open = id => { close(); $(id).showModal(); paused = true; };
  const menu = createFrontEnd({ getRenderer: () => ({ setIntroProgress: value => camera.push(value) }),
    onStart: () => { starts++; playing = true; document.body.classList.add('playing'); },
    onReturn: () => { returns++; saves++; playing = false; document.body.classList.remove('playing'); },
    openDialog: open, closeDialog: close, isPlaying: () => playing, getNight: () => night,
    setNight: () => { night = !night; saves++; }, getRenderMode: () => '3d', notify: message => messages.push(message) });
  return { $, menu, camera, progress, messages, snapshot: () => ({ playing, paused, night, starts, returns, saves }),
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
  assert.equal(f.$('setting-language').value, 'en');
  assert.equal(f.$('setting-motion').checked, true);
  f.$('setting-motion').checked = false; f.$('setting-motion').dispatchEvent(new window.Event('change'));
  assert.equal(f.menu.snapshot().reducedMotion, false);
  f.$('setting-night').checked = true; f.$('setting-night').dispatchEvent(new window.Event('change'));
  assert.equal(f.snapshot().night, true);
  assert.equal(f.snapshot().saves, 1);
  assert.deepEqual(JSON.parse(localStorage.getItem('taipei-ride:menu:v1')), { language: 'en', reducedMotion: false, appearance: 'sunset', quality: 'auto', audio: {master: .65, music: .3, effects: .6} });
  f.$('setting-quality').value = 'low'; f.$('setting-quality').dispatchEvent(new window.Event('change'));
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
