import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Vector3, Raycaster, Scene } from '../vendor/three.module.js';
import { createWorld, START } from '../src/world.js';
import { createCity, createScooter, worldToScene, applyVehiclePose, chaseCameraPose } from '../src/renderer3d.js';
test('3D city contains real mesh geometry and efficient instanced windows',()=>{
 const {city,glass}=createCity(createWorld());let meshes=0,instances=0,vertices=0;
 city.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;if(o.isInstancedMesh)instances+=o.count;}});
 assert.ok(meshes>250&&meshes<420,'Static instancing keeps scene draw calls bounded');assert.ok(instances>6000);assert.ok(vertices>10000);assert.equal(glass.emissiveIntensity,0);
 const bounds=new Box3().setFromObject(city);assert.ok(bounds.max.y>=275,'Tower creates an actual vertical skyline');
});
test('3D scooter has volumetric wheels, body, and rider',()=>{
 const scooter=createScooter(),bounds=new Box3().setFromObject(scooter);
 assert.ok(scooter.children.length>15);assert.ok(bounds.max.y>30);assert.ok(bounds.max.x-bounds.min.x>20);assert.ok(bounds.max.z-bounds.min.z>10);
});
test('third-person camera frames the rider from behind at spawn',()=>{
 const c=new PerspectiveCamera(58,1.5,1,1800),pose=chaseCameraPose(START);c.position.copy(pose.position);c.lookAt(pose.target);c.updateMatrixWorld();
 const p=new Vector3(START.x,16,START.y).project(c);assert.ok(Math.abs(p.x)<.05);assert.ok(p.y>-.8&&p.y<.5);assert.ok(p.z<1);
});

test('world coordinates map to XZ while elevation remains Three.js Y',()=>{
 assert.deepEqual(worldToScene(120,340,25).toArray(),[120,25,340]);
 const scooter=createScooter();
 for(const angle of [-Math.PI/2,0,Math.PI/2,Math.PI]){
  applyVehiclePose(scooter,{x:800,y:515,angle});
  assert.deepEqual(scooter.position.toArray(),[800,0,515]);
  const forward=new Vector3(1,0,0).applyQuaternion(scooter.quaternion);
  assert.ok(Math.abs(forward.x-Math.cos(angle))<1e-9);
  assert.ok(Math.abs(forward.z-Math.sin(angle))<1e-9);
  assert.ok(Math.abs(forward.y)<1e-9);
 }
});
test('ground and road geometry are horizontal and use proper depth testing',()=>{
 const {city}=createCity(createWorld());city.updateMatrixWorld(true);
 const ground=city.getObjectByName('ground-surface');
 const bounds=new Box3().setFromObject(ground);
 assert.equal(bounds.max.y,-1);assert.equal(bounds.min.y,-3);
 const roads=city.children.filter(o=>o.name.startsWith('road-'));
 assert.equal(roads.length,10);
 for(const road of roads){
  const b=new Box3().setFromObject(road),size=b.getSize(new Vector3());
  assert.ok(Math.abs(size.y-1)<1e-8);assert.ok(size.x>=70&&size.z>=70);
  assert.ok(b.min.y>bounds.max.y,'Road floats above ground, never vertically through it');
  assert.ok(b.max.y<1,'Road top stays below wheel height');
  assert.equal(road.material.depthTest,true);assert.equal(road.material.depthWrite,true);
 }
});
test('spawn camera rays hit rider before ground in desktop and portrait views',()=>{
 const scene=new Scene(),{city}=createCity(createWorld()),scooter=createScooter();
 applyVehiclePose(scooter,START);scene.add(city,scooter);scene.updateMatrixWorld(true);
 for(const [mobile,aspect,fov] of [[false,1.5,58],[true,390/844,66]]){
  const pose=chaseCameraPose(START,START.angle,mobile),camera=new PerspectiveCamera(fov,aspect,1,1800);
  camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld(true);
  for(const height of [20,28]){
   const target=worldToScene(START.x,START.y,height),projected=target.clone().project(camera);
   assert.ok(Math.abs(projected.x)<.05&&projected.y>-.85&&projected.y<.8);
   const ray=new Raycaster(pose.position,target.clone().sub(pose.position).normalize());
   const hits=ray.intersectObjects(scene.children,true);
   assert.ok(hits.length>0);
   let owner=hits[0].object;while(owner&&owner!==scooter)owner=owner.parent;
   assert.equal(owner,scooter,'The rider must be the first visible surface, not a ground/road triangle');
   const groundHit=hits.find(hit=>hit.object.name==='ground-surface');
   if(groundHit)assert.ok(groundHit.distance>hits[0].distance);
  }
 }
});

