import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Matrix4,Raycaster} from '../vendor/three.module.js';
import {createWorld,ROADS,ROAD_WIDTH} from '../src/world.js';
import {createCity,createScooter,createWalker,createPedestrian,createCar,createTree,createLamp,SHOP_NAMES,RIDER_CONTACTS} from '../src/renderer3d.js';
import {PERSON,SCOOTER,CAR,BUILDING} from '../src/scale.js';
function visibleBounds(object){object.updateMatrixWorld(true);const box=new Box3();object.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(!p.visible)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});return box;}
function parts(object){const names=new Set();object.traverse(o=>{if(o.name)names.add(o.name);for(const n of o.userData.parts||[])names.add(n);});return names;}

test('human anatomy, articulated poses and facial/clothing geometry use one physical scale',()=>{
 const walker=createWalker(),scooter=createScooter(),rider=scooter.getObjectByName('mounted-rider');
 const names=parts(walker),riderNames=parts(rider);
 for(const part of ['head','torso','neck','left-leg','right-leg','left-arm','right-arm','thigh','shin','upper-arm','forearm','shoe','eye-white','iris','nose-bridge','hair','collar','zipper','trouser-waist'])assert.ok(names.has(part),part);
 for(const part of ['head','torso','left-arm','right-arm','left-leg','right-leg','hand','finger','helmet','left-shoe','right-shoe'])assert.ok(riderNames.has(part),part);
 const head=visibleBounds(walker.getObjectByName('head')).getSize(new Vector3()),body=visibleBounds(walker).getSize(new Vector3());
 assert.ok(body.y>PERSON.height-.6&&body.y<PERSON.height+.2);assert.ok(body.y/head.y>6.7&&body.y/head.y<8.5,'Adult proportions replace the oversized toy head');
 assert.equal(walker.getObjectByName('left-leg').position.y,8.7,'Walking legs pivot at the hip');
 for(const part of ['front-wheel','rear-wheel','front-leg-shield','step-through-floor','saddle','front-fork','headlight','tail-light','mirror','exhaust','license-plate'])assert.ok(parts(scooter).has(part),part);
});

test('street residents retain anatomy in a cached single colored mesh at human height',()=>{
 const a=createPedestrian(),b=createPedestrian();assert.equal(a.isMesh,true);assert.equal(a.geometry,b.geometry);assert.equal(a.material,b.material);
 assert.ok(a.geometry.attributes.position.count>1000);assert.ok(a.geometry.attributes.color.count>1000);
 const bounds=visibleBounds(a);assert.ok(bounds.max.y>16.6&&bounds.max.y<17.5);assert.ok(bounds.max.z-bounds.min.z<PERSON.radius*2+.01);
});

test('visible vehicle surfaces fit the same footprints used by static and dynamic collisions',()=>{
 for(const [model,length,width]of [[createScooter(),SCOOTER.length,SCOOTER.occupiedWidth],[createCar(),CAR.length,CAR.mirrorWidth]]){const b=visibleBounds(model);assert.ok(b.min.x>=-length/2-.015&&b.max.x<=length/2+.015,`length: ${b.min.x}, ${b.max.x}`);assert.ok(b.min.z>=-width/2&&b.max.z<=width/2,`width: ${b.min.z}, ${b.max.z}`);assert.ok(b.min.y>-.02);}
 const walker=visibleBounds(createWalker()),car=visibleBounds(createCar());assert.ok(car.max.y<walker.max.y&&car.max.y>13.5,'A sedan roof sits below an adult head');assert.ok(CAR.length/SCOOTER.length>2,'Scooter and sedan are no longer almost equally long');assert.ok(BUILDING.doorHeight>walker.max.y+4,'A person can fit below a normal entrance');
});

test('seated pose has matching grip anchors and soles at the physical deck surface',()=>{
 const bike=createScooter(),rider=bike.getObjectByName('mounted-rider');bike.updateMatrixWorld(true);
 for(const side of ['left','right']){const hand=rider.getObjectByName(`${side}-hand-contact`).getWorldPosition(new Vector3()),grip=bike.getObjectByName(`${side}-grip-contact`).getWorldPosition(new Vector3());assert.ok(hand.distanceTo(grip)<1e-8);assert.deepEqual(hand.toArray(),RIDER_CONTACTS[`${side}Grip`]);}
 rider.visible=false;
 for(const point of [RIDER_CONTACTS.seat,RIDER_CONTACTS.leftFoot,RIDER_CONTACTS.rightFoot]){const ray=new Raycaster(new Vector3(point[0],point[1]+.6,point[2]),new Vector3(0,-1,0),0,1),hits=ray.intersectObject(bike,true).filter(h=>{for(let p=h.object;p;p=p.parent)if(!p.visible)return false;return true;});assert.ok(hits.length>0,'Each contact has a real support surface');assert.ok(Math.abs(hits[0].point.y-point[1])<.18,`Support is within 1.8 cm: ${hits[0].point.y} vs ${point[1]}`);}
});

