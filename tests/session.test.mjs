import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, START, collides, createPlayer, updatePlayer, updateWalker, changeTravelMode, findDismountPosition, distance } from '../src/world.js';
import { createSession, serializeSession, QUEST_STATIONS, questObjective, interactQuest, recordQuestRide, questInteraction } from '../src/session.js';
const world=createWorld();
const locate=(state,station)=>Object.assign(state.player,{x:station.x,y:station.y,speed:0});
test('new session starts riding with a parked-vehicle pose and original main quest',()=>{
 const s=createSession(world);assert.equal(s.mode,'riding');assert.equal(s.activity,'quest');assert.equal(s.quest.stage,'available');assert.equal(s.coins,0);assert.equal(s.player.x,s.vehicle.x);assert.equal(questObjective(s).id,'tea-giver');
});
test('legacy v1 migrates stamps, distance and night without inventing quest progress',()=>{
 const s=createSession(world,{stamps:['market','tower'],distance:2345,night:true});assert.deepEqual(s.stamps,['market','tower']);assert.equal(s.player.distance,2345);assert.equal(s.night,true);assert.equal(s.activity,'explore');assert.equal(s.quest.stage,'available');assert.equal(s.coins,0);assert.equal(s.mode,'riding');
});
test('walking v2 roundtrip preserves independent actor and parked scooter positions',()=>{
 const s=createSession(world);s.mode='walking';Object.assign(s.player,{x:800,y:750,angle:.7,distance:154});Object.assign(s.vehicle,{x:480,y:510,angle:-.2});s.quest={stage:'carrying',rideDistance:72,rewardClaimed:false};s.coins=15;s.stamps=['market'];s.night=true;
 const restored=createSession(world,JSON.parse(JSON.stringify(serializeSession(s))));assert.equal(restored.mode,'walking');assert.equal(restored.player.y,750);assert.equal(restored.vehicle.x,480);assert.equal(restored.player.speed,0);assert.equal(restored.vehicle.speed,0);assert.deepEqual(restored.quest,s.quest);assert.equal(restored.coins,15);assert.equal(restored.player.distance,154);
});
test('riding v2 normalizes actor position to the independently saved vehicle',()=>{
 const s=createSession(world,{version:2,mode:'riding',player:{x:1000,y:1000,angle:9,distance:12},vehicle:{x:480,y:500,angle:.4},quest:{stage:'pickup'}});assert.equal(s.player.x,480);assert.equal(s.player.y,500);assert.equal(s.player.angle,.4);assert.equal(s.player.distance,12);
});
test('malformed saves cannot load out-of-bounds or embedded actor/vehicle positions',()=>{
 const b=world.obstacles[0],s=createSession(world,{version:2,mode:'walking',player:{x:b.x+10,y:b.y+10,angle:Infinity,distance:-8},vehicle:{x:NaN,y:99999,angle:'bad'},stamps:['bad','market','market'],night:'true',quest:{stage:'???',rideDistance:Infinity},coins:-5});
 assert.equal(collides(s.player.x,s.player.y,world.obstacles,6),false);assert.equal(collides(s.vehicle.x,s.vehicle.y,world.obstacles,8),false);assert.ok(distance(s.player,s.vehicle)>=12);assert.equal(s.player.distance,0);assert.deepEqual(s.stamps,['market']);assert.equal(s.coins,0);assert.equal(s.night,false);assert.equal(s.quest.stage,'available');assert.equal(createSession(world,[]).activity,'quest');
});
test('save normalization prevents inconsistent reward flags from giving a second reward',()=>{
 const s=createSession(world,{version:2,mode:'walking',player:{x:160,y:1020},vehicle:{x:160,y:1080},quest:{stage:'deliver',rewardClaimed:true,rideDistance:0},coins:300});assert.equal(s.quest.stage,'completed');assert.equal(s.quest.rideDistance,100);assert.equal(interactQuest(s).ok,false);assert.equal(s.coins,300);
});
test('quest cannot be delivered before acceptance, pickup and required riding',()=>{
 const s=createSession(world);locate(s,QUEST_STATIONS.delivery);s.mode='walking';assert.equal(interactQuest(s).ok,false);assert.equal(s.quest.stage,'available');
 locate(s,QUEST_STATIONS.giver);assert.equal(interactQuest(s).ok,true);assert.equal(s.quest.stage,'pickup');locate(s,QUEST_STATIONS.delivery);assert.equal(interactQuest(s).ok,false);
 locate(s,QUEST_STATIONS.pickup);assert.equal(interactQuest(s).ok,true);assert.equal(s.quest.stage,'carrying');locate(s,QUEST_STATIONS.delivery);assert.equal(interactQuest(s).ok,false);assert.equal(s.coins,0);
});
test('original quest follows accept, pickup, riding, walking delivery and one-time reward',()=>{
 const s=createSession(world);locate(s,QUEST_STATIONS.giver);assert.equal(interactQuest(s).ok,true);assert.equal(interactQuest(s).ok,false);assert.equal(questObjective(s).id,'tea-pickup');
 locate(s,QUEST_STATIONS.pickup);assert.equal(interactQuest(s).ok,true);assert.equal(recordQuestRide(s.quest,1000,'walking'),false);assert.equal(s.quest.rideDistance,0);recordQuestRide(s.quest,60,'riding');assert.equal(s.quest.stage,'carrying');assert.equal(recordQuestRide(s.quest,45,'riding'),true);assert.equal(s.quest.rideDistance,100);assert.equal(questObjective(s).id,'tea-delivery');
 locate(s,QUEST_STATIONS.delivery);assert.equal(questInteraction(s).enabled,false);assert.equal(interactQuest(s).ok,false);s.mode='walking';assert.equal(interactQuest(s).completed,true);assert.equal(s.coins,300);assert.equal(s.quest.rewardClaimed,true);assert.equal(questObjective(s),null);for(let i=0;i<10;i++)assert.equal(interactQuest(s).ok,false);assert.equal(s.coins,300);
 const restored=createSession(world,serializeSession(s));assert.equal(restored.quest.stage,'completed');assert.equal(restored.coins,300);assert.equal(interactQuest(restored).ok,false);
});
test('high speed and wrong location never advance a quest stage',()=>{
 const s=createSession(world);assert.equal(interactQuest(s).ok,false);locate(s,QUEST_STATIONS.giver);s.player.speed=20;assert.equal(questInteraction(s).enabled,false);assert.equal(interactQuest(s).ok,false);assert.equal(s.quest.stage,'available');
});
test('ride accumulation rejects pre-pickup, negative and nonfinite deltas',()=>{
 const s=createSession(world);assert.equal(recordQuestRide(s.quest,150,'riding'),false);s.quest.stage='carrying';for(const delta of [-3,NaN,Infinity])recordQuestRide(s.quest,delta,'riding');assert.equal(s.quest.rideDistance,0);
});
test('high-speed dismount is denied; a stopped rider dismounts into clear space',()=>{
 const s=createSession(world);s.player.speed=25;const before={...s.player};assert.equal(changeTravelMode(s,world).ok,false);assert.deepEqual(s.player,before);s.player.speed=0;assert.equal(changeTravelMode(s,world).ok,true);assert.equal(s.mode,'walking');assert.ok(distance(s.player,s.vehicle)>=12);assert.equal(collides(s.player.x,s.player.y,world.obstacles,6),false);assert.equal(s.vehicle.x,START.x);assert.equal(s.vehicle.y,START.y);
});
test('walking is independent of parked scooter and turns while stationary',()=>{
 const s=createSession(world);changeTravelMode(s,world);const parked={...s.vehicle},oldAngle=s.player.angle;updateWalker(s.player,{right:true},.03,world,s.vehicle);assert.notEqual(s.player.angle,oldAngle);for(let i=0;i<80;i++)updateWalker(s.player,{throttle:true},.02,world,s.vehicle);assert.deepEqual(s.vehicle,parked);assert.ok(distance(s.player,s.vehicle)>20);assert.ok(s.player.distance>0);
});
test('boarding requires proximity and a clear path; no through-wall boarding',()=>{
 const s=createSession(world);changeTravelMode(s,world);s.player.x+=100;assert.equal(changeTravelMode(s,world).ok,false);assert.equal(s.mode,'walking');Object.assign(s.player,{x:s.vehicle.x+20,y:s.vehicle.y,speed:0});assert.equal(changeTravelMode(s,world).ok,true);assert.equal(s.mode,'riding');assert.equal(s.player.x,s.vehicle.x);
 const blockedWorld={obstacles:[{x:800,y:495,w:4,d:30}]},blocked={mode:'walking',player:{x:790,y:510,angle:0,speed:0},vehicle:{x:820,y:510,angle:0,speed:0}};assert.equal(changeTravelMode(blocked,blockedWorld).ok,false);assert.equal(blocked.mode,'walking');
});
test('dismount cannot jump across a wall to an apparently clear target',()=>{
 const sealed={obstacles:[{x:790,y:488,w:25,d:4},{x:790,y:518,w:25,d:4},{x:784,y:488,w:4,d:35},{x:817,y:488,w:4,d:35}]};assert.equal(findDismountPosition({x:800,y:505,angle:0},sealed),null);
});
test('fresh reset state clears mission, currency, modes and both positions together',()=>{
 const fresh=createSession(world);assert.equal(fresh.quest.stage,'available');assert.equal(fresh.coins,0);assert.deepEqual(fresh.stamps,[]);assert.equal(fresh.player.distance,0);assert.equal(fresh.mode,'riding');assert.deepEqual([fresh.player.x,fresh.player.y,fresh.vehicle.x,fresh.vehicle.y],[START.x,START.y,START.x,START.y]);
});