test('west-facing road camera shortens before the blocking building',async()=>{
 const {createCameraBlockers,constrainCameraPosition,cameraAimTarget}=await import('../src/renderer3d.js');
 const world=createWorld(),player={x:800,y:550,angle:Math.PI},scene=new Scene(),{city}=createCity(world),scooter=createScooter();
 applyVehiclePose(scooter,player);scene.add(city,scooter);scene.updateMatrixWorld(true);
 const desired=chaseCameraPose(player).position,corrected=constrainCameraPosition(player,desired,createCameraBlockers(world));
 assert.equal(desired.x,919);assert.ok(corrected.x<desired.x-20,'Camera must move ahead of the wall');
 const target=worldToScene(player.x,player.y,20),ray=new Raycaster(corrected,target.clone().sub(corrected).normalize());
 const hits=ray.intersectObjects(scene.children,true);let owner=hits[0].object;while(owner&&owner!==scooter)owner=owner.parent;
 assert.equal(owner,scooter,'Corrected camera sees the rider before any wall');
 const camera=new PerspectiveCamera(58,1.5,1,1800);camera.position.copy(corrected);camera.lookAt(cameraAimTarget(player,player.angle,corrected));camera.updateMatrixWorld();
 const helmet=worldToScene(player.x,player.y,28).project(camera);assert.ok(Math.abs(helmet.x)<1&&Math.abs(helmet.y)<1&&helmet.z<1);
});
test('post-interpolation camera constraint keeps turning views out of occluders',async()=>{
 const {createCameraBlockers,constrainCameraPosition,cameraAimTarget}=await import('../src/renderer3d.js');
 const world=createWorld(),blockers=createCameraBlockers(world),{city}=createCity(world);city.updateMatrixWorld(true);
 const points=[{x:800,y:550},{x:800,y:620},{x:480,y:550},{x:1120,y:710}];
 for(const point of points){
  let previous=chaseCameraPose({...point,angle:-Math.PI/2}).position;
  for(let i=0;i<36;i++){
   const player={...point,angle:-Math.PI/2+i*Math.PI/18};
   const wanted=constrainCameraPosition(player,chaseCameraPose(player).position,blockers);
   const interpolated=previous.clone().lerp(wanted,.22);
   const position=constrainCameraPosition(player,interpolated,blockers),focus=worldToScene(player.x,player.y,20);
   const ray=new Raycaster(focus,position.clone().sub(focus).normalize(),.2,focus.distanceTo(position));
   const hits=ray.intersectObjects(city.children,true).filter(hit=>hit.object.material?.transparent!==true);
   assert.equal(hits.length,0,`Occlusion at (${point.x},${point.y}), turn ${i}`);
   const camera=new PerspectiveCamera(58,1.5,1,1800);camera.position.copy(position);camera.lookAt(cameraAimTarget(player,player.angle,position));camera.updateMatrixWorld();
   const rider=focus.clone().project(camera);assert.ok(Math.abs(rider.x)<1&&Math.abs(rider.y)<1&&rider.z<1);
   previous=position;
  }
 }
});

