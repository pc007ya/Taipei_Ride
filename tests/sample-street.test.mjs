import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createPlayer, updatePlayer } from '../src/world.js';
import { createSampleStreet, isSampleStreetBuilding, sampleStreetFootprints, SAMPLE_STREET_BOUNDS, SAMPLE_STREET_SHOPS } from '../src/sample-street.js';

test('the material study replaces exactly three existing start-street buildings without changing the world',()=>{
  const world=createWorld(),before=JSON.stringify(world),sample=createSampleStreet(world);
  assert.equal(JSON.stringify(world),before);
  assert.deepEqual(world.buildings.filter(isSampleStreetBuilding).map(o=>[o.x,o.y]),[[677,535],[855,357],[855,535]]);
  assert.equal(sample.userData.renderOnly,true);assert.equal(sample.userData.originalProceduralAssets,true);
  assert.deepEqual(sample.userData.footprints,sampleStreetFootprints(world));
  assert.equal(sample.userData.doorHeight,22);assert.equal(sample.userData.groundFloorHeight,32);
  const original=createPlayer(),decorated=createPlayer(),input={throttle:true};
  for(let i=0;i<100;i++){updatePlayer(original,input,.016,createWorld());updatePlayer(decorated,input,.016,world);}
  assert.deepEqual(decorated,original,'Render-only detail must not alter driving/collision results');
});

test('all elevated decorative geometry stays inside the existing building footprints',()=>{
  const world=createWorld(),sample=createSampleStreet(world),footprints=sampleStreetFootprints(world),epsilon=.001;
  sample.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const positions=mesh.geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
      assert.ok(x>=SAMPLE_STREET_BOUNDS.minX-epsilon&&x<=SAMPLE_STREET_BOUNDS.maxX+epsilon&&z>=SAMPLE_STREET_BOUNDS.minZ-epsilon&&z<=SAMPLE_STREET_BOUNDS.maxZ+epsilon,`${mesh.name}: geometry escaped the sample area`);
      if(y>1.2)assert.ok(footprints.some(b=>x>=b.x-epsilon&&x<=b.x+b.w+epsilon&&z>=b.z-epsilon&&z<=b.z+b.d+epsilon&&y<=b.height+12),`${mesh.name}: floating geometry at ${x},${y},${z} extends the physical obstacle`);
    }
  });
});

test('road surface overlays are below the original lane and crosswalk paint',()=>{
  const sample=createSampleStreet(createWorld()),road=sample.getObjectByName('sample-asphalt');
  assert.ok(road);const p=road.geometry.attributes.position;
  for(let i=0;i<p.count;i++)assert.ok(p.getY(i)<.51);
  assert.equal(road.castShadow,false);assert.equal(road.receiveShadow,true);
  assert.equal(sample.userData.roadPolygons.length,3);
});

test('architectural layers have world-scale UVs and generated PBR maps',()=>{
  const sample=createSampleStreet(createWorld()),names=new Set();sample.traverse(m=>{for(const n of m.userData.parts||[])names.add(n);});
  for(const part of ['deep-shop-shadow','warm-interior-backwall','shop-counter','original-shop-sign','window-reveal','recessed-window','ceramic-spandrel','base-splash-weathering','facade-service-wire'])assert.ok(names.has(part),part);
  for(const name of ['ceramic-tile','aged-concrete','asphalt','paving','wood','galvanized-metal']){
    const mesh=sample.getObjectByName(`sample-${name}`),m=mesh.material;
    assert.ok(m.map.isDataTexture);assert.ok(m.normalMap.isDataTexture);assert.ok(m.roughnessMap.isDataTexture);
    assert.ok(new Set(m.map.image.data).size>20,`${name} is textured rather than flat-colored`);
    assert.ok(m.normalScale.x>0&&m.normalScale.x<.2);assert.equal(m.normalScale.x,m.normalScale.y);assert.equal(m.bumpMap,null);assert.ok(new Set(m.normalMap.image.data.filter((_,i)=>i%4===0)).size>1,'normal texture retains actual surface relief');
    const uv=mesh.geometry.attributes.uv;assert.ok(Array.from(uv.array).some(v=>v>1),'Materials use world-scale repeats');
  }
  assert.deepEqual(sample.userData.shops,SAMPLE_STREET_SHOPS.map(s=>s.name));
  assert.ok(sample.getObjectByName('sample-glass-highlights').material.transparent,'Shop glazing must preserve the modeled interior depth');
});

test('static sample stays within a small draw-call and triangle budget',()=>{
  const sample=createSampleStreet(createWorld());let calls=0,triangles=0;
  sample.traverse(mesh=>{if(mesh.isMesh){calls++;triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;assert.equal(mesh.geometry.attributes.color.count,mesh.geometry.attributes.position.count);}});
  assert.ok(calls<=16,`${calls} draw calls`);assert.ok(triangles<=22000,`${triangles} triangles`);
  assert.equal(calls,sample.userData.drawCalls);assert.equal(triangles,sample.userData.triangles);
});
