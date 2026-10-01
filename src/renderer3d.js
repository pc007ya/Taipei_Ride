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
// Small, shared geometries keep articulated figures light enough for mobile WebGL.
const limbGeometry=new THREE.CylinderGeometry(1,1,1,8);
const headGeometry=new THREE.SphereGeometry(1,12,8);
function ellipsoid(group,name,x,y,z,rx,ry,rz,color){
 const mesh=new THREE.Mesh(headGeometry,typeof color==='object'?color:material(color));mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(rx,ry,rz);group.add(mesh);return mesh;
}
function limb(group,name,from,to,radius,color){
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),mesh=new THREE.Mesh(limbGeometry,material(color));
 mesh.name=name;mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.scale.set(radius,a.distanceTo(b),radius);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());group.add(mesh);return mesh;
}
function head(group,x,y,helmet=true){
 ellipsoid(group,'head',x,y,0,2.2,2.6,2.2,0xd8ac84);
 ellipsoid(group,helmet?'helmet':'hair',x-.25,y+1.3,0,2.45,1.8,2.4,helmet?0xf3edce:0x283a36);
 if(helmet)ellipsoid(group,'visor',x+1.95,y+.25,0,.65,1.15,2,mat(0x375456,{metalness:.3,roughness:.3}));
 else box(group,x+2.05,y-.5,0,.45,.8,1,0xc99571).name='nose';
}
export function createScooter(){
 const g=new THREE.Group();g.name='player-scooter';
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(13,24),new THREE.MeshBasicMaterial({color:0x143532,transparent:true,opacity:.2,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.6;shadow.scale.set(1.3,.65,1);g.add(shadow);
 const paint=mat(0xcce984,{metalness:.18,roughness:.45}),chrome=0xa5b8b3;
 for(const x of [-10,11]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(3.8,3.8,3.2,16),material(0x203238));wheel.name=x<0?'rear-wheel':'front-wheel';wheel.rotation.x=Math.PI/2;wheel.position.set(x,4,0);g.add(wheel);for(const z of [-1.7,1.7]){const hub=new THREE.Mesh(new THREE.CylinderGeometry(2,2,.25,12),material(chrome));hub.rotation.x=Math.PI/2;hub.position.set(x,4,z);g.add(hub);}}
 ellipsoid(g,'rear-fairing',-8,8,0,7,4.2,4.5,paint);
 ellipsoid(g,'front-leg-shield',8.3,10.5,0,2.7,6.5,4.8,paint);
 box(g,-2,5.6,0,18,1.2,9,0x697e77).name='step-through-floor';
 ellipsoid(g,'saddle',-6,12,0,7,1.9,3.6,0x273c3b);
 limb(g,'front-fork',[11,4,0],[8,14,0],.9,chrome);
 box(g,9,16,0,4,2.5,12,paint).name='handlebar-cowl';
 limb(g,'handlebar',[9,16,-7],[9,16,7],.65,0x263c3b);
 ellipsoid(g,'headlight',11.3,16,0,.7,1.6,2.5,mat(0xfff0c0,{emissive:0xffde91,emissiveIntensity:.35}));
 for(const z of [-6.6,6.6]){limb(g,'mirror-stem',[9,16,z],[7.5,20,z*1.25],.28,chrome);ellipsoid(g,'mirror',7.4,20.2,z*1.25,1.5,.8,1.1,0xa7c4c5);}
 box(g,-13.5,7,0,1.2,2,5,mat(0xe2745c,{emissive:0xcf3522,emissiveIntensity:.3})).name='tail-light';
 box(g,-14.2,4.4,0,.35,2.3,3.8,0xf2ecdc).name='license-plate';
 limb(g,'exhaust',[-12,4,-4.5],[-5,4,-4.5],.75,chrome);
 const cargo=box(g,-14,12,0,7,7,8,0xd8ae68);cargo.name='delivery-cargo';cargo.visible=false;
 const rider=new THREE.Group();rider.name='mounted-rider';rider.userData.riderPart=true;g.add(rider);
 ellipsoid(rider,'pelvis',-4,14,0,3.2,2.4,3.9,0x314b57);
 ellipsoid(rider,'torso',-2.8,20,0,3.1,5.5,4.1,0xe0a367);
 limb(rider,'neck',[-1.7,24,0],[-1.2,26,0],1.15,0xd8ac84);head(rider,-1.2,28.3);
 for(const z of [-1,1]){
  limb(rider,z<0?'left-upper-arm':'right-upper-arm',[-2.2,23,z*4],[2,19.6,z*5.5],1.25,0xe0a367);
  limb(rider,z<0?'left-forearm':'right-forearm',[2,19.6,z*5.5],[9,16.3,z*6],.95,0xd8ac84);
  ellipsoid(rider,'hand',9,16.3,z*6,1.2,.9,.9,0xd8ac84);
  limb(rider,z<0?'left-thigh':'right-thigh',[-4,14,z*3],[2,11,z*4],1.65,0x314b57);
  limb(rider,z<0?'left-shin':'right-shin',[2,11,z*4],[.2,6.5,z*4.4],1.2,0x314b57);
  box(rider,1,5.8,z*4.4,4.7,1.5,2.6,0x223b3b).name='shoe';
 }
 return g;
}
export function setMountedRiderVisible(scooter,visible){for(const part of scooter.children)if(part.userData.riderPart)part.visible=visible;}
export function createWalker(color=0xe7ad69,helmet=true){
 const g=new THREE.Group();g.name='walking-player';
 const shadow=new THREE.Mesh(new THREE.CircleGeometry(6,16),new THREE.MeshBasicMaterial({color:0x153b32,transparent:true,opacity:.22,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.6;g.add(shadow);
 ellipsoid(g,'pelvis',0,14,0,2.7,2.2,3.6,0x31505a);
 ellipsoid(g,'torso',0,20,0,2.8,5.4,4,color);
 limb(g,'neck',[0,24,0],[0,26,0],1.1,0xd8ac84);head(g,.15,28.7,helmet);
 for(const side of [-1,1]){
  const leg=new THREE.Group();leg.name=side<0?'left-leg':'right-leg';leg.position.set(0,14,side*2.1);g.add(leg);
  limb(leg,'thigh',[0,0,0],[.15,-6.3,0],1.45,0x31505a);limb(leg,'shin',[.15,-6.3,0],[0,-12,0],1.1,0x31505a);
  box(leg,.9,-13.5,0,4.8,1.6,2.7,0x223b3b).name='shoe';
  const arm=new THREE.Group();arm.name=side<0?'left-arm':'right-arm';arm.position.set(0,23,side*4);g.add(arm);
  limb(arm,'upper-arm',[0,0,0],[.2,-4.4,side*.45],1.15,color);limb(arm,'forearm',[.2,-4.4,side*.45],[1,-8.5,side*.3],.85,0xd8ac84);ellipsoid(arm,'hand',1,-9,side*.3,1,1.3,.9,0xd8ac84);
 }
 const cargo=box(g,5.5,13,0,6,6,7,0xd8ae68);cargo.name='delivery-cargo';cargo.visible=false;
 return g;
}
// Non-player people have the same proportions but one opaque draw call each.
// Baking vertex colors avoids multiplying all articulated-part draw calls by 23 NPCs.
const pedestrianGeometry=new Map(),pedestrianMaterial=mat(0xffffff,{vertexColors:true});
export function createPedestrian(color=0xc78062){
 if(!pedestrianGeometry.has(color)){
  const figure=createWalker(color,false),positions=[],normals=[],colors=[];figure.updateMatrixWorld(true);
  figure.traverse(o=>{if(!o.isMesh||o.material.transparent||o.name==='delivery-cargo')return;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);const p=geo.attributes.position.array,n=geo.attributes.normal.array,c=o.material.color;positions.push(...p);normals.push(...n);for(let i=0;i<p.length/3;i++)colors.push(c.r,c.g,c.b);geo.dispose();});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));pedestrianGeometry.set(color,geo);
 }
 const g=new THREE.Mesh(pedestrianGeometry.get(color),pedestrianMaterial);g.name='street-resident';return g;
}
function createCar(car){const g=new THREE.Group();box(g,0,4,0,32,9,15,car.color);box(g,-1,13,0,17,7,13,car.color);box(g,8,14,0,1,5,12,0x395864);box(g,-10,14,0,1,5,12,0x395864);for(const x of [-10,10])for(const z of [-8,8]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(3,3,2,8),material(0x273738));wheel.rotation.x=Math.PI/2;wheel.position.set(x,4,z);g.add(wheel);}box(g,16.5,8,0,1,2,12,mat(0xefefb8,{emissive:0xffd994,emissiveIntensity:.6}));return g;}
function createTree(o){const g=new THREE.Group();g.position.set(o.x,0,o.y);cylinder(g,0,0,0,1.7,o.h*.75,0x887d59);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(o.h*.49,1),material(o.color).clone());crown.name='tree-crown';crown.position.set(0,o.h,0);crown.scale.y=1.15;g.add(crown);return g;}
function roof(group,x,y,z,w,d,color){
  const geo=new THREE.BufferGeometry();const vertices=new Float32Array([-w/2,0,-d/2,w/2,0,-d/2,w/2,18,0,-w/2,18,0,-w/2,0,d/2,w/2,0,d/2]);
  geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));geo.setIndex([0,1,2,0,2,3,4,3,2,4,2,5,0,3,4,1,5,2,0,4,5,0,5,1]);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material(color));mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