test('continuous throttle-and-turn play keeps the smoothed chase camera clear',async()=>{
 const {createCameraBlockers,constrainCameraPosition,updateFoliageVisibility}=await import('../src/renderer3d.js');
 const {createPlayer,updatePlayer}=await import('../src/world.js');
 const world=createWorld(),blockers=createCameraBlockers(world),{city,softOccluders}=createCity(world);city.updateMatrixWorld(true);
 for(const steer of ['left','right']){
  const player=createPlayer();let heading=player.angle,position=new Vector3(800,85,660);
  for(let frame=0;frame<600;frame++){
   updatePlayer(player,{throttle:true,[steer]:true},.02,world);
   const delta=Math.atan2(Math.sin(player.angle-heading),Math.cos(player.angle-heading));heading+=delta*.07;
   const wanted=constrainCameraPosition(player,chaseCameraPose(player,heading).position,blockers);
   position.lerp(wanted,.09);position.copy(constrainCameraPosition(player,position,blockers));updateFoliageVisibility(softOccluders,player,position);
   for(const height of [18,28]){
    const target=worldToScene(player.x,player.y,height),length=position.distanceTo(target);
    const ray=new Raycaster(position,target.clone().sub(position).normalize(),.1,length-.2);
    const hits=ray.intersectObjects(city.children,true).filter(hit=>hit.object.material?.transparent!==true);
    assert.equal(hits.length,0,`${steer} frame ${frame}: camera blocks rider at height ${height}`);
   }
  }
 }
});

test('nearby tree crowns fade without changing distant foliage materials',async()=>{
 const {updateFoliageVisibility}=await import('../src/renderer3d.js');const {foliage}=createCity(createWorld());
 const point=foliage[0].bounds.getCenter(new Vector3()),player={x:point.x,y:point.z};updateFoliageVisibility(foliage,player);
 assert.equal(foliage[0].mesh.material.transparent,true);assert.equal(foliage[0].mesh.material.opacity,.16);assert.equal(foliage[0].mesh.material.depthWrite,false);
 assert.ok(foliage.some(e=>e.mesh.material.opacity===1));updateFoliageVisibility(foliage,{x:-9999,y:-9999});assert.ok(foliage.every(e=>e.mesh.material.opacity===1));
});

test('hard blockers exclude foliage and extreme wall proximity keeps camera outside rider',async()=>{
 const {createCameraBlockers,constrainCameraPosition,cameraAimTarget}=await import('../src/renderer3d.js');const world=createWorld(),blockers=createCameraBlockers(world);
 assert.equal(blockers.length,world.buildings.length+world.stalls.length);
 const player={x:846,y:550,angle:Math.PI};
 const position=constrainCameraPosition(player,chaseCameraPose(player).position,blockers),focus=worldToScene(player.x,player.y,20);
 assert.ok(position.distanceTo(focus)>=42);
 for(const [aspect,fov]of [[1.5,58],[390/844,66]]){
  const camera=new PerspectiveCamera(fov,aspect,1,1800);camera.position.copy(position);camera.lookAt(cameraAimTarget(player,player.angle,position));camera.updateMatrixWorld();
  for(const height of [18,28]){const projected=worldToScene(player.x,player.y,height).project(camera);assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&projected.z>-1&&projected.z<1);}
 }
});

