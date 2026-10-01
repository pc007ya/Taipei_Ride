import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createPlayer, updatePlayer, isRoad, collides, LANDMARKS, canCollect, nearbyLandmark, cleanProgress, makeTraffic, updateTraffic, distance } from '../src/world.js';
const world=createWorld();
test('world is deterministic and all landmark markers are reachable road locations',()=>{
 assert.deepEqual(createWorld(),world);
 assert.equal(LANDMARKS.length,6);assert.equal(new Set(LANDMARKS.map(x=>x.id)).size,6);
 for(const l of LANDMARKS){assert.ok(isRoad(l.x,l.y),l.id);assert.equal(collides(l.x,l.y,world.obstacles),false,l.id);}
});
test('street trees stay off all drivable road surfaces',()=>{
 for(const t of world.trees)assert.equal(isRoad(t.x,t.y),false);
});
test('spawn is safe and throttle moves the scooter north',()=>{
 const p=createPlayer();assert.equal(collides(p.x,p.y,world.obstacles),false);
 for(let i=0;i<50;i++)updatePlayer(p,{throttle:true},.02,world);
 assert.ok(p.y<500);assert.ok(Math.abs(p.x-800)<1);assert.ok(p.speed>40);
});
test('brake stops; reverse and steering respect movement direction',()=>{
 const p=createPlayer();p.speed=80;
 for(let i=0;i<100;i++)updatePlayer(p,{brake:true},.02,world);
 assert.ok(Math.abs(p.speed)<.2);
 const angle=p.angle;for(let i=0;i<20;i++)updatePlayer(p,{reverse:true,right:true},.02,world);
 assert.ok(p.speed<0);assert.ok(p.angle<angle);
});
test('stationary steering does not pivot scooter',()=>{
 const p=createPlayer(),a=p.angle;updatePlayer(p,{right:true},.03,world);assert.equal(p.angle,a);
});
test('building collision and outer boundary block movement',()=>{
 const b=world.obstacles[0];assert.ok(collides(b.x+5,b.y+5,world.obstacles));assert.ok(collides(30,800,[]));
 const p={x:92,y:800,speed:-50,angle:0,distance:0,collisionCooldown:0};updatePlayer(p,{},.04,world);assert.ok(p.x>=103);assert.equal(p.speed,0);
});
test('delta is capped to avoid large movement after a stalled frame',()=>{
 const p=createPlayer(),before={...p};p.speed=100;updatePlayer(p,{throttle:true},1000,world);assert.ok(distance(p,before)<6);
});
test('collection requires landmark proximity and low speed',()=>{
 const l=LANDMARKS[0],p={x:l.x,y:l.y,speed:0};assert.equal(nearbyLandmark(p)?.id,l.id);assert.ok(canCollect(p,l));assert.equal(canCollect({...p,speed:9},l),false);assert.equal(canCollect({...p,x:p.x+46},l),false);assert.equal(canCollect(p,null),false);
});
test('progress sanitizes corrupt values, duplicate ids, and unsupported stamps',()=>{
 assert.deepEqual(cleanProgress(null),{stamps:[],distance:0,night:false});
 assert.deepEqual(cleanProgress({stamps:['market','market','bad'],distance:Infinity,night:'true'}),{stamps:['market'],distance:0,night:false});
 assert.equal(cleanProgress({distance:-5}).distance,0);assert.equal(cleanProgress({distance:20,night:true}).night,true);
});
test('traffic follows finite bounded road loops over extended simulation',()=>{
 const cars=makeTraffic();for(let i=0;i<20000;i++)updateTraffic(cars,.05);
 for(const c of cars){assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y));assert.ok(c.x>=147&&c.x<=1453&&c.y>=147&&c.y<=1453);assert.ok(isRoad(c.x,c.y));}
});
