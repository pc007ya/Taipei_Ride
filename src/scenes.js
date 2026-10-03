import {createWorld,LANDMARKS,START,makeTraffic} from './world.js';
export const SCENES=[{id:'taipei',name:'台北漫遊'},{id:'xitun',name:'台中西屯'}];
export const sceneId=id=>id==='xitun'?'xitun':'taipei';
let xitunLoadFailures=0;
export async function loadScene(id){
 if(sceneId(id)==='xitun'){const url=new URL('./world-xitun.js',import.meta.url);if(xitunLoadFailures)url.searchParams.set('retry',String(xitunLoadFailures));try{return await import(url.href);}catch(error){xitunLoadFailures++;throw error;}}
 return {sceneStart:START,createSceneWorld:()=>({...createWorld(),sceneId:'taipei',name:'台北漫遊',start:START,landmarks:LANDMARKS,hasQuest:true}),createSceneTraffic:makeTraffic,cityFactory:null};
}

// Only two fixed numeric snapshots survive map disposal; hostile/old save files
// cannot retain arbitrary nested objects or lists in the multi-scene save.
export function cleanCitySave(raw){
 if(!raw||typeof raw!=='object')return null;
 const number=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
 const pose=value=>({x:number(value?.x,START.x),y:number(value?.y,START.y),angle:number(value?.angle,START.angle)});
 return {version:2,player:{...pose(raw.player),distance:Math.max(0,Math.min(1e9,number(raw.player?.distance)))},vehicle:pose(raw.vehicle),mode:raw.mode==='walking'?'walking':'riding',stamps:Array.isArray(raw.stamps)?raw.stamps.filter(id=>typeof id==='string'&&id.length<64).slice(0,6):[],night:raw.night===true,coins:Math.max(0,Math.min(999999,Math.floor(number(raw.coins)))),activity:raw.activity==='explore'?'explore':'quest',selectedLandmark:typeof raw.selectedLandmark==='string'&&raw.selectedLandmark.length<64?raw.selectedLandmark:null,quest:{stage:['available','pickup','carrying','deliver','completed'].includes(raw.quest?.stage)?raw.quest.stage:'available',rideDistance:Math.max(0,Math.min(100,number(raw.quest?.rideDistance))),rewardClaimed:raw.quest?.rewardClaimed===true}};
}
