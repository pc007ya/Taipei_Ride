import * as THREE from '../vendor/three.module.js';
import { ROADS, ROAD_WIDTH, LANDMARKS } from './world.js';
import { QUEST_STATIONS } from './session.js';
// The 2D simulation's (x, y) ground coordinates map to Three.js (x, z).
// Elevation is exclusively the Three.js y axis; +simulation-y is south/+z.
export function worldToScene(x,y,height=0){return new THREE.Vector3(x,height,y);}
export function applyVehiclePose(mesh,entity){mesh.position.copy(worldToScene(entity.x,entity.y));mesh.rotation.y=-entity.angle;}
export function chaseCameraPose(player,heading=player.angle,mobile=false){
  const follow=mobile?103:119;
  return {position:worldToScene(player.x-Math.cos(heading)*follow,player.y-Math.sin(heading)*follow,66),target:worldToScene(player.x+Math.cos(heading)*45,player.y+Math.sin(heading)*45,12)};
}
// Camera blockers are intentionally separate from the driving collision layer.
// Hard AABBs include buildings/market stalls only. Trees and thin street props
// are soft occluders: fade them rather than pushing the camera into the rider.
export function createCameraBlockers(world){
 const boxes=world.buildings.map(o=>{
  const pad=o.type==='building'?1:o.type==='tower'?12:18;
  const height=o.type==='tower'?279:o.h+(o.type==='building'?12:24);
  return new THREE.Box3(worldToScene(o.x-pad,o.y-pad,0),worldToScene(o.x+o.w+pad,o.y+o.d+pad,height));
 });
 for(const o of world.stalls)boxes.push(new THREE.Box3(worldToScene(o.x-1,o.y-4,0),worldToScene(o.x+o.w+1,o.y+o.d+4,28)));
 return boxes;
}
function clipCameraSegment(player,desired,blockers,clearance=7){
 const focus=worldToScene(player.x,player.y,20),delta=desired.clone().sub(focus),length=delta.length();
 if(length<1e-6)return desired.clone();
 const ray=new THREE.Ray(focus,delta.multiplyScalar(1/length)),hit=new THREE.Vector3();let allowed=length;
 for(const bounds of blockers){
  // The rider can pass under foliage/eaves; an enclosing approximate box cannot
  // describe an entry obstruction. Actual building interiors are not drivable.
  if(bounds.containsPoint(focus))continue;
  if(ray.intersectBox(bounds,hit))allowed=Math.min(allowed,Math.max(.8,focus.distanceTo(hit)-clearance));
 }
 return focus.addScaledVector(ray.direction,allowed);
}
export function constrainCameraPosition(player,desired,blockers,clearance=7){
 const focus=worldToScene(player.x,player.y,20),clipped=clipCameraSegment(player,desired,blockers,clearance);
 if(clipped.distanceTo(focus)>=42)return clipped;
 // A wall very close behind the scooter must not force the camera inside the
 // rider/near plane. Temporarily move higher; try side views if a roof blocks it.
 const alternatives=[worldToScene(player.x,player.y,110),worldToScene(player.x+80,player.y,96),worldToScene(player.x-80,player.y,96),worldToScene(player.x,player.y+80,96),worldToScene(player.x,player.y-80,96)];
 let best=clipped;
 for(const candidate of alternatives){const safe=clipCameraSegment(player,candidate,blockers,clearance);if(safe.distanceTo(focus)>=42)return safe;if(safe.distanceTo(focus)>best.distanceTo(focus))best=safe;}
 return best;
}
export function cameraAimTarget(player,heading,position){
 const fraction=THREE.MathUtils.clamp(Math.hypot(position.x-player.x,position.z-player.y)/119,.1,1);
 return worldToScene(player.x+Math.cos(heading)*32*fraction,player.y+Math.sin(heading)*32*fraction,16+8*(1-fraction));
}
export function updateFoliageVisibility(foliage,player,cameraPosition=null){
 const focus=worldToScene(player.x,player.y,20),hit=new THREE.Vector3();
 const length=cameraPosition?focus.distanceTo(cameraPosition):0;
 const ray=cameraPosition?new THREE.Ray(focus,cameraPosition.clone().sub(focus).normalize()):null;
 for(const entry of foliage){
  const expanded=entry.bounds.clone().expandByScalar(8);
  const faded=entry.bounds.distanceToPoint(focus)<6||!!(ray&&ray.intersectBox(expanded,hit)&&focus.distanceTo(hit)<length);
  if(entry.mesh.material.transparent!==faded){entry.mesh.material.transparent=faded;entry.mesh.material.needsUpdate=true;}
  entry.mesh.material.opacity=faded?.16:1;entry.mesh.material.depthWrite=!faded;
 }
}
const PALETTE = { sky:0xb4d7cd, ground:0x7fa47c, road:0x667b7c, sidewalk:0xc6cbb8 };
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.87,...extra});
const unitBox=new THREE.BoxGeometry(1,1,1);
const mats=new Map();
function material(color){if(!mats.has(color))mats.set(color,mat(color));return mats.get(color);}
export function box(group,x,y,z,w,h,d,color,extra={}){
  const mesh=new THREE.Mesh(unitBox,typeof color==='object'?color:material(color));mesh.position.set(x,y+h/2,z);mesh.scale.set(w,h,d);mesh.castShadow=!!extra.shadow;mesh.receiveShadow=true;group.add(mesh);return mesh;
}
function cylinder(group,x,y,z,r,h,color,sides=8){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,sides),material(color));mesh.position.set(x,y+h/2,z);group.add(mesh);return mesh;}
function makeTextTexture(text,bg='#244e43',fg='#f5efd1'){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,256,96);c.strokeStyle=fg;c.lineWidth=3;c.strokeRect(7,7,242,82);c.font=`bold ${text.length>3?36:48}px "Noto Sans CJK TC", "Microsoft JhengHei",sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=fg;c.fillText(text,128,49);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function sign(group,text,x,y,z,w=38,h=14,color='#244e43'){
  const texture=makeTextTexture(text,color);if(!texture)return;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));mesh.position.set(x,y,z);group.add(mesh);
}
export function createScooter(){
  const g=new THREE.Group();g.name='player-scooter';
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(13,24),new THREE.MeshBasicMaterial({color:0x143532,transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.6;shadow.scale.set(1.3,.65,1);g.add(shadow);
  const paint=mat(0xcce984,{metalness:.15,roughness:.5});
  for(const x of [-10,11]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(3.5,3.5,3,12),material(0x20373b));wheel.rotation.x=Math.PI/2;wheel.position.set(x,4,0);g.add(wheel);}
  box(g,-4,6,0,18,5,8,paint);box(g,9,6,0,5,11,8,paint);box(g,-4,12,0,12,2.5,7,0x294d43);box(g,0,5,0,18,1,8,0x829694);
  box(g,10,16,0,2,1.5,14,0x334b4b);box(g,12,11,0,1.5,4,5,0xf9eeb8);
  const cargo=box(g,-13,12,0,8,7,9,0xd8ae68);cargo.name='delivery-cargo';cargo.visible=false;
  const riderStart=g.children.length;
  box(g,-3,14,0,7,10,6,0xe7ad69);box(g,-3,12,4,7,3,3,0x314f59);box(g,-3,12,-4,7,3,3,0x314f59);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(4.8,12,8),material(0xf4f0d3));helmet.position.set(-2,28,0);g.add(helmet);
  box(g,2,27,0,1,3.5,6.5,0x426160);
  for(const z of [-3.5,3.5]){const arm=box(g,3,19,z,10,2,2,0xecc790);arm.rotation.z=-.4;}
  for(const part of g.children.slice(riderStart))part.userData.riderPart=true;
  box(g,-13,8,0,1,2,5,mat(0xe2745c,{emissive:0xcf3522,emissiveIntensity:.3}));
  return g;
}
export function setMountedRiderVisible(scooter,visible){for(const part of scooter.children)if(part.userData.riderPart)part.visible=visible;}
export function createWalker(color=0xe7ad69){
 const g=new THREE.Group();g.name='walking-player';
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(6,16),new THREE.MeshBasicMaterial({color:0x153b32,transparent:true,opacity:.22,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.6;g.add(shadow);
 for(const z of [-2.3,2.3]){const leg=box(g,0,0,z,3.5,13,3.5,0x31505a);leg.name=z<0?'left-leg':'right-leg';}
 box(g,0,12,0,7.5,12,7,color);
 const head=new THREE.Mesh(new THREE.SphereGeometry(4.7,12,8),material(0xf3edce));head.position.set(0,29,0);g.add(head);box(g,4.3,28,0,1,3,6,0x426160);
 for(const z of [-5,5])box(g,0,13,z,2.5,9,2.5,0xeac495);
 const cargo=box(g,7,14,0,7,7,8,0xd8ae68);cargo.name='delivery-cargo';cargo.visible=false;
 return g;
}
function createCar(car){const g=new THREE.Group();box(g,0,4,0,32,9,15,car.color);box(g,-1,13,0,17,7,13,car.color);box(g,8,14,0,1,5,12,0x395864);box(g,-10,14,0,1,5,12,0x395864);for(const x of [-10,10])for(const z of [-8,8]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(3,3,2,8),material(0x273738));wheel.rotation.x=Math.PI/2;wheel.position.set(x,4,z);g.add(wheel);}box(g,16.5,8,0,1,2,12,mat(0xefefb8,{emissive:0xffd994,emissiveIntensity:.6}));return g;}
function createTree(o){const g=new THREE.Group();g.position.set(o.x,0,o.y);cylinder(g,0,0,0,1.7,o.h*.75,0x887d59);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(o.h*.49,1),material(o.color).clone());crown.name='tree-crown';crown.position.set(0,o.h,0);crown.scale.y=1.15;g.add(crown);return g;}
function roof(group,x,y,z,w,d,color){
  const geo=new THREE.BufferGeometry();const vertices=new Float32Array([-w/2,0,-d/2,w/2,0,-d/2,w/2,18,0,-w/2,18,0,-w/2,0,d/2,w/2,0,d/2]);
  geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.setIndex([0,1,2,0,2,3,4,3,2,4,2,5,0,3,4,1,5,2,0,4,5,0,5,1]);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material(color));mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
export function createCity(world){
  const city=new THREE.Group();city.name='original-taipei-city';
  box(city,800,-3,800,1900,2,1900,PALETTE.ground).name='ground-surface';
  // Distant original low-poly hills frame the northern skyline.
  for(let i=0;i<11;i++){
    const hill=new THREE.Mesh(new THREE.ConeGeometry(190+(i%3)*35,95+(i%4)*26,6),material(i%2?0x648c7f:0x719688));
    hill.position.set(-180+i*200,35+(i%4)*13,-250-(i%2)*90);hill.rotation.y=i*.41;hill.scale.z=.7;city.add(hill);
  }
  box(city,-40,-1.1,800,270,1,1900,0x559ba5);box(city,107,-.3,810,28,1,1500,0xc8c6a5);
  for(let ix=0;ix<4;ix++)for(let iy=0;iy<4;iy++)box(city,ROADS[ix]+160,-.2,ROADS[iy]+160,250,1,250,PALETTE.sidewalk);
  box(city,1277,.6,1277,225,.3,225,0x779969);
  for(const road of ROADS){box(city,road,-.6,800,ROAD_WIDTH,1,1440,PALETTE.road).name='road-north-south';box(city,800,-.55,road,1440,1,ROAD_WIDTH,PALETTE.road).name='road-east-west';}
  const paintMatrices=[], temp=new THREE.Object3D();
  function marking(x,z,w,d){temp.position.set(x,.51,z);temp.scale.set(w,.08,d);temp.updateMatrix();paintMatrices.push(temp.matrix.clone());}
  for(const road of ROADS)for(let t=90;t<1510;t+=34){if(ROADS.some(r=>Math.abs(r-t)<52))continue;marking(road,t,1.6,15);marking(t,road,15,1.6);}
  for(const x of ROADS)for(const z of ROADS)for(let i=0;i<6;i++){marking(x-22+i*8,z-39,4,9);marking(x-22+i*8,z+39,4,9);marking(x-39,z-22+i*8,9,4);marking(x+39,z-22+i*8,9,4);}
  const markings=new THREE.InstancedMesh(unitBox,material(0xd9dec3),paintMatrices.length);paintMatrices.forEach((m,i)=>markings.setMatrixAt(i,m));city.add(markings);
  const windows=[],darkWindows=[];
  const glass=mat(0x84a4a7,{emissive:0xfbd884,emissiveIntensity:0});
  const darkGlass=mat(0x4e727d);
  function windowBox(x,y,z,w,h,d,lit){temp.position.set(x,y,z);temp.scale.set(w,h,d);temp.updateMatrix();(lit?windows:darkWindows).push(temp.matrix.clone());}
  for(const o of world.buildings){
    const cx=o.x+o.w/2,cz=o.y+o.d/2;
    if(o.type==='tower'){
      box(city,cx,0,cz,104,23,104,0x80b5a6);
      for(let i=0;i<8;i++){const w=70-i*4.3,y=23+i*23;box(city,cx,y,cz,w,21,w,0x66a99c);box(city,cx,y+20,cz,w+6,3,w+6,0x9cccc0);for(let v=0;v<5;v++){const xx=cx-w/2+8+v*(w-16)/4;windowBox(xx,y+11,cz+w/2+.3,1.3,16,.3,true);windowBox(cx+w/2+.3,y+11,cz-w/2+8+v*(w-16)/4,.3,16,1.3,true);}}
      box(city,cx,207,cz,23,22,23,0x8abfb1);cylinder(city,cx,229,cz,2,47,0xc3dcca,6);sign(city,'101',cx,13,cz+53,30,13,'#5e9e90');continue;
    }
    box(city,cx,0,cz,o.w,o.h,o.d,o.color);
    if(o.type==='building'){
      const floors=Math.max(2,Math.floor(o.h/13));
      for(let f=0;f<floors;f++)for(let a=0;a<4;a++){
        const y=9+f*12,xx=o.x+8+a*(o.w-12)/4,zz=o.y+8+a*(o.d-12)/4,lit=(a+f+Math.round(o.seed*5))%3!==0;
        windowBox(xx,y,o.y+o.d+.3,6,7,.5,lit);windowBox(o.x+o.w+.3,y,zz,.5,7,6,lit);windowBox(xx,y,o.y-.3,6,7,.5,lit);windowBox(o.x-.3,y,zz,.5,7,6,lit);
      }
      box(city,o.x+14,o.h, o.y+14,13,9,12,0x99ada9);if(o.seed>.65)cylinder(city,o.x+o.w-15,o.h,o.y+15,5,10,0xaab9b1);
      if(o.sign)sign(city,o.sign,cx,12,o.y+o.d+.8,o.w-7,13,o.seed>.8?'#a84736':'#356b60');
    }else{
      const temple=o.type==='temple';for(let i=0;i<4;i++)box(city,cx,i*3,cz,o.w+34-i*7,3,o.d+34-i*7,temple?0xbaa88d:0xe2e4d5);
      for(let i=0;i<6;i++)box(city,o.x+9+i*(o.w-18)/5,9,o.y+o.d+2,5,o.h-8,5,temple?0x9f372c:0xf2eedb);
      roof(city,cx,o.h,cz,o.w+24,o.d+24,temple?0xba4d36:0x416c9b);sign(city,temple?'龍山寺':'自由',cx,o.h-9,o.y+o.d+5,temple?52:45,15,temple?'#882f29':'#e4e4d6');
      if(temple)for(const x of [o.x+5,o.x+o.w-5]){const lantern=new THREE.Mesh(new THREE.SphereGeometry(4,8,6),mat(0xf9a36c,{emissive:0xf38c41,emissiveIntensity:.6}));lantern.position.set(x,o.h-12,o.y+o.d+14);city.add(lantern);}
    }
  }
  for(const [matr,mt]of [[windows,glass],[darkWindows,darkGlass]]){const mesh=new THREE.InstancedMesh(unitBox,mt,matr.length);matr.forEach((m,i)=>mesh.setMatrixAt(i,m));city.add(mesh);}
  for(const o of world.stalls){box(city,o.x+o.w/2,0,o.y+o.d/2,o.w,14,o.d,0x99795c);for(let i=0;i<4;i++)box(city,o.x+(i+.5)*o.w/4,24,o.y+o.d/2,o.w/4,3,o.d+8,i%2?0xf8deb0:o.color);for(const x of [o.x+1,o.x+o.w-1])cylinder(city,x,0,o.y+o.d-1,.7,25,0xdfc9a2,5);sign(city,o.sign,o.x+o.w/2,17,o.y+o.d+.6,o.w-2,10,'#927054');}
  const foliage=[],softOccluders=[];
  for(const tree of world.trees){const g=createTree(tree);city.add(g);g.updateMatrixWorld(true);const crown=g.getObjectByName('tree-crown');const entry={mesh:crown,bounds:new THREE.Box3().setFromObject(crown)};foliage.push(entry);softOccluders.push(entry);for(const mesh of g.children)if(mesh!==crown){mesh.material=mesh.material.clone();softOccluders.push({mesh,bounds:new THREE.Box3().setFromObject(mesh)});}}
  // Lamp columns and public-space seats enrich the street scale without external assets.
  const lampMaterial=mat(0xf5edc7,{emissive:0xffd98e,emissiveIntensity:.1});
  for(const road of ROADS)for(let t=270;t<1450;t+=210){
    const pieces=[cylinder(city,road+40,0,t,1,33,0x48685e,5),box(city,road+35,31,t,13,1.5,3,0x48685e),box(city,road+29,30,t,5,1,5,lampMaterial)];
    pieces.forEach((mesh,i)=>{mesh.material=mesh.material.clone();mesh.userData.lampLight=i===2;mesh.updateMatrixWorld(true);softOccluders.push({mesh,bounds:new THREE.Box3().setFromObject(mesh)});});
  }
  for(let i=0;i<8;i++)box(city,110,4,220+i*151,8,3,22,0xb99168);
  return {city,glass,lampMaterial,foliage,softOccluders};
}
export class Renderer3D{
  constructor(canvas,world){
    this.canvas=canvas;
    // Context creation is the only capability check. If it fails, main.js uses Canvas 2D.
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(PALETTE.sky);this.scene.fog=new THREE.Fog(PALETTE.sky,350,1150);
    this.camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,1,1800);this.camera.position.set(800,85,660);
    this.cameraBlockers=createCameraBlockers(world);
    this.light=new THREE.HemisphereLight(0xd9efe7,0x5e7154,2.4);this.scene.add(this.light);
    this.sun=new THREE.DirectionalLight(0xffefcb,2.3);this.sun.position.set(-200,500,-150);this.scene.add(this.sun);
    const created=createCity(world);this.scene.add(created.city);this.glass=created.glass;this.lampMaterial=created.lampMaterial;this.foliage=created.foliage;this.softOccluders=created.softOccluders;
    this.scooter=createScooter();this.scene.add(this.scooter);this.carMeshes=[];
    this.markers=[...LANDMARKS,...Object.values(QUEST_STATIONS)].map(l=>{const g=new THREE.Group();g.position.set(l.x,1,l.y);const ring=new THREE.Mesh(new THREE.TorusGeometry(27,1.25,8,48),new THREE.MeshBasicMaterial({color:l.color}));ring.rotation.x=Math.PI/2;g.add(ring);const pin=new THREE.Mesh(new THREE.OctahedronGeometry(5,0),new THREE.MeshBasicMaterial({color:l.color}));pin.position.y=32;g.add(pin);this.scene.add(g);return {l,g,ring,pin};});
    this.questResidents=Object.values(QUEST_STATIONS).map((station,i)=>{const npc=createWalker([0xc78062,0x719baa,0xa29968][i]);npc.name=station.id;applyVehiclePose(npc,{x:station.x+29,y:station.y,angle:Math.PI});this.scene.add(npc);return npc;});
    this.pedestrians=Array.from({length:20},(_,i)=>{const g=new THREE.Group();box(g,0,2,0,3,6,2.5,[0xc9815e,0x799aab,0xcdbd78][i%3]);const head=new THREE.Mesh(new THREE.SphereGeometry(1.7,6,5),material(0xe6c9a1));head.position.y=10;g.add(head);this.scene.add(g);return g;});
    this.time=0;this.lastNight=null;this.look=new THREE.Vector3(800,16,515);this.heading=-Math.PI/2;this.resize();
  }
  resize(){this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.fov=innerWidth<650?66:58;this.camera.updateProjectionMatrix();}
  render(state,dt){
    const {player,traffic,night,stamps,target}=state;this.time+=dt;
    if(this.lastNight!==night){this.lastNight=night;const bg=night?0x112835:PALETTE.sky;this.scene.background.set(bg);this.scene.fog.color.set(bg);this.light.intensity=night?.95:2.4;this.sun.intensity=night?.5:2.3;this.sun.color.set(night?0xb9cddc:0xffefcb);this.glass.emissiveIntensity=night?1.15:0;this.lampMaterial.emissiveIntensity=night?2:.1;for(const entry of this.softOccluders)if(entry.mesh.userData.lampLight)entry.mesh.material.emissiveIntensity=night?2:.1;this.renderer.toneMappingExposure=night?1.05:1.1;}
    const walking=state.mode==='walking',carrying=state.quest?.stage==='carrying'||state.quest?.stage==='deliver';this.scooter.getObjectByName('delivery-cargo').visible=carrying&&!walking;applyVehiclePose(this.scooter,walking?state.vehicle:player);setMountedRiderVisible(this.scooter,!walking);
    if(walking){if(!this.walker){this.walker=createWalker();this.scene.add(this.walker);}this.walker.visible=true;this.walker.getObjectByName('delivery-cargo').visible=carrying;applyVehiclePose(this.walker,player);for(const leg of this.walker.children)if(leg.name.endsWith('-leg'))leg.rotation.z=Math.sin(this.time*9+(leg.name==='left-leg'?0:Math.PI))*Math.min(.35,Math.abs(player.speed)*.018);}
    else if(this.walker)this.walker.visible=false;
    let delta=player.angle-this.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));this.heading+=delta*Math.min(1,dt*3.5);
    const pose=chaseCameraPose(player,this.heading,innerWidth<650),want=constrainCameraPosition(player,pose.position,this.cameraBlockers);
    if(Math.hypot(this.camera.position.x-want.x,this.camera.position.z-want.z)>380)this.camera.position.copy(want);
    else this.camera.position.lerp(want,Math.min(1,dt*4.5));
    // The interpolated segment can cut through a corner even when its endpoints
    // are safe, so visibility is constrained again after smoothing.
    this.camera.position.copy(constrainCameraPosition(player,this.camera.position,this.cameraBlockers));
    const aim=cameraAimTarget(player,this.heading,this.camera.position);
    if(this.camera.position.distanceTo(worldToScene(player.x,player.y,20))<70||Math.hypot(this.camera.position.x-player.x,this.camera.position.z-player.y)<40)this.look.copy(aim);
    else this.look.lerp(aim,Math.min(1,dt*6));
    this.camera.lookAt(this.look);updateFoliageVisibility(this.softOccluders,player,this.camera.position);
    traffic.forEach((car,i)=>{if(!this.carMeshes[i]){this.carMeshes[i]=createCar(car);this.scene.add(this.carMeshes[i]);}applyVehiclePose(this.carMeshes[i],car);});
    for(const m of this.markers){const quest=m.l.type==='quest',done=quest?state.quest?.stage==='completed':stamps.includes(m.l.id);m.g.visible=!quest||target?.id===m.l.id;m.pin.visible=!done;m.pin.position.y=34+Math.sin(this.time*2)*3;m.pin.rotation.y=this.time*.7;m.ring.material.color.set(done?0xc2efa1:m.l.color);m.ring.scale.setScalar(target?.id===m.l.id?1.07+Math.sin(this.time*2)*.06:1);}
    this.pedestrians.forEach((p,i)=>{p.position.set(ROADS[i%5]+45,0,180+(i*91+this.time*(i%2?5:-5)+1300)%1220);});
    this.renderer.render(this.scene,this.camera);
  }
  resetCamera(player){this.heading=player.angle;const pose=chaseCameraPose(player,player.angle,innerWidth<650);this.camera.position.copy(constrainCameraPosition(player,pose.position,this.cameraBlockers));this.look.copy(cameraAimTarget(player,player.angle,this.camera.position));}
}
