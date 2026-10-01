const clamp = value => Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
export function deadzone(value, size = .2) {
  value = clamp(value);
  return Math.abs(value) <= size ? 0 : Math.sign(value) * (Math.abs(value) - size) / (1 - size);
}
const neutral = () => ({ throttle:false, reverse:false, left:false, right:false, brake:false });
const buttonValue = value => typeof value === 'object' && value !== null ? Math.max(value.pressed ? 1 : 0, Number(value.value) || 0) : Number(value) || 0;
const ACTIONS = { 0:'interact', 1:'back', 2:'reset', 3:'mount', 8:'map', 9:'pause', 12:'menuUp', 13:'menuDown', 14:'menuLeft', 15:'menuRight' };

/** Standard browser Gamepad API adapter. It owns no game or camera state. */
export function createGamepadInput({ getGamepads = () => globalThis.navigator?.getGamepads?.() || [] } = {}) {
  let currentId = null, previousButtons = [], releaseRequired = true, blockedLast = true;
  let latest = { connected:false, label:'', movement:neutral(), look:{x:0,y:0}, actions:[] };
  const snapshot = () => ({ ...latest, movement:{...latest.movement}, look:{...latest.look}, actions:[...latest.actions], releaseRequired });
  function clear() {
    releaseRequired = true;
    latest = { ...latest, movement:neutral(), look:{x:0,y:0}, actions:[] };
  }
  function poll({ enabled = false, paused = false, cinematic = false } = {}) {
    let pads;
    try { pads = Array.from(getGamepads() || []); } catch { pads = []; }
    const pad = pads.find(p => p?.connected !== false && p && Array.isArray(p.axes) && p.buttons);
    if (!pad) {
      currentId = null; previousButtons = []; releaseRequired = true; blockedLast = true;
      latest = { connected:false, label:'', movement:neutral(), look:{x:0,y:0}, actions:[] };
      return snapshot();
    }
    const id = `${pad.index ?? 0}:${pad.id || 'Gamepad'}`;
    const buttons = Array.from(pad.buttons, b => buttonValue(b) > .5);
    if (currentId !== id) { currentId = id; previousButtons = []; releaseRequired = true; }
    const actions = Object.entries(ACTIONS).filter(([index]) => buttons[index] && !previousButtons[index]).map(([,action]) => action);
    previousButtons = buttons;
    const x = deadzone(pad.axes[0]), y = deadzone(pad.axes[1]);
    const look = { x:deadzone(pad.axes[2]), y:deadzone(pad.axes[3]) };
    const rt = buttonValue(pad.buttons[7]), lt = buttonValue(pad.buttons[6]);
    const blocked = !enabled || paused || cinematic;
    if (blocked || blockedLast !== blocked) releaseRequired = true;
    // A held trigger/stick cannot resume movement immediately after a pause,
    // reconnect or cutscene. A fresh neutral sample re-arms the input source.
    if (!blocked && x === 0 && y === 0 && look.x === 0 && look.y === 0 && rt < .15 && lt < .15) releaseRequired = false;
    blockedLast = blocked;
    const movement = neutral();
    if (!blocked && !releaseRequired) {
      movement.throttle = y < -.1 || rt > .15;
      movement.reverse = y > .1;
      movement.left = x < -.1;
      movement.right = x > .1;
      movement.brake = lt > .15;
    }
    latest = { connected:true, label:String(pad.id || 'Standard gamepad'), movement, look:blocked || releaseRequired ? {x:0,y:0} : look, actions:cinematic ? actions.filter(a => a === 'back' || a === 'pause') : actions };
    return snapshot();
  }
  return { poll, clear, snapshot };
}
