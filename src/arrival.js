// Original first-arrival scene; presentation only, never a quest transition.
export const ARRIVAL_DURATION_MS = 8400;
export function createArrivalTimeline() {
 let active=false, elapsed=0;
 const stage=()=>elapsed<1500?'arriving':elapsed<6000?'greeting':'chapter';
 return Object.freeze({
  begin(){if(active)return false;active=true;elapsed=0;return true;},
  advance(milliseconds){if(!active||!Number.isFinite(milliseconds)||milliseconds<0)return false;elapsed=Math.min(ARRIVAL_DURATION_MS,elapsed+milliseconds);if(elapsed===ARRIVAL_DURATION_MS){active=false;return true;}return false;},
  skip(){if(!active)return false;active=false;elapsed=ARRIVAL_DURATION_MS;return true;},
  snapshot:()=>({active,elapsed,progress:elapsed/ARRIVAL_DURATION_MS,stage:stage()}),
 });
}
