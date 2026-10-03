import test from 'node:test';
import assert from 'node:assert/strict';
import {createSceneWorld,XITUN_LANDMARKS,XITUN_START,createSceneTraffic} from '../src/world-xitun.js';
import {createWorld,poseCollides,collisionBody,bodiesOverlap,stepSimulation} from '../src/world.js';
import {createSession,serializeSession} from '../src/session.js';
import {disposeGroups} from '../src/scene-resources.js';

test('Xitun preserves landmark direction and a clear, continuous Taiwan Boulevard',()=>{
 const world=createSceneWorld(),[park,opera,market,hospital,store]=XITUN_LANDMARKS;
 assert.ok(opera.x>park.x&&opera.y>park.y);assert.ok(market.x>park.x&&market.y<park.y);assert.ok(store.x<hospital.x&&hospital.x<park.x);
 const storeBuilding=world.buildings.find(b=>b.kind==='store'),hospitalBuilding=world.buildings.find(b=>b.kind==='hospital');assert.ok(storeBuilding.y+storeBuilding.d/2<hospitalBuilding.y+hospitalBuilding.d/2);
 for(let x=110;x<=1490;x+=5)for(const mode of ['walking','riding'])assert.equal(poseCollides({x,y:800,angle:Math.PI},mode,world),false,`${mode} ${x}`);
 assert.ok(world.buildings.length<createWorld().buildings.length/3);assert.equal(new Set(XITUN_LANDMARKS.map(l=>l.id)).size,5);
});
test('scene-aware session validates corrupt poses, separates stamps and preserves mode at a safe entrance',()=>{
 const world=createSceneWorld();
 for(const mode of ['walking','riding']){
  const state=createSession(world,{version:2,mode,player:{x:NaN,y:Infinity,distance:45},vehicle:{x:600,y:660},stamps:['tower','xitun-store','xitun-store'],activity:'quest',selectedLandmark:'tower'});
  assert.deepEqual(state.stamps,['xitun-store']);assert.equal(state.activity,'explore');assert.equal(state.mode,mode);assert.equal(state.player.distance,45);assert.equal(poseCollides(state.player,mode,world),false);assert.equal(poseCollides(state.vehicle,'riding',world),false);
  if(mode==='walking')assert.equal(bodiesOverlap(collisionBody(state.player,'walking'),collisionBody(state.vehicle,'scooter')),false);
  const restored=createSession(world,serializeSession(state));assert.deepEqual(restored.stamps,state.stamps);assert.deepEqual(restored.quest,state.quest);
 }
});
test('Xitun traffic is safe and vehicles/walkers cannot cross solid landmark walls or water',()=>{
 const world=createSceneWorld(),cars=createSceneTraffic();assert.equal(cars.length,10);
 for(const car of cars)assert.equal(poseCollides(car,'car',world),false);
 for(const mode of ['walking','riding'])for(const [x,y,angle,bound]of [[630,758,-Math.PI/2,745],[1290,1140,Math.PI/2,1180],[884,964,0,903]]){
  const state=createSession(world,{version:2,mode,player:{x,y,angle},vehicle:mode==='riding'?{x,y,angle}:XITUN_START});
  let hit=false;for(let i=0;i<150;i++)hit=stepSimulation(state,{throttle:true},.04,world,[]).hit||hit;
  assert.equal(hit,true);assert.equal(poseCollides(state.player,mode,world),false);assert.ok(angle===0?state.player.x<bound:angle>0?state.player.y<bound:state.player.y>bound);
 }
});
test('disposal frees shared geometry, material, texture and inactive skeleton exactly once',()=>{
 const counts={};const disposable=(id,extra={})=>({...extra,dispose(){counts[id]=(counts[id]||0)+1;}});
 const geometry=disposable('geometry'),texture=disposable('texture',{isTexture:true}),material=disposable('material',{map:texture}),skeleton=disposable('skeleton');
 const root={traverse(fn){fn({geometry,material,skeleton});fn({geometry,material:[material]});}};
 assert.deepEqual(disposeGroups([root,root]),{geometries:1,materials:1,textures:1,skeletons:1});assert.deepEqual(counts,{geometry:1,material:1,texture:1,skeleton:1});
});

test('inactive city saves reject nested objects and unbounded stamp data',async()=>{
 const {cleanCitySave}=await import('../src/scenes.js');const raw={player:{x:Infinity,y:120,angle:NaN,distance:1e20},vehicle:{x:600,y:800},stamps:Array.from({length:1000},()=>({nested:'map'})).concat(Array.from({length:100},(_,i)=>String(i))),quest:{stage:'hack',rideDistance:Infinity,scene:{nested:true}},coins:1e20,selectedLandmark:{bad:true},world:{buildings:[]}};
 const cleaned=cleanCitySave(raw);assert.equal(cleaned.stamps.length,6);assert.equal(cleaned.player.distance,1e9);assert.equal(cleaned.coins,999999);assert.equal(cleaned.quest.stage,'available');assert.equal('world'in cleaned,false);assert.equal('scene'in cleaned.quest,false);assert.equal(cleaned.selectedLandmark,null);
});

test('Autumn Valley water sits above ground inside an open green rim without coplanar overlap',async()=>{
 const T=await import('../vendor/three.module.js'),{createXitunCity}=await import('../src/xitun-visuals.js');const previous=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
 try{
  const {city}=createXitunCity(createSceneWorld()),matrix=new T.Matrix4(),color=new T.Color();let water=null,ground=null;
  city.traverse(object=>{if(!object.isInstancedMesh)return;for(let i=0;i<object.count;i++){object.getMatrixAt(i,matrix);object.getColorAt(i,color);const bounds=object.geometry.boundingBox?.clone()||new T.Box3().setFromBufferAttribute(object.geometry.attributes.position);bounds.applyMatrix4(matrix);const centerInside=bounds.min.x<971&&bounds.max.x>971&&bounds.min.z<964&&bounds.max.z>964;
   if(color.getHex()===0x85a56d)assert.equal(centerInside,false,'green rim must not fill the water opening');if(centerInside&&color.getHex()===0x58959e)water=bounds;if(centerInside&&color.getHex()===0x90a887)ground=bounds;
  }});assert.ok(water&&ground);assert.ok(water.max.y>ground.max.y+.05);disposeGroups([city]);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('Xitun architecture uses shared 2.2m doors and 3m upper floors',async()=>{
 const {BUILDING}=await import('../src/scale.js');const world=createSceneWorld();for(const b of world.buildings){assert.equal(b.doorHeight,BUILDING.doorHeight);assert.equal(b.floorPitch,BUILDING.upperFloorHeight);assert.equal(b.h,BUILDING.groundFloorHeight+(b.floorCount-1)*BUILDING.upperFloorHeight);}
});
