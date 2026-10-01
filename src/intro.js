// An independent, interruptible presentation timeline. This never owns or
// changes gameplay state: saved positions and quest progress stay untouched.
export const INTRO_DURATION_MS = 2400;
export const MENU_ORBIT_MS = 36000;

export function createIntroTimeline({ reducedMotion = false } = {}) {
  let phase = 'loading', elapsed = 0, orbit = 0;
  return {
    ready() { if (phase !== 'loading') return false; phase = reducedMotion ? 'menu' : 'intro'; return true; },
    advance(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0 || phase === 'loading' || phase === 'playing') return;
      if (!reducedMotion) orbit = (orbit + milliseconds) % MENU_ORBIT_MS;
      if (phase === 'intro') {
        elapsed = Math.min(INTRO_DURATION_MS, elapsed + milliseconds);
        if (elapsed >= INTRO_DURATION_MS) phase = 'menu';
      }
    },
    skip() { if (phase !== 'intro') return false; elapsed = INTRO_DURATION_MS; phase = 'menu'; return true; },
    play() { if (phase === 'playing' || phase === 'loading') return false; phase = 'playing'; return true; },
    returnToMenu() { if (phase !== 'playing') return false; phase = 'menu'; elapsed = INTRO_DURATION_MS; return true; },
    replay() { if (phase === 'loading' || phase === 'playing') return false; phase = reducedMotion ? 'menu' : 'intro'; elapsed = 0; orbit = 0; return true; },
    setReducedMotion(value) { reducedMotion = Boolean(value); if (reducedMotion && phase === 'intro') { phase = 'menu'; elapsed = INTRO_DURATION_MS; } },
    snapshot() { return { phase, progress: elapsed / INTRO_DURATION_MS, orbit: reducedMotion ? .12 : orbit / MENU_ORBIT_MS, reducedMotion }; },
  };
}