test('continuous car cabin has outward glass surfaces on both sides',()=>{
 const car=createCar();car.updateMatrixWorld(true);
 for(const side of [-1,1]){const ray=new Raycaster(new Vector3(0,11.2,side*30),new Vector3(0,0,-side));const hits=ray.intersectObject(car,true);assert.ok(hits.length>0);assert.equal(hits[0].object.name,'car-shell-glass');assert.ok(Math.abs(hits[0].point.z)>6.8&&Math.abs(hits[0].point.z)<7.1);}
});

test('two original characters have distinct hair geometry while preserving rider contacts',()=>{
 const male=createWalker(),female=createWalker(undefined,true,'female');assert.equal(male.userData.character,'male');assert.equal(female.userData.character,'female');assert.ok(!parts(male).has('ponytail'));assert.ok(parts(female).has('ponytail'));assert.ok(visibleBounds(female.getObjectByName('head')).min.x<visibleBounds(male.getObjectByName('head')).min.x-.2);
 for(const character of ['male','female']){const bike=createScooter(character);for(const side of ['left','right'])assert.ok(bike.getObjectByName(`${side}-hand-contact`).getWorldPosition(new Vector3()).distanceTo(bike.getObjectByName(`${side}-grip-contact`).getWorldPosition(new Vector3()))<1e-8);}
});

test('detailed meshes stay within draw-call and triangle budgets',()=>{
 for(const [model,maxCalls,maxTriangles]of [[createWalker(),8,10000],[createScooter(),12,22000],[createCar(),10,7500],[createPedestrian(),1,6500]]){let calls=0,triangles=0;model.traverse(o=>{if(o.isMesh){calls++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});assert.ok(calls<=maxCalls,`draw calls ${calls}`);assert.ok(triangles<=maxTriangles,`triangles ${triangles}`);}
});

test('tree trunks and lamp bases match their fixed collision radii below human head height',()=>{
 const world=createWorld();for(const [data,create]of [[world.trees[0],createTree],[world.lamps[0],createLamp]]){const model=create({...data,x:0,y:0});model.updateMatrixWorld(true);const radius=data.trunkRadius||data.radius;model.traverse(o=>{if(!o.isMesh||o.name==='tree-crown')return;const p=o.geometry.attributes.position,v=new Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y<PERSON.height-.1)assert.ok(Math.hypot(v.x,v.z)<=radius+.02,'Low geometry must not extend beyond its physical obstacle');}});}
});

test('shop detail is batched, original, and entirely inside existing building footprints',()=>{
 const world=createWorld(),before=JSON.stringify(world),{city}=createCity(world);assert.equal(JSON.stringify(world),before,'Decorating must not mutate gameplay collisions');
 for(const name of ['arcade-columns-shutters-frames','recessed-storefront-glass']){
  const batch=city.getObjectByName(name);assert.equal(batch.isInstancedMesh,true);assert.ok(batch.count>300);const m=new Matrix4();
  for(let i=0;i<batch.count;i++){batch.getMatrixAt(i,m);const b=new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)).applyMatrix4(m);assert.ok(world.buildings.some(o=>o.type==='building'&&b.min.x>=o.x-1e-3&&b.max.x<=o.x+o.w+1e-3&&b.min.z>=o.y-1e-3&&b.max.z<=o.y+o.d+1e-3),'No decorative column or shop front may enter a road or dismount space');}
 }
 const signs=city.getObjectByName('original-shop-signs');assert.deepEqual(signs.userData.originalTexts,SHOP_NAMES);assert.equal(new Set(SHOP_NAMES).size,12);assert.ok(signs.geometry.attributes.uv.count>2000);
});

test('sidewalks use a repeatable tile texture and curbs stay outside road interiors',()=>{
 const {city}=createCity(createWorld()),sidewalks=city.children.filter(o=>o.name==='tiled-sidewalk');assert.equal(sidewalks.length,16);
 assert.ok(sidewalks.every(o=>o.material.map?.isDataTexture));assert.equal(sidewalks[0].material.map.repeat.x,31.25);
 const curbs=city.getObjectByName('segmented-sidewalk-curbs'),m=new Matrix4();assert.equal(curbs.isInstancedMesh,true);
 for(let i=0;i<curbs.count;i++){curbs.getMatrixAt(i,m);const b=new Box3(new Vector3(-.5,-.5,-.5),new Vector3(.5,.5,.5)).applyMatrix4(m);for(const r of ROADS){assert.ok(b.max.x<=r-ROAD_WIDTH/2+1e-3||b.min.x>=r+ROAD_WIDTH/2-1e-3);assert.ok(b.max.z<=r-ROAD_WIDTH/2+1e-3||b.min.z>=r+ROAD_WIDTH/2-1e-3);}}
 const center=city.getObjectByName('double-yellow-center-lines');assert.equal(center.isInstancedMesh,true);assert.equal(center.count,80);
});
