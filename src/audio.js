// Original, locally synthesized music and sound effects. No audio recordings,
// external downloads, autoplay bypasses, or reference-game assets are used.
export const DEFAULT_AUDIO = Object.freeze({ master: .8, music: .6, effects: .9 });
export const clampVolume = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : 0;
const NOTES = [60, 64, 67, 71, 69, 67, 64, 62, 57, 60, 64, 67, 65, 64, 62, 59];
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

export function createSoundscape({ AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext, preferences = {} } = {}) {
  const volumes = Object.fromEntries(Object.entries(DEFAULT_AUDIO).map(([key, fallback]) => [key, preferences[key] === undefined ? fallback : clampVolume(preferences[key])]));
  let context = null, master, music, effects, engine, engineGain, stopped = false, nextNote = 0, note = 0, available = Boolean(AudioContext);

  function smooth(node, value, seconds = .08) {
    if (!context || !node) return;
    node.gain.cancelScheduledValues(context.currentTime);
    node.gain.setTargetAtTime(value, context.currentTime, seconds);
  }
  function tone(midi, at, duration, gain = .12, destination = music) {
    const oscillator = context.createOscillator(), envelope = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency(midi);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + .02);
    envelope.gain.exponentialRampToValueAtTime(.001, at + duration);
    oscillator.connect(envelope); envelope.connect(destination);
    oscillator.start(at); oscillator.stop(at + duration + .03);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  async function activate() {
    if (stopped || !available) return false;
    try {
      if (!context) {
        context = new AudioContext();
        master = context.createGain(); music = context.createGain(); effects = context.createGain();
        master.gain.value = volumes.master; music.gain.value = volumes.music; effects.gain.value = volumes.effects;
        master.connect(context.destination); music.connect(master); effects.connect(master);
        engine = context.createOscillator(); engine.type = 'triangle'; engine.frequency.value = 45;
        engineGain = context.createGain(); engineGain.gain.value = 0;
        const lowpass = context.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 240;
        engine.connect(lowpass); lowpass.connect(engineGain); engineGain.connect(effects); engine.start();
        nextNote = context.currentTime + .08;
      }
      if (context.state === 'suspended') await context.resume();
      return context.state === 'running';
    } catch { available = false; return false; }
  }
  return Object.freeze({
    activate,
    setVolume(channel, value) {
      if (!(channel in volumes)) return;
      volumes[channel] = clampVolume(value);
      smooth(channel === 'master' ? master : channel === 'music' ? music : effects, volumes[channel]);
    },
    click() {
      if (!context || context.state !== 'running' || stopped) return;
      tone(79, context.currentTime, .065, .08, effects);
    },
    update({ playing = false, paused = false, speed = 0, walking = false, hidden = false } = {}) {
      if (!context || context.state !== 'running' || stopped) return;
      // Tab suspension and pause cannot leave an engine note sounding.
      const active = playing && !paused && !hidden && !walking;
      smooth(engineGain, active ? .012 + Math.min(1, Math.abs(speed) / 72) * .038 : 0);
      engine.frequency.setTargetAtTime(40 + Math.min(90, Math.abs(speed) * 1.3), context.currentTime, .13);
      if (hidden || paused) { smooth(music, 0); nextNote = context.currentTime + .15; return; }
      smooth(music, volumes.music);
      if (nextNote < context.currentTime - .1) nextNote = context.currentTime + .06;
      // One original, quiet pentatonic-like bell phrase, scheduled from the
      // audio clock rather than speed-dependent game-frame timing.
      while (nextNote < context.currentTime + .12) {
        const pitch = NOTES[note % NOTES.length];
        tone(pitch, nextNote, 1.45, .11);
        if (note % 4 === 0) tone(pitch - 24, nextNote, 2.1, .15);
        note++; nextNote += .67;
      }
    },
    silence() { smooth(engineGain, 0, .02); smooth(music, 0, .03); },
    snapshot: () => ({ ...volumes, available, activated: Boolean(context), running: context?.state === 'running' }),
    async dispose() { stopped = true; try { engine?.stop(); await context?.close(); } catch { /* Already closed. */ } },
  });
}
