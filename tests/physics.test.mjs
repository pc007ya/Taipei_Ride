import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createPlayer, stepSimulation, updatePlayer, updateWalker, updateTraffic, makeTraffic, trafficPose, findDismountPosition, changeTravelMode, collisionBody, bodiesOverlap, poseCollides, WORLD_SCALE, ROAD_WIDTH, TRAFFIC_LANE_OFFSET, PERSON, SCOOTER, CAR, BUILDING } from '../src/world.js';
import { obstacleBody, fixedBodies, moveBody, sweepCollision, recoverPose } from '../src/physics.js';
import { createSession, serializeSession, questObjective } from '../src/session.js';
const empty={obstacles:[]};
const actor=(x,y,angle=0,speed=0)=>({...createPlayer(),x,y,angle,speed});
const session=(mode,x,y,angle=0,speed=0)=>({mode,player:actor(x,y,angle,speed),vehicle:{x:700,y:700,angle:0,speed:0},traffic:[]});
const car=(x,y,angle=0,speed=0)=>({x,y,angle,speed,type:'car'});
function noOverlap(state,world,cars=[]){
 assert.equal(poseCollides(state.player,state.mode,world),false,'actor must remain outside fixed geometry');
 for(const c of cars)assert.equal(bodiesOverlap(collisionBody(state.player,state.mode),collisionBody(c,'car')),false,'actor/car overlap');
 if(state.mode==='walking')assert.equal(bodiesOverlap(collisionBody(state.player,'walking'),collisionBody(state.vehicle,'scooter')),false,'walker/parked-scooter overlap');
 for(let i=0;i<cars.length;i++){assert.equal(poseCollides(cars[i],'car',world),false);for(let j=i+1;j<cars.length;j++)assert.equal(bodiesOverlap(collisionBody(cars[i],'car'),collisionBody(cars[j],'car')),false,'car/car overlap');}
}
function run(state,world,cars,input,seconds,dt=.04){let hit=false;for(let i=0;i<Math.ceil(seconds/dt);i++){hit=stepSimulation(state,input,dt,world,cars).hit||hit;noOverlap(state,world,cars);}return hit;}
test('shared metre scale, silhouettes and building floors are coherent',()=>{
 assert.equal(WORLD_SCALE,10);assert.equal(PERSON.height/WORLD_SCALE,1.72);assert.equal(SCOOTER.length/WORLD_SCALE,2);assert.equal(CAR.length/WORLD_SCALE,4.4);assert.equal(CAR.height/WORLD_SCALE,1.5);
 const w=createWorld();for(const b of w.buildings.filter(b=>b.type==='building')){assert.ok(b.floorCount>=2&&b.floorCount<=6);assert.equal(b.height,32+(b.floorCount-1)*30);assert.equal(b.h,b.height);}assert.equal(BUILDING.doorHeight,22);
 const riding=collisionBody(actor(500,500),'riding'),traffic=collisionBody(actor(500,500),'car');assert.equal(riding.maxX-riding.minX,20);assert.ok(Math.abs(riding.maxY-riding.minY-8.6)<1e-6);assert.equal(traffic.maxX-traffic.minX,44);assert.equal(traffic.maxY-traffic.minY,21);
});
for(const mode of ['walking','riding'])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])test(`${mode}: sustained head-on collision on wall facing ${angle.toFixed(2)} stops without penetration`,()=>{
 const cx=800,cy=800,d=Math.cos(angle),e=Math.sin(angle),world={obstacles:[{type:'building',x:790,y:790,w:20,d:20}]},s=session(mode,cx-d*55,cy-e*55,angle,mode==='riding'?72:14);
 run(s,world,[],{throttle:true},6);assert.ok(Math.abs(s.player.speed)<.21);const before={...s.player};run(s,world,[],{throttle:true},2);assert.ok(Math.hypot(s.player.x-before.x,s.player.y-before.y)<.01,'no bounce or creep under held throttle');
});
for(const mode of ['walking','riding'])for(const angle of [Math.PI/6,Math.PI/3])test(`${mode}: ${(angle*180/Math.PI).toFixed(0)} degree wall approach preserves a useful slide`,()=>{
 const world={obstacles:[{type:'building',x:820,y:600,w:30,d:1000}]},s=session(mode,790,740,angle,mode==='riding'?72:14);run(s,world,[],{throttle:true},6);assert.ok(s.player.y>775);assert.ok(s.player.x<820);assert.ok(s.player.distance>40);
});
for(const mode of ['walking','riding'])for(const angle of [0,Math.PI/2,Math.PI/4])test(`${mode}: parked car ${angle.toFixed(2)} approach cannot pass through its front, side or corner`,()=>{
 const cars=[car(800,800)],s=session(mode,800-Math.cos(angle)*65,800-Math.sin(angle)*65,angle,mode==='riding'?72:14);assert.equal(run(s,empty,cars,{throttle:true},8),true);assert.ok(Math.hypot(s.player.x-800,s.player.y-800)>12);if(angle!==Math.PI/4)assert.ok(s.player.x<=800+.001&&s.player.y<=800+.001);assert.equal(cars[0].x,800);assert.equal(cars[0].y,800);
});
test('walker cannot walk through a parked scooter from either axis',()=>{
 for(const angle of [0,Math.PI/2,Math.PI/4]){const s=session('walking',800-Math.cos(angle)*35,800-Math.sin(angle)*35,angle,14);s.vehicle={x:800,y:800,angle:0,speed:0};run(s,empty,[],{throttle:true},6);assert.ok(Math.hypot(s.player.x-800,s.player.y-800)>5);assert.deepEqual(s.vehicle,{x:800,y:800,angle:0,speed:0});}
});
for(const mode of ['walking','riding'])for(const scenario of ['head-on','rear-end','crossing','stationary'])test(`${mode}: moving traffic ${scenario} yields with no overlap on every simulation step`,()=>{
 let s,cars;
 if(scenario==='head-on'){s=session(mode,755,800,0,mode==='riding'?72:14);cars=[car(865,800,Math.PI,32)];}
 if(scenario==='rear-end'){s=session(mode,800,800,0,mode==='riding'?20:14);cars=[car(740,800,0,32)];}
 if(scenario==='crossing'){s=session(mode,770,800,0,mode==='riding'?72:14);cars=[car(800,770,Math.PI/2,32)];}
 if(scenario==='stationary'){s=session(mode,800,800,0,0);cars=[car(735,800,0,32)];}
 run(s,empty,cars,scenario==='stationary'?{}:{throttle:true},scenario==='stationary'?4:1.4);
 if(scenario==='stationary'){assert.equal(s.player.x,800);assert.equal(s.player.y,800);assert.ok(cars[0].x<800);assert.equal(cars[0].actualSpeed,0);assert.equal(cars[0].yielding,true);}
});
test('traffic stops behind a parked scooter and behind another stopped car',()=>{
 const s=session('walking',800,830),cars=[car(710,800,0,32),car(810,800,0,0)];s.vehicle={x:765,y:800,angle:0};run(s,empty,cars,{},4);assert.ok(cars[0].x<735);assert.equal(cars[0].yielding,true);assert.equal(bodiesOverlap(collisionBody(cars[0],'car'),collisionBody(s.vehicle,'scooter')),false);
 const pair=[car(700,500,0,32),car(770,500,0,0)];for(let i=0;i<150;i++){updateTraffic(pair,.04,empty);assert.equal(bodiesOverlap(collisionBody(pair[0],'car'),collisionBody(pair[1],'car')),false);}assert.ok(pair[0].x<=726);
});
test('swept relative motion catches vehicles crossing between non-overlapping endpoints',()=>{
 const a=collisionBody(actor(500,800),'riding'),b=collisionBody(actor(600,800,Math.PI),'car');
 const hit=sweepCollision(a,b,{x:120,y:0},{x:-120,y:0});assert.ok(hit);assert.ok(hit.time>0&&hit.time<.5);
 const p=actor(500,800),r=moveBody(p,'riding',{x:300,y:0},[obstacleBody({x:650,y:700,w:1,d:200})]);assert.equal(r.hit,true);assert.ok(p.x<=640);assert.ok(p.x>639.9);
});
test('maximum-speed and stalled-frame inputs cannot tunnel a thin wall or car, even during notification cooldown',()=>{
 for(const target of ['wall','car']){const world=target==='wall'?{obstacles:[{x:805,y:700,w:.2,d:200}]}:empty,cars=target==='car'?[car(825,800)]:[],s=session('riding',785,800,0,72);s.player.collisionCooldown=999;run(s,world,cars,{throttle:true},8,.04);stepSimulation(s,{throttle:true},1000,world,cars);noOverlap(s,world,cars);assert.ok(s.player.x<805);assert.equal(s.player.speed,0);}
});
test('rotating vehicle corners cannot enter nearby masonry',()=>{
 const world={obstacles:[{x:813,y:750,w:30,d:100}]},s=session('riding',800,800,Math.PI/2,4);run(s,world,[],{throttle:true,left:true},4);noOverlap(s,world);
});
for(const type of ['tree','lamp'])for(const mode of ['walking','riding'])test(`${mode}: ${type} base blocks a head-on approach and permits a glancing slide`,()=>{
 const radius=type==='tree'?1.7:1.3,world={obstacles:[{type,x:800,y:800,radius,height:48}]},s=session(mode,765,800,0,mode==='riding'?72:14);run(s,world,[],{throttle:true},6);assert.ok(s.player.x<800-radius);assert.ok(s.player.speed<.21);
 const glancing=session(mode,765,mode==='walking'?803:805,0,mode==='riding'?72:14);run(glancing,world,[],{throttle:true},6);assert.ok(glancing.player.x>810,'sliding around a rounded trunk/base should retain forward progress');
});
test('trees and streetlights share explicit visible and collidable footprints without blocking crossings',()=>{
 const w=createWorld();assert.ok(w.lamps.length);for(const lamp of w.lamps){assert.equal(lamp.radius,1.3);assert.equal(lamp.poleRadius,.45);assert.ok(w.obstacles.some(o=>o.type==='lamp'&&o.x===lamp.x&&o.y===lamp.y&&o.radius===lamp.radius));}for(const tree of w.trees){assert.ok(tree.h>=35&&tree.h<=55);assert.ok(tree.trunkRadius>=1.2&&tree.trunkRadius<=1.8);assert.ok(w.obstacles.some(o=>o.type==='tree'&&o.x===tree.x&&o.y===tree.y&&o.radius===tree.trunkRadius));}
});
test('safe dismount checks swept path through traffic and poles and cannot teleport across a wall',()=>{
 const v={x:800,y:800,angle:0},world={obstacles:[{type:'lamp',x:800,y:807,radius:1.3}]},cars=[car(800,779,0)];const safe=findDismountPosition(v,world,cars);assert.ok(safe);assert.ok(safe.x!==800||safe.y!==814);assert.equal(poseCollides(safe,'walking',world,cars.map(c=>collisionBody(c,'car'))),false);
 const s=session('riding',800,800,0,72);const before=structuredClone(s);assert.equal(changeTravelMode(s,empty,cars).ok,false);assert.deepEqual(s,before);
});
test('overlap recovery clears a wall/car wedge without moving the car or wall',()=>{
 const w={obstacles:[{x:810,y:760,w:40,d:100}]},c=car(780,800,Math.PI/2),p=actor(807,800);assert.equal(recoverPose(p,'walking',w,[collisionBody(c,'car')]),true);assert.equal(poseCollides(p,'walking',w,[collisionBody(c,'car')]),false);assert.equal(c.x,780);
});
test('v2 saved poses validate the complete new silhouettes and normalized headings',()=>{
 const w={obstacles:[{x:810,y:780,w:30,d:100}]},s=createSession(w,{version:2,mode:'riding',vehicle:{x:803,y:800,angle:0},player:{distance:42}});assert.notEqual(s.vehicle.x,803);assert.equal(poseCollides(s.vehicle,'riding',w),false);assert.equal(s.player.distance,42);
 const full=createWorld(),restored=createSession(full,{version:2,mode:'walking',vehicle:{x:800,y:800,angle:12345},player:{x:800,y:800,angle:Infinity,distance:NaN},quest:{stage:'carrying',rideDistance:50}});assert.equal(bodiesOverlap(collisionBody(restored.player,'walking'),collisionBody(restored.vehicle,'scooter')),false);assert.ok(Math.abs(restored.player.angle)<=Math.PI);assert.equal(restored.player.distance,0);assert.match(questObjective(restored).clue,/5 m/);assert.equal(createSession(full,serializeSession(restored)).quest.rideDistance,50);
});
test('traffic has continuous rounded corners and starts with no overlapping vehicle pairs',()=>{
 const cars=makeTraffic();for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++)assert.equal(bodiesOverlap(collisionBody(cars[i],'car'),collisionBody(cars[j],'car')),false);
 for(let i=0;i<1000;i++){const a=trafficPose(0,i/1000),b=trafficPose(0,(i+1)/1000);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<5);}
});
for(const type of ['tree','lamp'])test(`traffic yields to the ${type} physical base`,()=>{
 const world={obstacles:[{type,x:800,y:800,radius:1.3}]},cars=[car(730,800,0,32)];
 for(let i=0;i<150;i++){updateTraffic(cars,.04,world);assert.equal(poseCollides(cars[0],'car',world),false);}
 assert.ok(cars[0].x<777);assert.equal(cars[0].actualSpeed,0);assert.equal(cars[0].yielding,true);
});
test('a walker wedged between a parked scooter, car and wall recovers to a non-overlapping pose',()=>{
 const world={obstacles:[{x:809,y:780,w:20,d:80}]},s=session('walking',806,800),cars=[car(785,790,Math.PI/2)];s.vehicle={x:800,y:800,angle:0};stepSimulation(s,{},.04,world,cars);assert.equal(poseCollides(s.player,'walking',world,[collisionBody(s.vehicle,'scooter'),collisionBody(cars[0],'car')]),false);
});
test('reloaded parked vehicle takes priority over a coincident traffic spawn',()=>{
 const cars=makeTraffic(),saved=trafficPose(cars[0].route,cars[0].t),s=session('walking',800,800);s.vehicle={x:saved.x,y:saved.y,angle:saved.angle};const parked={...s.vehicle};stepSimulation(s,{},.04,empty,cars);noOverlap(s,empty,cars);assert.deepEqual(s.vehicle,parked);for(const c of cars)assert.equal(bodiesOverlap(collisionBody(c,'car'),collisionBody(s.vehicle,'scooter')),false);
});
for(const mode of ['walking','riding'])test(`${mode}: an inside corner stops both axes without bouncing or tunnelling`,()=>{
 const world={obstacles:[{x:820,y:600,w:20,d:240},{x:600,y:820,w:240,d:20}]},s=session(mode,790,790,Math.PI/4,mode==='riding'?72:14);run(s,world,[],{throttle:true},6);assert.ok(s.player.x<820&&s.player.y<820);assert.equal(s.player.speed,0);const before={...s.player};run(s,world,[],{throttle:true},2);assert.ok(Math.hypot(s.player.x-before.x,s.player.y-before.y)<.01);
});
test('traffic lane centres derive from the shared road width and leave centreline scooter clearance',()=>{
 assert.equal(TRAFFIC_LANE_OFFSET,ROAD_WIDTH/4);
 const clearance=TRAFFIC_LANE_OFFSET-CAR.mirrorWidth/2-SCOOTER.occupiedWidth/2;
 assert.ok(clearance>=2.5,'the sedan mirror and rider/handlebar footprints need a real gap');
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const p=actor(800,800,angle),c=car(800-Math.sin(angle)*TRAFFIC_LANE_OFFSET,800+Math.cos(angle)*TRAFFIC_LANE_OFFSET,angle);
  assert.equal(bodiesOverlap(collisionBody(p,'riding'),collisionBody(c,'car')),false);
 }
});
for(const direction of ['same','opposite'])test(`centreline rider can pass ${direction}-direction traffic without a false lane collision`,()=>{
 const world=createWorld(),origin=trafficPose(0,0),t=(800-origin.x)/origin.perimeter,c={...trafficPose(0,t),t,route:0,speed:17,type:'car'};
 const s=session('riding',direction==='same'?740:860,480,direction==='same'?0:Math.PI,72);
 assert.equal(run(s,world,[c],{throttle:true},3),false);assert.ok(Math.abs(s.player.y-480)<1e-7);
 if(direction==='same')assert.ok(s.player.x>c.x+30);else assert.ok(s.player.x<c.x-100);
});
for(const offset of [-30,0,25])test(`centreline rider clears a turning traffic entrance at route offset ${offset}`,()=>{
 const world=createWorld(),origin=trafficPose(0,0),straight=1120-160-2*TRAFFIC_LANE_OFFSET-56,t=(straight+offset)/origin.perimeter;
 const c={...trafficPose(0,t),t,route:0,speed:17,type:'car'},s=session('riding',1010,480,0,72);
 run(s,world,[c],{throttle:true},5);assert.ok(s.player.x>1190,'rider must clear the junction rather than remain mutually blocked');assert.ok(c.y>520,'turning car must continue through its turn');
});
