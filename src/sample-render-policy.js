// Cache an unchanged shadow map. Motion, gait, cargo and quality invalidate it;
// frame rate and test/browser identity never affect the rules.
export function createSampleShadowPolicy(){
 let previous='',count=0;
 return {sample({state,time=0,appearance='sunset',quality='auto',scale=1,revision=0,visibility=''}){
  const size=quality==='low'||scale<=.75?512:1024,p=state.player,v=state.vehicle||p;
  const q=n=>Math.round((Number.isFinite(n)?n:0)*1000),gait=state.mode==='walking'&&Math.abs(p.actualSpeed??p.speed)>.01?Math.round(time*24):0;
  const signature=[size,revision,visibility,appearance,state.mode,state.quest?.stage,q(p.x),q(p.y),q(p.angle),q(v.x),q(v.y),q(v.angle),gait].join(':');
  const refresh=signature!==previous;if(refresh){previous=signature;count++;}return {refresh,size,refreshCount:count,strategy:'cache-unchanged-local-map; moving-actor-and-gait-invalidate'};
 }};
}
