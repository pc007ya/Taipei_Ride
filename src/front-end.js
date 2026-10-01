import { createIntroTimeline } from './intro.js';
import { createSoundscape } from './audio.js';

const PREFERENCES_KEY = 'taipei-ride:menu:v1';
const TIPS = [
  ['停下機車，按 F 下車，走進街角的故事。', 'Stop and press F to get off your scooter and explore on foot.'],
  ['靠近人物後按 E，接下街區裡的小小委託。', 'Approach a resident and press E to accept a delivery.'],
  ['按 M 打開地圖，替下一段旅程選一個目的地。', 'Press M for the map and choose your next destination.'],
];

/** The presentation layer owns no quest, vehicle or player state. */
export function createFrontEnd({ getRenderer, onStart, onReturn, openDialog, closeDialog, isPlaying, getNight, setNight, getRenderMode, getAudioState = () => ({}), notify = () => {} }) {
  const $ = id => document.getElementById(id);
  let preferences = {}, preferenceWarning = false;
  try { preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}') || {}; } catch { /* Storage is optional. */ }
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let language = preferences.language === 'en' ? 'en' : 'zh';
  let appearance = preferences.appearance === 'river' ? 'river' : 'sunset';
  let quality = ['low', 'medium', 'high'].includes(preferences.quality) ? preferences.quality : 'auto';
  let reducedMotion = typeof preferences.reducedMotion === 'boolean' ? preferences.reducedMotion : Boolean(motionQuery?.matches);
  const audio = createSoundscape({ preferences: preferences.audio || {} });
  const timeline = createIntroTimeline({ reducedMotion });
  const choices = [...document.querySelectorAll('.front-choice')];
  const panels = ['character-dialog', 'settings-dialog', 'about-dialog'];
  let activeChoice = 0, previousPhase = '', lastTime = null, menuTime = 0, lastTip = -1;
  let panelOpener = null, settingsFromPause = false, disposed = false, appliedRenderer = null, menuView = 'city';

  function persist() {
    const { master, music, effects } = audio.snapshot();
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ language, reducedMotion, appearance, quality, audio: { master, music, effects } })); }
    catch { if (!preferenceWarning) { preferenceWarning = true; notify(language === 'zh' ? '選單設定目前無法儲存，重新整理後會恢復預設' : 'Menu settings cannot be saved in this browser.'); } }
  }
  function selectChoice(index, focus = false) {
    activeChoice = (index + choices.length) % choices.length;
    choices.forEach((button, i) => button.classList.toggle('selected', i === activeChoice));
    if (focus) choices[activeChoice].focus({ preventScroll: true });
  }
  function updateTip() {
    const index = Math.floor(menuTime / 8500) % TIPS.length;
    if (index === lastTip) return;
    lastTip = index;
    $('menu-tip').textContent = TIPS[index][language === 'en' ? 1 : 0];
  }
  function translate() {
    document.querySelectorAll('[data-zh][data-en]').forEach(element => { element.textContent = element.dataset[language]; });
    $('welcome').lang = language === 'en' ? 'en' : 'zh-Hant';
    for (const id of [...panels, 'help-dialog']) $(id).lang = $('welcome').lang;
    $('setting-language').value = language;
    $('setting-quality').value = quality;
    for (const [channel, labels] of Object.entries({ master: ['主音量', 'Master volume'], music: ['音樂音量', 'Music volume'], effects: ['音效音量', 'Sound effects'] })) $(`setting-${channel}`).setAttribute('aria-label', labels[language === 'en' ? 1 : 0]);
    $('setting-renderer').textContent = getRenderMode() === '3d' ? (language === 'zh' ? 'WebGL 3D · 自動畫質' : 'WebGL 3D · Adaptive') : (language === 'zh' ? 'Canvas 2D · 相容模式' : 'Canvas 2D · Compatibility');
    $('menu-language').setAttribute('aria-label', language === 'zh' ? '切換為英文選單' : 'Switch to Chinese menus');
    document.querySelectorAll('[data-front-back]').forEach(button => button.setAttribute('aria-label', language === 'zh' ? '返回' : 'Back'));
    $('help-done').textContent = isPlaying() ? '知道了，繼續' : language === 'zh' ? '返回主選單' : 'Back to menu';
    updateCharacters(); lastTip = -1; updateTip();
  }
  function updateCharacters() {
    document.querySelectorAll('[data-appearance]').forEach(button => {
      const selected = button.dataset.appearance === appearance;
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('.character-check').textContent = language === 'zh' ? (selected ? '已選擇' : '選擇') : (selected ? 'Selected' : 'Select');
    });
  }
  function setMenuView(view) {
    menuView = view;
    getRenderer()?.setMenuView?.(view);
  }
  function clearPanel() {
    document.body.classList.remove('front-submenu');
    setMenuView('city');
  }
  function render() {
    const { phase, orbit } = timeline.snapshot();
    if (previousPhase !== phase) {
      document.body.dataset.frontPhase = phase;
      $('skip-intro').hidden = phase !== 'intro';
      $('welcome').hidden = phase === 'playing';
    }
    document.body.classList.toggle('menu-reduced-motion', reducedMotion);
    // No saved night/position is changed for the title-screen camera.
    const renderer = getRenderer();
    if (renderer !== appliedRenderer) {
      renderer?.setQuality?.(quality); renderer?.setAppearance?.(appearance); renderer?.setMenuView?.(menuView); appliedRenderer = renderer;
    }
    renderer?.setIntroProgress?.(phase === 'playing' ? null : orbit);
    if (previousPhase !== phase && phase === 'menu' && document.activeElement === $('skip-intro')) choices[activeChoice].focus({ preventScroll: true });
    previousPhase = phase;
    updateTip();
  }
  function back() {
    if ($('settings-dialog').open && settingsFromPause) {
      settingsFromPause = false; openDialog('pause-dialog'); $('pause-settings').focus({ preventScroll: true }); return;
    }
    closeDialog(); clearPanel();
    if (!isPlaying()) (panelOpener || choices[activeChoice]).focus({ preventScroll: true });
  }
  function openPanel(id, opener, fromPause = false) {
    timeline.skip(); panelOpener = opener; settingsFromPause = id === 'settings-dialog' && fromPause;
    if (id === 'settings-dialog') {
      $('setting-night').checked = getNight();
      $('setting-motion').checked = reducedMotion;
      $('setting-quality').disabled = getRenderMode() !== '3d';
      for (const channel of ['master', 'music', 'effects']) {
        const value = Math.round(audio.snapshot()[channel] * 100);
        $(`setting-${channel}`).value = value; $(`${channel}-value`).textContent = `${value}%`;
      }
      // Replaying is a menu action, never a way to replace a paused game.
      $('replay-intro').hidden = fromPause;
    }
    render(); translate(); openDialog(id);
    if (!isPlaying()) document.body.classList.add('front-submenu');
    setMenuView(id === 'character-dialog' ? 'character' : 'city');
  }
  function start() {
    if (!timeline.play()) return;
    closeDialog(); clearPanel(); render(); onStart(); translate();
  }
  function returnToMenu() {
    if (!timeline.returnToMenu()) return;
    closeDialog(); clearPanel(); onReturn(); selectChoice(0); render(); translate(); choices[0].focus({ preventScroll: true });
  }
  function replay() {
    if (isPlaying()) return;
    closeDialog(); clearPanel(); timeline.replay(); lastTime = null; render();
    if (timeline.snapshot().phase === 'intro') $('skip-intro').focus({ preventScroll: true });
  }
  function fullscreenLabel() {
    $('menu-fullscreen').setAttribute('aria-label', document.fullscreenElement ? (language === 'zh' ? '離開全螢幕' : 'Exit fullscreen') : (language === 'zh' ? '進入全螢幕' : 'Enter fullscreen'));
    $('menu-fullscreen').setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
  }

  $('start').onclick = start;
  $('skip-intro').onclick = () => { timeline.skip(); render(); };
  $('menu-character').onclick = () => openPanel('character-dialog', $('menu-character'));
  $('menu-settings').onclick = () => openPanel('settings-dialog', $('menu-settings'));
  $('menu-controls').onclick = () => openPanel('help-dialog', $('menu-controls'));
  $('menu-about').onclick = () => openPanel('about-dialog', $('menu-about'));
  $('pause-settings').onclick = () => openPanel('settings-dialog', $('pause-settings'), true);
  $('return-menu').onclick = returnToMenu;
  for (const button of document.querySelectorAll('[data-appearance]')) button.onclick = () => {
    appearance = button.dataset.appearance === 'river' ? 'river' : 'sunset';
    getRenderer()?.setAppearance?.(appearance); updateCharacters(); persist();
  };
  $('help-done').onclick = back;
  $('replay-intro').onclick = replay;
  $('menu-language').onclick = () => { language = language === 'zh' ? 'en' : 'zh'; persist(); translate(); fullscreenLabel(); };
  $('setting-language').onchange = event => { language = event.target.value === 'en' ? 'en' : 'zh'; persist(); translate(); fullscreenLabel(); };
  $('setting-motion').onchange = event => { reducedMotion = event.target.checked; timeline.setReducedMotion(reducedMotion); persist(); render(); };
  $('setting-quality').onchange = event => { quality = ['low', 'medium', 'high'].includes(event.target.value) ? event.target.value : 'auto'; getRenderer()?.setQuality?.(quality); persist(); };
  for (const channel of ['master', 'music', 'effects']) $(`setting-${channel}`).oninput = event => {
    audio.setVolume(channel, Number(event.target.value) / 100); $(`${channel}-value`).textContent = `${Math.round(audio.snapshot()[channel] * 100)}%`; persist();
  };
  $('setting-night').onchange = event => { if (getNight() !== event.target.checked) setNight(); };
  $('menu-fullscreen').onclick = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else throw new Error('Fullscreen unavailable');
    } catch { notify(language === 'zh' ? '這個瀏覽器不支援全螢幕，仍可直接遊玩' : 'Fullscreen is unavailable here; you can still play.'); }
    fullscreenLabel();
  };
  document.addEventListener('fullscreenchange', fullscreenLabel);
  const activateAudio = () => { audio.activate().then(active => { if (active) audio.click(); }); };
  window.addEventListener('pointerdown', activateAudio);
  const activateAudioKey = event => { if (!event.repeat && ['Enter', 'Space'].includes(event.code)) activateAudio(); };
  window.addEventListener('keydown', activateAudioKey, true);
  const silenceAudio = () => { if (document.hidden) audio.silence(); };
  document.addEventListener('visibilitychange', silenceAudio);
  for (const button of document.querySelectorAll('[data-front-back]')) button.onclick = back;
  for (const id of panels) $(id).addEventListener('cancel', event => { event.preventDefault(); event.stopImmediatePropagation(); back(); }, true);
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) clearPanel(); });
  choices.forEach((button, index) => {
    button.addEventListener('pointerenter', () => selectChoice(index));
    button.addEventListener('focus', () => selectChoice(index));
  });
  function onKey(event) {
    if (isPlaying()) return;
    // Let each native dialog handle its own Escape and form keyboard behavior.
    if (document.querySelector('dialog[open]')) return;
    if (event.code === 'Escape' && timeline.snapshot().phase === 'intro') {
      event.preventDefault(); event.stopImmediatePropagation(); timeline.skip(); render(); return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.code)) {
      event.preventDefault(); event.stopImmediatePropagation(); timeline.skip(); render();
      selectChoice(event.code === 'Home' ? 0 : event.code === 'End' ? choices.length - 1 : activeChoice + (event.code === 'ArrowDown' ? 1 : -1), true); return;
    }
    if (event.code === 'Enter' && (document.activeElement === document.body || document.activeElement === $('world'))) {
      event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) choices[activeChoice].click(); return;
    }
    // No invisible map/night/driving shortcuts may mutate a saved journey.
    if (['KeyW','KeyA','KeyS','KeyD','KeyP','KeyM','KeyN','KeyR','KeyF','KeyE','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.stopImmediatePropagation();
  }
  window.addEventListener('keydown', onKey, true);
  function frame(timestamp) {
    if (disposed) return;
    audio.update({ playing: isPlaying(), ...getAudioState(), hidden: document.hidden });
    if (document.hidden) lastTime = null;
    else {
      const dt = lastTime === null ? 0 : Math.max(0, timestamp - lastTime); lastTime = timestamp;
      timeline.advance(dt);
      if (!isPlaying()) menuTime += dt;
      render();
    }
    requestAnimationFrame(frame);
  }
  timeline.ready(); translate(); fullscreenLabel(); render(); requestAnimationFrame(frame);
  return Object.freeze({ snapshot: () => ({ ...timeline.snapshot(), language, appearance, quality, audio: audio.snapshot() }), start, returnToMenu, replay,
    dispose() { disposed = true; audio.dispose(); window.removeEventListener('keydown', onKey, true); window.removeEventListener('keydown', activateAudioKey, true); window.removeEventListener('pointerdown', activateAudio); document.removeEventListener('visibilitychange', silenceAudio); document.removeEventListener('fullscreenchange', fullscreenLabel); } });
}