test('actual 3D render loop keeps rider in front of camera and inside desktop/mobile frusta',async()=>{
 const T=await import('../vendor/three.module.js');
 const {Renderer3D,createCameraBlockers}=await import('../src/renderer3d.js');
 const {createPlayer,updatePlayer}=await import('../src/world.js');
 for(const [width,height] of [[1440,960],[390,844],[844,390]])for(const direction of ['left','right']){
  globalThis.innerWidth=width;globalThis.innerHeight=height;
  const world=createWorld(),player=createPlayer(),made=createCity(world),r=Object.create(Renderer3D.prototype);
  Object.assign(r,{time:0,lastNight:null,scene:new T.Scene(),camera:new T.PerspectiveCamera(width<650?66:58,width/height,1,1800),cameraBlockers:createCameraBlockers(world),light:new T.HemisphereLight(),sun:new T.DirectionalLight(),glass:made.glass,lampMaterial:made.lampMaterial,softOccluders:made.softOccluders,scooter:createScooter(),carMeshes:[],markers:[],pedestrians:[],heading:player.angle,look:new T.Vector3(800,16,515),renderer:{render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);},toneMappingExposure:1}});
  r.scene.background=new T.Color();r.scene.fog=new T.Fog(0,0,1);r.scene.add(made.city,r.scooter);r.camera.position.set(800,85,660);
  const state={player,traffic:[],night:false,stamps:[],target:null};
  for(let frame=0;frame<600;frame++){
   updatePlayer(player,{throttle:true,[direction]:true},.02,world);r.render(state,.02);
   const focus=worldToScene(player.x,player.y,20);assert.ok(r.camera.position.distanceTo(focus)>=42-1e-8);
   for(const h of [18,28]){
    const target=worldToScene(player.x,player.y,h),screen=target.clone().project(r.camera),label=`${width}x${height} ${direction} frame ${frame} height ${h}`;
    assert.ok(Math.abs(screen.x)<1&&Math.abs(screen.y)<1&&screen.z>-1&&screen.z<1,`Rider outside frustum: ${label}`);
    const ray=new T.Raycaster(r.camera.position,target.clone().sub(r.camera.position).normalize(),.1,r.camera.position.distanceTo(target)-.2);
    const hits=ray.intersectObject(made.city,true).filter(hit=>hit.object.material?.transparent!==true);
    assert.equal(hits.length,0,`Opaque object hides rider: ${label}`);
   }
  }
 }
});

test('3D mode separates parked scooter from walking actor and moves delivery cargo',async()=>{
 const T=await import('../vendor/three.module.js');const {Renderer3D,createCameraBlockers}=await import('../src/renderer3d.js');
 const world=createWorld(),made=createCity(world),player={x:820,y:515,angle:-Math.PI/2,speed:0},vehicle={x:800,y:515,angle:-Math.PI/2,speed:0},r=Object.create(Renderer3D.prototype);
 globalThis.innerWidth=1440;globalThis.innerHeight=960;
 Object.assign(r,{time:0,lastNight:null,scene:new T.Scene(),camera:new T.PerspectiveCamera(58,1.5,1,1800),cameraBlockers:createCameraBlockers(world),light:new T.HemisphereLight(),sun:new T.DirectionalLight(),glass:made.glass,lampMaterial:made.lampMaterial,softOccluders:made.softOccluders,scooter:createScooter(),carMeshes:[],markers:[],pedestrians:[],heading:player.angle,look:new T.Vector3(820,16,515),renderer:{render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);},toneMappingExposure:1}});
 r.scene.background=new T.Color();r.scene.fog=new T.Fog(0,0,1);r.scene.add(made.city,r.scooter);r.camera.position.set(820,85,660);
 const state={player,vehicle,mode:'walking',traffic:[],night:false,stamps:[],target:null,quest:{stage:'deliver'}};r.render(state,.02);
 assert.equal(r.scooter.position.x,800);assert.equal(r.walker.position.x,820);assert.equal(r.walker.visible,true);assert.ok(r.scooter.children.filter(p=>p.userData.riderPart).every(p=>!p.visible));assert.equal(r.walker.getObjectByName('delivery-cargo').visible,true);assert.equal(r.scooter.getObjectByName('delivery-cargo').visible,false);
 state.mode='riding';player.x=800;r.render(state,.02);assert.equal(r.walker.visible,false);assert.ok(r.scooter.children.filter(p=>p.userData.riderPart).every(p=>p.visible));assert.equal(r.scooter.getObjectByName('delivery-cargo').visible,true);
 state.quest.stage='completed';r.render(state,.02);assert.equal(r.scooter.getObjectByName('delivery-cargo').visible,false);
});
