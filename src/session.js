import { START, LANDMARKS, createPlayer, cleanProgress, poseCollides, collisionBody, bodiesOverlap, toMetres, distance, clamp, findDismountPosition } from './world.js';
export const SAVE_KEY = 'taipei-ride:v2';
export const LEGACY_SAVE_KEY = 'taipei-ride:v1';
export const QUEST_REWARD = 300;
export const REQUIRED_RIDE_DISTANCE = 100;
export const QUEST_STATIONS = {
 giver:{id:'tea-giver',name:'阿沐茶舖',en:'A CUP AFTER THE RAIN',x:800,y:410,color:'#ffdd8c',stamp:'茶',type:'quest',info:'老街的修傘師傅忙了一整天。替他送去一杯熱茶吧。'},
 pickup:{id:'tea-pickup',name:'街角取貨點',en:'PICK UP THE TEA',x:1120,y:690,color:'#ffdd8c',stamp:'取',type:'quest',info:'茶已經裝好了，請帶上機車，送到老街修傘攤。'},
 delivery:{id:'tea-delivery',name:'老街修傘攤',en:'DELIVER ON FOOT',x:160,y:1020,color:'#ffdd8c',stamp:'傘',type:'quest',info:'到了以後先停車，再走近師傅，把熱茶親手交給他。'}
};
const stages=['available','pickup','carrying','deliver','completed'];
const finite=(n,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
const heading=n=>{n=finite(n,START.angle);return Math.atan2(Math.sin(n),Math.cos(n));};
function safePose(raw,world,kind){
 if(!raw||typeof raw!=='object'||!Number.isFinite(raw.x)||!Number.isFinite(raw.y))return {...START};
 const pose={x:raw.x,y:raw.y,angle:heading(raw.angle)};
 return poseCollides(pose,kind,world)?{...START}:pose;
}
function cleanQuest(raw){
 let stage=stages.includes(raw?.stage)?raw.stage:'available';
 let rideDistance=clamp(finite(raw?.rideDistance),0,REQUIRED_RIDE_DISTANCE);
 let rewardClaimed=raw?.rewardClaimed===true;
 if(rewardClaimed||stage==='completed'){stage='completed';rewardClaimed=true;rideDistance=REQUIRED_RIDE_DISTANCE;}
 else if(stage==='available'||stage==='pickup')rideDistance=0;
 else if(stage==='deliver')rideDistance=REQUIRED_RIDE_DISTANCE;
 else if(rideDistance>=REQUIRED_RIDE_DISTANCE)stage='deliver';
 return {stage,rideDistance,rewardClaimed};
}
export function createSession(world,raw=null){
 const isV2=raw?.version===2;
 const legacy=raw&&typeof raw==='object'&&!Array.isArray(raw)&&!('version'in raw);
 const progress=cleanProgress(isV2||legacy?raw:null);
 const player=createPlayer();player.distance=clamp(finite(isV2?raw?.player?.distance:progress.distance),0,1e9);
 const mode=isV2&&raw.mode==='walking'?'walking':'riding';
 const vehicle={...safePose(isV2?raw.vehicle:START,world,'riding'),speed:0};
 let actor=mode==='riding'?vehicle:safePose(raw?.player,world,'walking');
 if(mode==='walking'&&bodiesOverlap(collisionBody(actor,'walking'),collisionBody(vehicle,'scooter'))){
  actor=findDismountPosition(vehicle,world);
  if(!actor){Object.assign(vehicle,START);actor=findDismountPosition(vehicle,world)||{x:START.x+20,y:START.y,angle:START.angle};}
 }
 Object.assign(player,{x:actor.x,y:actor.y,angle:actor.angle,speed:0});
 return {version:2,player,vehicle,mode,stamps:progress.stamps,night:progress.night,
  quest:cleanQuest(isV2?raw.quest:null),coins:isV2&&Number.isInteger(raw.coins)&&raw.coins>=0?Math.min(raw.coins,999999):0,
  activity:isV2?(raw.activity==='explore'?'explore':'quest'):legacy?'explore':'quest',
  selectedLandmark:isV2&&LANDMARKS.some(l=>l.id===raw.selectedLandmark)?raw.selectedLandmark:LANDMARKS.find(l=>!progress.stamps.includes(l.id))?.id||null};
}
export function serializeSession(state){
 return {version:2,player:{x:state.player.x,y:state.player.y,angle:state.player.angle,distance:state.player.distance},vehicle:{x:state.vehicle.x,y:state.vehicle.y,angle:state.vehicle.angle},mode:state.mode,stamps:[...state.stamps],night:state.night,quest:{...state.quest},coins:state.coins,activity:state.activity,selectedLandmark:state.target?.id||state.selectedLandmark||null};
}
export function recordQuestRide(quest,deltaDistance,mode){
 if(mode!=='riding'||quest.stage!=='carrying'||!Number.isFinite(deltaDistance)||deltaDistance<=0)return false;
 quest.rideDistance=Math.min(REQUIRED_RIDE_DISTANCE,quest.rideDistance+deltaDistance);
 if(quest.rideDistance>=REQUIRED_RIDE_DISTANCE){quest.stage='deliver';return true;}
 return false;
}
export function questObjective(state){
 const stage=state.quest.stage;
 if(stage==='completed')return null;
 let station,clue,stageLabel;
 if(stage==='available'){station=QUEST_STATIONS.giver;clue='到巷口夜市的阿沐茶舖，接下第一份送暖委託。';stageLabel='接取委託 · 1 / 4';}
 else if(stage==='pickup'){station=QUEST_STATIONS.pickup;clue='老闆託你送一杯熱茶。到街角取貨點領取，靠近後按 E。';stageLabel='領取熱茶 · 2 / 4';}
 else if(stage==='carrying'){station=QUEST_STATIONS.delivery;clue=`熱茶已領取。騎上機車前往老街，還需騎乘 ${Math.max(0,Math.ceil(toMetres(REQUIRED_RIDE_DISTANCE-state.quest.rideDistance)))} m。`;stageLabel='騎車送暖 · 3 / 4';}
 else{station=QUEST_STATIONS.delivery;clue=state.mode==='riding'?'到修傘攤附近停車，按 F 下車後走近師傅交付。':'步行靠近修傘師傅，按 E 交付熱茶，完成後獲得 300 遊戲幣。';stageLabel='下車交付 · 4 / 4';}
 return {...station,clue,stageLabel};
}
export function questInteraction(state){
 const objective=questObjective(state);if(!objective||distance(state.player,objective)>=42)return null;
 const stage=state.quest.stage;
 let label='',reason='',action='';
 if(stage==='available'){label='接下送茶委託';action='accept';}
 else if(stage==='pickup'){label='領取熱茶';action='pickup';}
 else if(stage==='carrying'){label='還需要騎車送一段路';reason=`先騎車累積 ${Math.ceil(toMetres(REQUIRED_RIDE_DISTANCE-state.quest.rideDistance))} m，再下車交付`;action='wait';}
 else if(state.mode!=='walking'){label='先按 F 下車，再交付';reason='請先停車並下車，親手把茶交給師傅';action='deliver';}
 else{label='交付熱茶 · +300';action='deliver';}
 if(Math.abs(state.player.speed)>=8)reason='先慢下來，再與街角居民互動';
 return {label,enabled:!reason,reason,station:objective,action};
}
export function interactQuest(state){
 if(state.quest.stage==='completed'||state.quest.rewardClaimed)return {ok:false,message:'這份委託已完成，獎勵只領取一次'};
 const action=questInteraction(state);
 if(!action)return {ok:false,message:'先前往目前委託標記，再靠近互動'};
 if(!action.enabled)return {ok:false,message:action.reason};
 if(action.action==='accept'){state.quest.stage='pickup';return {ok:true,message:'已接下「雨後的一杯茶」，前往街角取貨點'};}
 if(action.action==='pickup'){state.quest.stage='carrying';state.quest.rideDistance=0;return {ok:true,message:'熱茶已領取，騎上機車送往老街修傘攤'};}
 if(action.action==='deliver'&&state.quest.stage==='deliver'&&state.mode==='walking'){
  state.quest.stage='completed';state.quest.rewardClaimed=true;state.coins=Math.min(999999,state.coins+QUEST_REWARD);
  return {ok:true,completed:true,message:'熱茶送達！獲得 300 遊戲幣'};
 }
 return {ok:false,message:'先完成目前的委託步驟'};
}