export const SHOP_NAMES=['沐光茶行','慢慢早餐','禾日麵舖','小巷書屋','青豆咖啡','雨日修繕','好鄰雜貨','晨光花店','阿福便當','日和洗衣','春雨烘焙','島嶼唱片'];
function createBoxBatch(name,mt=mat(0xffffff)){
 const entries=[],dummy=new THREE.Object3D();
 return {add(x,y,z,w,h,d,color=0xffffff){dummy.position.set(x,y+h/2,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,0,0);dummy.updateMatrix();entries.push({matrix:dummy.matrix.clone(),color:new THREE.Color(color)});},finish(group){const mesh=new THREE.InstancedMesh(unitBox,mt,entries.length);mesh.name=name;entries.forEach((e,i)=>{mesh.setMatrixAt(i,e.matrix);mesh.setColorAt(i,e.color);});mesh.receiveShadow=true;group.add(mesh);return mesh;}};
}
function sidewalkMaterial(){
 // Authored tile grid, no downloaded image and no per-tile geometry.
 const size=64,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,seam=x<2||y<2,k=seam?.73:1+(((x*13+y*7)%11)-5)*.003;data[i]=Math.round(194*k);data[i+1]=Math.round(198*k);data[i+2]=Math.round(180*k);data[i+3]=255;}
 const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(31.25,31.25);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;return mat(0xffffff,{map:texture});
}
function storefrontSigns(){
 const positions=[],uvs=[],normals=[];let texture=null;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=768;const c=canvas.getContext('2d');
  SHOP_NAMES.forEach((name,i)=>{const x=i%2*256,y=Math.floor(i/2)*128;c.fillStyle=['#37685f','#a35843','#4b6177','#756a43'][i%4];c.fillRect(x,y,256,128);c.strokeStyle='#eadfc0';c.lineWidth=3;c.strokeRect(x+7,y+7,242,114);c.fillStyle='#fff1cc';c.textAlign='center';c.textBaseline='middle';c.font='bold 43px "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif';c.fillText(name,x+128,y+56);c.font='12px sans-serif';c.fillText('TAIPEI · LOCAL LIFE',x+128,y+99);});
  texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 }
 return {add(cx,cz,width,face,index){
  const normal=face===0?[0,0,1]:face===1?[1,0,0]:face===2?[0,0,-1]:[-1,0,0],tangent=[normal[2],0,-normal[0]],x=index%2/2,y=Math.floor(index/2)/6;
  const coords=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,-.5],[.5,.5],[-.5,.5]];
  for(const [u,v]of coords){positions.push(cx+tangent[0]*u*width,15.8+v*6.5,cz+tangent[2]*u*width);normals.push(...normal);uvs.push(x+(u+.5)/2,1-y-(.5-v)/6);}
 },finish(group){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:texture,color:texture?0xffffff:0x416d60,side:THREE.DoubleSide}));mesh.name='original-shop-signs';mesh.userData.originalTexts=SHOP_NAMES;group.add(mesh);}};
}
// Repeated static box props share draw calls without changing individual bounds
// or the collision layer. Soft-fading foliage is deliberately excluded.
function batchStaticBoxes(city){
 const groups=new Map();for(const mesh of city.children)if(mesh.isMesh&&!mesh.isInstancedMesh&&mesh.geometry===unitBox&&!mesh.name&&!mesh.material.transparent){const key=mesh.material.uuid;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);}
 for(const meshes of groups.values()){if(meshes.length<2)continue;const batch=new THREE.InstancedMesh(unitBox,meshes[0].material,meshes.length);batch.name='static-city-details';meshes.forEach((m,i)=>{m.updateMatrix();batch.setMatrixAt(i,m.matrix);city.remove(m);});city.add(batch);}
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
  const paving=sidewalkMaterial(),curbs=createBoxBatch('segmented-sidewalk-curbs');
  for(let ix=0;ix<4;ix++)for(let iy=0;iy<4;iy++){const x=ROADS[ix]+35,z=ROADS[iy]+35;box(city,x+125,-.2,z+125,250,1,250,paving).name='tiled-sidewalk';for(let t=0;t<250;t+=20){const length=Math.min(19,250-t);for(const edge of [.8,249.2]){curbs.add(x+t+length/2,.3,z+edge, length,1.05,1.6,t%60===0?0xacae9e:0xe0dfca);curbs.add(x+edge,.3,z+t+length/2,1.6,1.05,length,t%60===0?0xacae9e:0xe0dfca);}}}
  curbs.finish(city);
  box(city,1277,.6,1277,225,.3,225,0x779969);
  for(const road of ROADS){box(city,road,-.6,800,ROAD_WIDTH,1,1440,PALETTE.road).name='road-north-south';box(city,800,-.55,road,1440,1,ROAD_WIDTH,PALETTE.road).name='road-east-west';}
  const paintMatrices=[], temp=new THREE.Object3D();
  function marking(x,z,w,d){temp.position.set(x,.51,z);temp.scale.set(w,.08,d);temp.updateMatrix();paintMatrices.push(temp.matrix.clone());}
  const yellow=createBoxBatch('double-yellow-center-lines');
  for(const road of ROADS)for(let i=0;i<4;i++){const middle=(ROADS[i]+ROADS[i+1])/2,length=320-108;for(const offset of [-1.4,1.4]){yellow.add(road+offset,.51,middle,.65,.08,length,0xe1bf63);yellow.add(middle,.51,road+offset,length,.08,.65,0xe1bf63);}for(const side of [-1,1]){marking(road+side*29,middle,.8,length);marking(middle,road+side*29,length,.8);marking(road+side*16,ROADS[i]+53,23,1.6);marking(ROADS[i]+53,road+side*16,1.6,23);}}yellow.finish(city);
  for(const x of ROADS)for(const z of ROADS)for(let i=0;i<6;i++){marking(x-22+i*8,z-39,4,9);marking(x-22+i*8,z+39,4,9);marking(x-39,z-22+i*8,9,4);marking(x+39,z-22+i*8,9,4);}
  const markings=new THREE.InstancedMesh(unitBox,material(0xd9dec3),paintMatrices.length);paintMatrices.forEach((m,i)=>markings.setMatrixAt(i,m));city.add(markings);
  const windows=[],darkWindows=[];
  const glass=mat(0x84a4a7,{emissive:0xfbd884,emissiveIntensity:0});
  const darkGlass=mat(0x4e727d),facades=createBoxBatch('arcade-columns-shutters-frames'),shopGlass=createBoxBatch('recessed-storefront-glass',glass),shopSigns=storefrontSigns();
  function windowBox(x,y,z,w,h,d,lit){temp.position.set(x,y,z);temp.scale.set(w,h,d);temp.updateMatrix();(lit?windows:darkWindows).push(temp.matrix.clone());}
  for(const o of world.buildings){
    const cx=o.x+o.w/2,cz=o.y+o.d/2;
    if(o.type==='tower'){
      box(city,cx,0,cz,104,23,104,0x80b5a6);
      for(let i=0;i<8;i++){const w=70-i*4.3,y=23+i*23;box(city,cx,y,cz,w,21,w,0x66a99c);box(city,cx,y+20,cz,w+6,3,w+6,0x9cccc0);for(let v=0;v<5;v++){const xx=cx-w/2+8+v*(w-16)/4;windowBox(xx,y+11,cz+w/2+.3,1.3,16,.3,true);windowBox(cx+w/2+.3,y+11,cz-w/2+8+v*(w-16)/4,.3,16,1.3,true);}}
      box(city,cx,207,cz,23,22,23,0x8abfb1);cylinder(city,cx,229,cz,2,47,0xc3dcca,6);sign(city,'101',cx,13,cz+53,30,13,'#5e9e90');continue;
    }
    box(city,cx,o.type==='building'?20:0,cz,o.w,o.type==='building'?o.h-20:o.h,o.d,o.color);
    if(o.type==='building'){
      // Recessed shop fronts and arcade columns stay entirely inside each existing obstacle.
      facades.add(cx,0,cz,o.w-10,20,o.d-10,0x738b84);
      facades.add(cx,18.5,cz,o.w,1.5,o.d,0xdad7bf);
      for(let face=0;face<4;face++){
       const alongX=face%2===0,width=alongX?o.w:o.d,depth=alongX?o.d:o.w,normal=face<2?1:-1;
       const local=(u,v)=>alongX?[cx+u,cz+normal*(depth/2-v)]:[cx+normal*(depth/2-v),cz+u];
       const part=(u,v,y,w,h,d,color,glassPart=false)=>{const [x,z]=local(u,v);(glassPart?shopGlass:facades).add(x,y,z,alongX?w:d,h,alongX?d:w,color);};
       for(const u of [-width/2+1.4,0,width/2-1.4])part(u,1.5,0,2.8,18.5,2.8,0xd7d2b9);
       part(0,4.8,1,width-6,11,.6,0x789994,true);
       for(const u of [-width*.33,-width*.16,0,width*.16,width*.33])part(u,4.25,1,.6,11,.65,0x344f4c);
       part(0,4.15,6,width-6,.55,.7,0x344f4c);part(width*.13,3.8,5,.5,2,.6,0xd7c9a3);
       if(o.seed>.52){part(-width*.25,4.1,1,width*.32,10,.7,0x89918a);for(let y=2;y<11;y+=1.5)part(-width*.25,3.7,y,width*.32,.24,.35,0x626f6a);}
       part(0,2,12,width-5,1.1,4,0x586f60);
       const [sx,sz]=local(0,.45);shopSigns.add(sx,sz,width-5,face,(Math.floor(o.seed*12)+face)%SHOP_NAMES.length);
      }
      const floors=Math.max(2,Math.floor(o.h/13));
      for(let f=0;f<floors;f++)for(let a=0;a<4;a++){
        const y=27+f*12;if(y+4>o.h)continue;const xx=o.x+8+a*(o.w-12)/4,zz=o.y+8+a*(o.d-12)/4,lit=(a+f+Math.round(o.seed*5))%3!==0;
        windowBox(xx,y,o.y+o.d+.3,6,7,.5,lit);windowBox(o.x+o.w+.3,y,zz,.5,7,6,lit);windowBox(xx,y,o.y-.3,6,7,.5,lit);windowBox(o.x-.3,y,zz,.5,7,6,lit);
      }
      box(city,o.x+14,o.h, o.y+14,13,9,12,0x99ada9);if(o.seed>.65)cylinder(city,o.x+o.w-15,o.h,o.y+15,5,10,0xaab9b1);
      
    }else{
      const temple=o.type==='temple';for(let i=0;i<4;i++)box(city,cx,i*3,cz,o.w+34-i*7,3,o.d+34-i*7,temple?0xbaa88d:0xe2e4d5);
      for(let i=0;i<6;i++)box(city,o.x+9+i*(o.w-18)/5,9,o.y+o.d+2,5,o.h-8,5,temple?0x9f372c:0xf2eedb);
      roof(city,cx,o.h,cz,o.w+24,o.d+24,temple?0xba4d36:0x416c9b);sign(city,temple?'龍山寺':'自由',cx,o.h-9,o.y+o.d+5,temple?52:45,15,temple?'#882f29':'#e4e4d6');
      if(temple)for(const x of [o.x+5,o.x+o.w-5]){const lantern=new THREE.Mesh(new THREE.SphereGeometry(4,8,6),mat(0xf9a36c,{emissive:0xf38c41,emissiveIntensity:.6}));lantern.position.set(x,o.h-12,o.y+o.d+14);city.add(lantern);}
    }
  }
  facades.finish(city);shopGlass.finish(city);shopSigns.finish(city);
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
  batchStaticBoxes(city);
  return {city,glass,lampMaterial,foliage,softOccluders};
}
// Render-only quality control. Timestamps are real wall-clock milliseconds, not
// the capped simulation dt: neither movement nor quest time is accelerated.
export class AdaptiveRenderScale{
 constructor(pixelRatio=1){this.minScale=.55;this.ceiling=this.pixelRatioCeiling(pixelRatio);this.scale=this.ceiling;this.resetTiming();}
 pixelRatioCeiling(value){return Math.max(this.minScale,Math.min(1.6,Number.isFinite(value)&&value>0?value:1));}
 resetTiming(){this.lastTimestamp=null;this.windowMs=0;this.frames=0;this.slowFrames=0;this.fastMs=0;}
 setCeiling(pixelRatio){this.ceiling=this.pixelRatioCeiling(pixelRatio);this.scale=Math.min(this.scale,this.ceiling);this.resetTiming();return this.scale;}
 sample(timestamp,visible=true){
  if(!visible||!Number.isFinite(timestamp)){this.resetTiming();return false;}
  if(this.lastTimestamp===null){this.lastTimestamp=timestamp;return false;}
  const elapsed=timestamp-this.lastTimestamp;this.lastTimestamp=timestamp;
  // Invalid/repeated timestamps cannot contribute to quality decisions.
  if(elapsed<=0){this.resetTiming();this.lastTimestamp=timestamp;return false;}
  this.windowMs+=elapsed;this.frames++;if(elapsed>45)this.slowFrames++;
  if(this.windowMs<3000||this.frames<6)return false;
  const meanMs=this.windowMs/this.frames,duration=this.windowMs,slowFraction=this.slowFrames/this.frames;this.windowMs=0;this.frames=0;this.slowFrames=0;
  let next=this.scale;
  // At least 70% slow frames prevents one OS/debugger hitch from forcing a drop.
  if(meanMs>45&&slowFraction>=.7){this.fastMs=0;next=Math.max(this.minScale,this.scale*.8);}
  else if(meanMs<22){this.fastMs+=duration;if(this.fastMs>=12000){next=Math.min(this.ceiling,this.scale+.1);this.fastMs=0;}}
  else this.fastMs=0;
  next=Math.min(this.ceiling,Math.max(this.minScale,Math.round(next*10000)/10000));
  if(Math.abs(next-this.scale)<.00001)return false;
  this.scale=next;return true;
 }
}
export class Renderer3D{
  constructor(canvas,world){
    this.canvas=canvas;
    // Context creation is the only capability check. If it fails, main.js uses Canvas 2D.
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderScale=new AdaptiveRenderScale(globalThis.devicePixelRatio||1);this.renderer.setPixelRatio(this.renderScale.scale);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(PALETTE.sky);this.scene.fog=new THREE.Fog(PALETTE.sky,350,1150);
    this.camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,1,1800);this.camera.position.set(800,85,660);
    this.cameraBlockers=createCameraBlockers(world);
    this.light=new THREE.HemisphereLight(0xd9efe7,0x5e7154,2.4);this.scene.add(this.light);
    this.sun=new THREE.DirectionalLight(0xffefcb,2.3);this.sun.position.set(-200,500,-150);this.scene.add(this.sun);
    const created=createCity(world);this.scene.add(created.city);this.glass=created.glass;this.lampMaterial=created.lampMaterial;this.foliage=created.foliage;this.softOccluders=created.softOccluders;
    this.scooter=createScooter();this.scene.add(this.scooter);this.carMeshes=[];
    this.markers=[...LANDMARKS,...Object.values(QUEST_STATIONS)].map(l=>{const g=new THREE.Group();g.position.set(l.x,1,l.y);const ring=new THREE.Mesh(new THREE.TorusGeometry(27,1.25,8,48),new THREE.MeshBasicMaterial({color:l.color}));ring.rotation.x=Math.PI/2;g.add(ring);const pin=new THREE.Mesh(new THREE.OctahedronGeometry(5,0),new THREE.MeshBasicMaterial({color:l.color}));pin.position.y=32;g.add(pin);this.scene.add(g);return {l,g,ring,pin};});
    this.questResidents=Object.values(QUEST_STATIONS).map((station,i)=>{const npc=createPedestrian([0xc78062,0x719baa,0xa29968][i]);npc.name=station.id;applyVehiclePose(npc,{x:station.x+29,y:station.y,angle:Math.PI});this.scene.add(npc);return npc;});
    this.pedestrians=Array.from({length:20},(_,i)=>{const g=createPedestrian([0xc9815e,0x799aab,0xcdbd78][i%3]);this.scene.add(g);return g;});
    this.time=0;this.lastNight=null;this.look=new THREE.Vector3(800,16,515);this.heading=-Math.PI/2;this.resize();
  }
  resize(width=innerWidth,height=innerHeight,pixelRatio=globalThis.devicePixelRatio||1){
    this.cssWidth=Math.max(1,Math.round(width));this.cssHeight=Math.max(1,Math.round(height));
    if(this.renderScale)this.renderer.setPixelRatio(this.renderScale.setCeiling(pixelRatio));
    this.renderer.setSize(this.cssWidth,this.cssHeight);this.camera.aspect=this.cssWidth/this.cssHeight;this.camera.fov=this.cssWidth<650?66:58;this.camera.updateProjectionMatrix();
  }
  updateRenderScale(timestamp=performance.now(),visible=typeof document==='undefined'||!document.hidden){
    if(this.renderScale?.sample(timestamp,visible)){this.renderer.setPixelRatio(this.renderScale.scale);return true;}return false;
  }
  getRenderMetrics(){
    const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return {effectiveRenderScale:this.renderer.getPixelRatio(),drawingBufferWidth:size.x,drawingBufferHeight:size.y,renderCssWidth:this.cssWidth,renderCssHeight:this.cssHeight};
  }
  render(state,dt){
    this.updateRenderScale();
    const {player,traffic,night,stamps,target}=state;this.time+=dt;
    if(this.lastNight!==night){this.lastNight=night;const bg=night?0x112835:PALETTE.sky;this.scene.background.set(bg);this.scene.fog.color.set(bg);this.light.intensity=night?.95:2.4;this.sun.intensity=night?.5:2.3;this.sun.color.set(night?0xb9cddc:0xffefcb);this.glass.emissiveIntensity=night?1.15:0;this.lampMaterial.emissiveIntensity=night?2:.1;for(const entry of this.softOccluders)if(entry.mesh.userData.lampLight)entry.mesh.material.emissiveIntensity=night?2:.1;this.renderer.toneMappingExposure=night?1.05:1.1;}
    const walking=state.mode==='walking',carrying=state.quest?.stage==='carrying'||state.quest?.stage==='deliver';this.scooter.getObjectByName('delivery-cargo').visible=carrying&&!walking;applyVehiclePose(this.scooter,walking?state.vehicle:player);setMountedRiderVisible(this.scooter,!walking);
    if(walking){if(!this.walker){this.walker=createWalker();this.scene.add(this.walker);}this.walker.visible=true;this.walker.getObjectByName('delivery-cargo').visible=carrying;applyVehiclePose(this.walker,player);for(const leg of this.walker.children)if(leg.name.endsWith('-leg')||leg.name.endsWith('-arm'))leg.rotation.z=Math.sin(this.time*9+(leg.name.startsWith('left')?0:Math.PI)+(leg.name.endsWith('-arm')?Math.PI:0))*Math.min(.35,Math.abs(player.speed)*.018);}
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
    this.pedestrians.forEach((p,i)=>{p.position.set(ROADS[i%5]+45,0,180+(i*91+this.time*(i%2?5:-5)+1300)%1220);p.rotation.y=i%2?-Math.PI/2:Math.PI/2;});
    this.renderer.render(this.scene,this.camera);
  }
  resetCamera(player){this.heading=player.angle;const pose=chaseCameraPose(player,player.angle,innerWidth<650);this.camera.position.copy(constrainCameraPosition(player,pose.position,this.cameraBlockers));this.look.copy(cameraAimTarget(player,player.angle,this.camera.position));}
}
