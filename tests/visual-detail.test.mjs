import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3,Matrix4} from '../vendor/three.module.js';
import {createWorld,ROADS,ROAD_WIDTH} from '../src/world.js';
import {createCity,createScooter,createWalker,createPedestrian,SHOP_NAMES} from '../src/renderer3d.js';

test('human figures have proportional heads, articulated limbs, shoes and recognizable scooter parts',()=>{
 const walker=createWalker(),scooter=createScooter(),rider=scooter.getObjectByName('mounted-rider');
 for(const part of ['head','torso','neck','left-leg','right-leg','left-arm','right-arm','thigh','shin','upper-arm','forearm','shoe'])assert.ok(walker.getObjectByName(part),part);
 for(const part of ['head','torso','left-upper-arm','right-upper-arm','left-forearm','right-forearm','left-thigh','right-thigh','left-shin','right-shin','shoe'])assert.ok(rider.getObjectByName(part),part);
 const head=new Box3().setFromObject(walker.getObjectByName('head')).getSize(new Vector3()),body=new Box3().setFromObject(walker).getSize(new Vector3());
 assert.ok(body.y/head.y>=5.9&&head.x<6,'Heads are no longer almost shoulder-wide spheres');
 assert.equal(walker.getObjectByName('left-leg').position.y,14,'Walking legs pivot at the hip');
 for(const name of ['front-wheel','rear-wheel','front-leg-shield','step-through-floor','saddle','front-fork','headlight','tail-light','mirror','exhaust','license-plate'])assert.ok(scooter.getObjectByName(name),name);
});

test('street residents retain anatomy in a single colored mesh',()=>{
 const a=createPedestrian(),b=createPedestrian();assert.equal(a.isMesh,true);assert.equal(a.geometry,b.geometry);assert.equal(a.material,b.material);
 assert.ok(a.geometry.attributes.position.count>1000);assert.ok(a.geometry.attributes.color.count>1000);
 const bounds=new Box3().setFromObject(a);assert.ok(bounds.max.y>31&&bounds.max.y<34);assert.ok(bounds.max.z-bounds.min.z>8);
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
