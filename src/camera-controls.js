const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function createLookController(){
 let yaw=0,pitch=0,sensitivity=1,invertY=false;
 return {
  configure(value={}){sensitivity=Number.isFinite(value.sensitivity)?clamp(value.sensitivity,.2,3):1;invertY=value.invertY===true;},
  adjust(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy))return;yaw=Math.atan2(Math.sin(yaw+dx*.004*sensitivity),Math.cos(yaw+dx*.004*sensitivity));pitch=clamp(pitch+dy*.003*sensitivity*(invertY?-1:1),-.19,.8);},
  reset(){yaw=0;pitch=0;},
  snapshot(){return {yaw,pitch,sensitivity,invertY};}
 };
}
