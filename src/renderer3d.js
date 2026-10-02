import {sampleEnabled,installArtSample,isSampleStreetBuilding} from './art-sample.js';
import * as THREE from '../vendor/three.module.js';
import { ROADS, ROAD_WIDTH, LANDMARKS } from './world.js';
import { QUEST_STATIONS } from './session.js';
import { PERSON, BUILDING } from './scale.js';
import { createLookController } from './camera-controls.js';
import { createScooter, createWalker, createPedestrian, createCar, setMountedRiderVisible, bakeColorMeshes, applyCharacterPalette, APPEARANCES } from './models.js';
export { createScooter, createWalker, createPedestrian, createCar, setMountedRiderVisible, RIDER_CONTACTS } from './models.js';
// The 2D simulation's (x, y) ground coordinates map to Three.js (x, z).
// Elevation is exclusively the Three.js y axis; +simulation-y is south/+z.
export function worldToScene(x,y,height=0){return new THREE.Vector3(x,height,y);}
export function applyVehiclePose(mesh,entity){mesh.position.copy(worldToScene(entity.x,entity.y));mesh.rotation.y=-entity.angle;}
export function chaseCameraPose(player,heading=player.angle,mobile=false){
  const follow=mobile?59:66;
  return {position:worldToScene(player.x-Math.cos(heading)*follow,player.y-Math.sin(heading)*follow,29),target:worldToScene(player.x+Math.cos(heading)*15,player.y+Math.sin(heading)*15,10)};
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
 const focus=worldToScene(player.x,player.y,11),delta=desired.clone().sub(focus),length=delta.length();
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
 const focus=worldToScene(player.x,player.y,11),clipped=clipCameraSegment(player,desired,blockers,clearance);
 if(clipped.distanceTo(focus)>=28)return clipped;
 // A narrow alley calls for a lateral/closer shoulder view, not an abrupt
 // overhead jump. Search low alternatives in order of angular departure.
 const base=Math.atan2(desired.z-player.y,desired.x-player.x),turns=[Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,3*Math.PI/4,-3*Math.PI/4,Math.PI];let best=clipped;
 for(const height of [20,28])for(const turn of turns){const angle=base+turn,candidate=worldToScene(player.x+Math.cos(angle)*60,player.y+Math.sin(angle)*60,height),safe=clipCameraSegment(player,candidate,blockers,clearance);if(safe.distanceTo(focus)>=28)return safe;if(safe.distanceTo(focus)>best.distanceTo(focus))best=safe;}
 // Keep the least-obstructed horizontal view even in a tight corner. The
 // shorter look target below centers the full person instead of looking at a roof.
 return best;
}
export function cameraAimTarget(player,heading,position){
 const fraction=THREE.MathUtils.clamp(Math.hypot(position.x-player.x,position.z-player.y)/66,.1,1);
 return worldToScene(player.x+Math.cos(heading)*12*fraction,player.y+Math.sin(heading)*12*fraction,8.5+1.5*fraction);
}
export function updateFoliageVisibility(foliage,player,cameraPosition=null){
 const focus=worldToScene(player.x,player.y,11),hit=new THREE.Vector3();
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
export function createTree(o){
 const g=new THREE.Group();g.name='street-tree';g.position.set(o.x,0,o.y);const height=o.height||o.h,radius=o.trunkRadius||1.5;
 const trunk=new THREE.Mesh(new THREE.CylinderGeometry(radius*.42,radius,height*.72,10,4),material(0x6b6950));trunk.name='tree-trunk';trunk.position.y=height*.36;g.add(trunk);
 for(let i=0;i<4;i++){const angle=i*Math.PI/2+o.x*.013,start=new THREE.Vector3(0,height*.54,0),end=new THREE.Vector3(Math.cos(angle)*height*.13,height*(.72+i*.023),Math.sin(angle)*height*.13),delta=end.clone().sub(start);const branch=new THREE.Mesh(new THREE.CylinderGeometry(.2,radius*.47,delta.length(),7),material(0x6b6950));branch.position.copy(start).add(end).multiplyScalar(.5);branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());branch.name='tree-branch';g.add(branch);}
 const geo=new THREE.SphereGeometry(1,16,12),pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),phi=Math.atan2(z,x),theta=Math.acos(THREE.MathUtils.clamp(y,-1,1)),r=1+.09*Math.sin(phi*5+o.x)+.07*Math.sin(theta*6+phi*3);pos.setXYZ(i,x*r,y*(.93+.05*Math.sin(phi*4)),z*r);}
 geo.computeVertexNormals();const crown=new THREE.Mesh(geo,material(o.color).clone());crown.name='tree-crown';crown.position.set(0,height*.78,0);crown.scale.set(height*.26,height*.235,height*.25);g.add(crown);const wood=bakeColorMeshes(g,'tree-trunk','cloth',true,[crown]);for(const child of [...g.children])if(child!==crown)g.remove(child);g.add(wood);g.userData.trunkRadius=radius;g.userData.height=height;return g;
}
export function createLamp(o){
 const g=new THREE.Group();g.name='street-lamp';g.position.set(o.x,0,o.y);const height=o.height||48,radius=o.radius||1.3;
 const base=cylinder(g,0,0,0,radius,1.7,0x687b72,12);base.name='lamp-base';const pole=new THREE.Mesh(new THREE.CylinderGeometry((o.poleRadius||.45)*.62,o.poleRadius||.45,height-2.4,10),material(0x71877d));pole.position.y=(height-2.4)/2+1.7;pole.name='lamp-pole';g.add(pole);
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,height-5,0),new THREE.Vector3(-.5,height-1,0),new THREE.Vector3(-4,height,0),new THREE.Vector3(-7,height-1.5,0)]);const arm=new THREE.Mesh(new THREE.TubeGeometry(curve,12,.28,8,false),material(0x71877d));arm.name='lamp-arm';g.add(arm);
 const hood=box(g,-7,height-2.3,0,4.3,1.3,2,0x405b52);hood.name='lamp-hood';const light=box(g,-7,height-2.44,0,3.6,.18,1.4,mat(0xf5edc7,{emissive:0xffd98e,emissiveIntensity:.1}));light.name='lamp-light';light.userData.lampLight=true;const frame=bakeColorMeshes(g,'lamp-frame','metal',true,[light]);for(const child of [...g.children])if(child!==light)g.remove(child);g.add(frame);g.userData.radius=radius;return g;
}
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
  for(const [u,v]of coords){positions.push(cx+tangent[0]*u*width,27+v*6.5,cz+tangent[2]*u*width);normals.push(...normal);uvs.push(x+(u+.5)/2,1-y-(.5-v)/6);}
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
      box(city,cx,0,cz,o.w,28,o.d,0x80b5a6);
      for(let i=0;i<8;i++){const w=70-i*4.3,y=23+i*23;box(city,cx,y,cz,w,21,w,0x66a99c);box(city,cx,y+20,cz,w+6,3,w+6,0x9cccc0);for(let v=0;v<5;v++){const xx=cx-w/2+8+v*(w-16)/4;windowBox(xx,y+11,cz+w/2+.3,1.3,16,.3,true);windowBox(cx+w/2+.3,y+11,cz-w/2+8+v*(w-16)/4,.3,16,1.3,true);}}
      box(city,cx,207,cz,23,22,23,0x8abfb1);cylinder(city,cx,229,cz,2,47,0xc3dcca,6);sign(city,'101',cx,13,cz+53,30,13,'#5e9e90');continue;
    }
    box(city,cx,o.type==='building'?BUILDING.groundFloorHeight:0,cz,o.w,o.type==='building'?o.h-BUILDING.groundFloorHeight:o.h,o.d,o.color);
    if(o.type==='building'){
      // Recessed shop fronts and arcade columns stay entirely inside each existing obstacle.
      facades.add(cx,0,cz,o.w-10,BUILDING.groundFloorHeight,o.d-10,0x738b84);
      facades.add(cx,30.5,cz,o.w,1.5,o.d,0xdad7bf);
      for(let face=0;face<4;face++){
       const alongX=face%2===0,width=alongX?o.w:o.d,depth=alongX?o.d:o.w,normal=face<2?1:-1;
       const local=(u,v)=>alongX?[cx+u,cz+normal*(depth/2-v)]:[cx+normal*(depth/2-v),cz+u];
       const part=(u,v,y,w,h,d,color,glassPart=false)=>{const [x,z]=local(u,v);(glassPart?shopGlass:facades).add(x,y,z,alongX?w:d,h,alongX?d:w,color);};
       for(const u of [-width/2+1.4,0,width/2-1.4])part(u,1.5,0,2.8,30.5,2.8,0xd7d2b9);
       part(0,4.8,1,width-6,BUILDING.doorHeight,.6,0x789994,true);
       for(const u of [-width*.33,-width*.16,0,width*.16,width*.33])part(u,4.25,1,.6,BUILDING.doorHeight,.65,0x344f4c);
       part(0,4.15,14,width-6,.55,.7,0x344f4c);part(width*.13,3.8,10,.5,2,.6,0xd7c9a3);
       if(o.seed>.52){part(-width*.25,4.1,1,width*.32,21,.7,0x89918a);for(let y=2;y<22;y+=1.5)part(-width*.25,3.7,y,width*.32,.24,.35,0x626f6a);}
       part(0,2,23,width-5,1.1,4,0x586f60);
       const [sx,sz]=local(0,.45);shopSigns.add(sx,sz,width-5,face,(Math.floor(o.seed*12)+face)%SHOP_NAMES.length);
      }
      const floors=o.floorCount||Math.max(2,Math.round((o.h-BUILDING.groundFloorHeight)/BUILDING.upperFloorHeight)+1);
      for(let f=0;f<floors;f++)for(let a=0;a<4;a++){
        const y=BUILDING.groundFloorHeight+15+f*BUILDING.upperFloorHeight;if(y+9>o.h)continue;const xx=o.x+8+a*(o.w-12)/4,zz=o.y+8+a*(o.d-12)/4,lit=(a+f+Math.round(o.seed*5))%3!==0;
        windowBox(xx,y,o.y+o.d+.3,7,14,.5,lit);windowBox(o.x+o.w+.3,y,zz,.5,14,7,lit);windowBox(xx,y,o.y-.3,7,14,.5,lit);windowBox(o.x-.3,y,zz,.5,14,7,lit);
      }
      box(city,o.x+14,o.h, o.y+14,13,9,12,0x99ada9);if(o.seed>.65)cylinder(city,o.x+o.w-15,o.h,o.y+15,5,10,0xaab9b1);
      
    }else{
      const temple=o.type==='temple';for(let i=0;i<4;i++)box(city,cx,i*3,cz,o.w-i*7,3,o.d-i*7,temple?0xbaa88d:0xe2e4d5);
      for(let i=0;i<6;i++)box(city,o.x+9+i*(o.w-18)/5,9,o.y+o.d-3,5,o.h-8,5,temple?0x9f372c:0xf2eedb);
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
  for(const lamp of world.lamps||[]){const g=createLamp(lamp);city.add(g);g.updateMatrixWorld(true);for(const mesh of g.children){mesh.material=mesh.material.clone();softOccluders.push({mesh,bounds:new THREE.Box3().setFromObject(mesh)});}}
  for(let i=0;i<8;i++)box(city,110,4,220+i*151,8,3,22,0xb99168);
  batchStaticBoxes(city);
  return {city,glass,lampMaterial,foliage,softOccluders};
}
// Render-only quality control. Timestamps are real wall-clock milliseconds, not
// the capped simulation dt: neither movement nor quest time is accelerated.
export class AdaptiveRenderScale{
 constructor(pixelRatio=1){this.minScale=.55;this.maximum=1.6;this.ceiling=this.pixelRatioCeiling(pixelRatio);this.scale=this.ceiling;this.resetTiming();}
 pixelRatioCeiling(value){return Math.max(this.minScale,Math.min(this.maximum,Number.isFinite(value)&&value>0?value:1));}
 resetTiming(){this.lastTimestamp=null;this.windowMs=0;this.frames=0;this.slowFrames=0;this.fastMs=0;}
 setCeiling(pixelRatio,maximum=this.maximum){this.maximum=Math.max(.55,Math.min(2,maximum));this.ceiling=this.pixelRatioCeiling(pixelRatio);this.scale=Math.min(this.scale,this.ceiling);this.resetTiming();return this.scale;}
 sample(timestamp,visible=true){
  if(!visible||!Number.isFinite(timestamp)){this.resetTiming();return false;}
  if(this.lastTimestamp===null){this.lastTimestamp=timestamp;return false;}
  const elapsed=timestamp-this.lastTimestamp;this.lastTimestamp=timestamp;
  // Invalid/repeated timestamps cannot contribute to quality decisions.
  if(elapsed<=0){this.resetTiming();this.lastTimestamp=timestamp;return false;}
  this.windowMs+=elapsed;this.frames++;if(elapsed>45)this.slowFrames++;
  if(this.windowMs<3000||this.frames<6)return false;
  const meanMs=this.windowMs/this.frames,duration=this.windowMs,slowFraction=this.slowFrames/this.frames;this.observedFps=1000/meanMs;this.windowMs=0;this.frames=0;this.slowFrames=0;
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
    this.canvas=canvas;this.lookController=createLookController();
    // Context creation is the only capability check. If it fails, main.js uses Canvas 2D.
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderScale=new AdaptiveRenderScale(globalThis.devicePixelRatio||1);this.renderer.setPixelRatio(this.renderScale.scale);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(PALETTE.sky);this.scene.fog=new THREE.Fog(PALETTE.sky,350,1150);
    this.skyDome=new THREE.Mesh(new THREE.SphereGeometry(1500,24,12),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x655f86)},bottom:{value:new THREE.Color(0xe4af8d)}},vertexShader:'varying float elevation; void main(){ elevation=normalize(position).y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',fragmentShader:'uniform vec3 top; uniform vec3 bottom; varying float elevation; void main(){ gl_FragColor=vec4(mix(bottom,top,smoothstep(-0.12,0.68,elevation)),1.0); }'}));this.skyDome.visible=false;this.scene.add(this.skyDome);
    this.camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,1,1800);this.camera.position.set(800,85,660);
    this.cameraBlockers=createCameraBlockers(world);
    this.light=new THREE.HemisphereLight(0xd9efe7,0x5e7154,2.4);this.scene.add(this.light);
    this.sun=new THREE.DirectionalLight(0xffefcb,2.3);this.sun.position.set(-200,500,-150);this.scene.add(this.sun);
    this.sample={enabled:sampleEnabled(),ready:false,error:null};const created=createCity(this.sample.enabled?{...world,buildings:world.buildings.filter(b=>!isSampleStreetBuilding(b))}:world);this.scene.add(created.city);this.glass=created.glass;this.lampMaterial=created.lampMaterial;this.foliage=created.foliage;this.softOccluders=created.softOccluders;
    this.scooter=createScooter();this.scene.add(this.scooter);this.carMeshes=[];
    this.markers=[...LANDMARKS,...Object.values(QUEST_STATIONS)].map(l=>{const g=new THREE.Group();g.position.set(l.x,1,l.y);const ring=new THREE.Mesh(new THREE.TorusGeometry(12,.45,8,40),new THREE.MeshBasicMaterial({color:l.color}));ring.rotation.x=Math.PI/2;g.add(ring);const pin=new THREE.Mesh(new THREE.OctahedronGeometry(2.5,0),new THREE.MeshBasicMaterial({color:l.color}));pin.position.y=23;g.add(pin);this.scene.add(g);return {l,g,ring,pin};});
    this.questResidents=Object.values(QUEST_STATIONS).map((station,i)=>{const npc=createWalker([0xc78062,0x719baa,0xa29968][i],true,i===1?'female':'male');npc.name=station.id;applyVehiclePose(npc,{x:station.x+29,y:station.y,angle:Math.PI});this.scene.add(npc);return npc;});
    this.pedestrians=Array.from({length:20},(_,i)=>{const g=createPedestrian([0xc9815e,0x799aab,0xcdbd78][i%3]);this.scene.add(g);return g;});
    this.time=0;this.lastNight=null;this.look=new THREE.Vector3(800,10,515);this.heading=-Math.PI/2;this.resize();if(this.sample.enabled)this.artSample=installArtSample(this,world);
  }
  resize(width=innerWidth,height=innerHeight,pixelRatio=globalThis.devicePixelRatio||1){
    this.cssWidth=Math.max(1,Math.round(width));this.cssHeight=Math.max(1,Math.round(height));
    if(this.renderScale)this.renderer.setPixelRatio(this.renderScale.setCeiling(Math.min(pixelRatio,{low:.75,medium:1.2,high:1.6,ultra:2,auto:1.6}[this.quality||'auto']),{low:.75,medium:1.2,high:1.6,ultra:2,auto:1.6}[this.quality||'auto']));
    this.renderer.setSize(this.cssWidth,this.cssHeight);this.camera.aspect=this.cssWidth/this.cssHeight;this.camera.fov=this.cssWidth<650?66:58;this.camera.updateProjectionMatrix();
  }
  updateRenderScale(timestamp=performance.now(),visible=typeof document==='undefined'||!document.hidden){
    if(this.renderScale?.sample(timestamp,visible)){this.renderer.setPixelRatio(this.renderScale.scale);return true;}return false;
  }
  getRenderMetrics(){
    const size=this.renderer.getDrawingBufferSize(new THREE.Vector2());
    return {effectiveRenderScale:this.renderer.getPixelRatio(),drawingBufferWidth:size.x,drawingBufferHeight:size.y,renderCssWidth:this.cssWidth,renderCssHeight:this.cssHeight};
  }
  setQuality(preset){this.quality=['auto','low','medium','high','ultra'].includes(preset)?preset:'auto';const ceiling={low:.75,medium:1.2,high:1.6,ultra:2,auto:1.6}[this.quality];if(this.renderScale){this.renderScale.maximum=ceiling;this.renderScale.scale=this.renderScale.pixelRatioCeiling(Math.min(globalThis.devicePixelRatio||1,ceiling));}this.resize();}
  setLookSettings(settings){this.lookController??=createLookController();this.lookController.configure(settings);}
  adjustLook(dx,dy){this.lookController??=createLookController();this.lookController.adjust(dx,dy);}
  getViewMetrics(){return {...(this.lookController?.snapshot()||{yaw:0,pitch:0,sensitivity:1,invertY:false}),quality:this.quality||'auto',menuView:this.menuView||'city',arrivalProgress:typeof this.arrivalProgress==='number'?this.arrivalProgress:null,position:this.camera.position.toArray(),sample:this.artSample?.metrics()||this.sample||{enabled:false,ready:false,error:null}};}
  getPerformanceMetrics(){return {fps:this.renderScale?.observedFps??null,drawCalls:this.renderer.info?.render?.calls??null,triangles:this.renderer.info?.render?.triangles??null};}
  setArrivalProgress(progress){this.arrivalProgress=typeof progress==='number'?THREE.MathUtils.clamp(progress,0,1):null;}
  setAppearance(id){
    this.appearance=Object.hasOwn(APPEARANCES,id)?id:'forest';const character=this.appearance==='river'?'female':'male';
    this.characterModels??={};const previous=this.character||'male';this.characterModels[previous]={scooter:this.scooter,walker:this.walker};
    if(character!==previous){this.scene.remove(this.scooter);if(this.walker)this.scene.remove(this.walker);const cached=this.characterModels[character]||{scooter:createScooter(character),walker:null};this.scooter=cached.scooter;this.walker=cached.walker;this.scene.add(this.scooter);if(this.walker)this.scene.add(this.walker);}
    this.character=character;applyCharacterPalette(this.scooter,this.appearance);if(this.walker)applyCharacterPalette(this.walker,this.appearance);this.previewCharacters??={};
    if(!this.previewCharacters[character]){const preview=createWalker(undefined,true,character);preview.position.set(815,0,515);preview.visible=false;this.previewCharacters[character]=preview;this.scene.add(preview);}this.previewCharacter=this.previewCharacters[character];applyCharacterPalette(this.previewCharacter,this.appearance);if(this.artSample)this.sampleReady=this.artSample.appearance(this.appearance).catch(error=>{this.sample.error=error.message;});
  }
  setMenuView(view){this.menuView=view==='character'?'character':'city';}

  setIntroProgress(progress){this.introProgress=typeof progress==='number'?THREE.MathUtils.clamp(progress,0,1):null;}
  render(state,dt){
    this.updateRenderScale();
    const {player,traffic,stamps,target}=state;const intro=typeof this.introProgress==='number',night=intro&&this.menuView!=='character'?true:state.night;this.time+=dt;
    const atmosphere=intro&&this.menuView!=='character'?'dusk':night?'night':'day';
    if(this.lastAtmosphere!==atmosphere){this.lastAtmosphere=atmosphere;this.lastNight=night;const dusk=atmosphere==='dusk',bg=dusk?0xc19b9e:night?0x112835:PALETTE.sky;this.scene.background.set(bg);this.scene.fog.color.set(bg);this.light.intensity=dusk?1.65:night?.95:2.4;this.sun.intensity=dusk?1.5:night?.5:2.3;this.sun.color.set(dusk?0xffc18a:night?0xb9cddc:0xffefcb);this.glass.emissiveIntensity=dusk?.65:night?1.15:0;this.lampMaterial.emissiveIntensity=dusk?1:night?2:.1;for(const entry of this.softOccluders)if(entry.mesh.userData.lampLight)entry.mesh.material.emissiveIntensity=dusk?1:night?2:.1;this.renderer.toneMappingExposure=dusk?1.05:night?1.05:1.1;if(this.skyDome)this.skyDome.visible=dusk;}

    const walking=state.mode==='walking',carrying=state.quest?.stage==='carrying'||state.quest?.stage==='deliver';this.scooter.getObjectByName('delivery-cargo').visible=carrying&&!walking;applyVehiclePose(this.scooter,walking?state.vehicle:player);setMountedRiderVisible(this.scooter,!walking);
    if(walking){if(!this.walker){this.walker=createWalker(undefined,true,this.character||'male');applyCharacterPalette(this.walker,this.appearance||'forest');this.scene.add(this.walker);}this.walker.visible=true;this.walker.getObjectByName('delivery-cargo').visible=carrying;applyVehiclePose(this.walker,player);for(const leg of this.walker.children)if(leg.name.endsWith('-leg')||leg.name.endsWith('-arm'))leg.rotation.z=Math.sin(this.time*9+(leg.name.startsWith('left')?0:Math.PI)+(leg.name.endsWith('-arm')?Math.PI:0))*Math.min(.35,Math.abs(player.speed)*.018);}
    else if(this.walker)this.walker.visible=false;
    let delta=player.angle-this.heading;delta=Math.atan2(Math.sin(delta),Math.cos(delta));this.heading+=delta*Math.min(1,dt*3.5);
    const view=this.lookController?.snapshot()||{yaw:0,pitch:0},viewHeading=this.heading+view.yaw,pose=chaseCameraPose(player,viewHeading,innerWidth<650);if(view.pitch){const focus=worldToScene(player.x,player.y,11),offset=pose.position.clone().sub(focus),length=offset.length(),pitch=Math.atan2(offset.y,Math.hypot(offset.x,offset.z))+view.pitch;pose.position.set(player.x-Math.cos(viewHeading)*Math.cos(pitch)*length,11+Math.sin(pitch)*length,player.y-Math.sin(viewHeading)*Math.cos(pitch)*length);}const want=constrainCameraPosition(player,pose.position,this.cameraBlockers);
    if(Math.hypot(this.camera.position.x-want.x,this.camera.position.z-want.z)>380)this.camera.position.copy(want);
    else this.camera.position.lerp(want,Math.min(1,dt*4.5));
    // The interpolated segment can cut through a corner even when its endpoints
    // are safe, so visibility is constrained again after smoothing.
    this.camera.position.copy(constrainCameraPosition(player,this.camera.position,this.cameraBlockers));
    const aim=cameraAimTarget(player,viewHeading,this.camera.position);
    if(this.camera.position.distanceTo(worldToScene(player.x,player.y,11))<40||Math.hypot(this.camera.position.x-player.x,this.camera.position.z-player.y)<24)this.look.copy(aim);
    else this.look.lerp(aim,Math.min(1,dt*6));
    if(intro){const phase=this.introProgress*Math.PI*2,angle=.6+Math.sin(phase)*.1;this.camera.position.set(1241+Math.cos(angle)*330,190+Math.cos(phase)*8,631+Math.sin(angle)*330);this.look.set(1210,140,677);}
    const previewActive=intro&&this.menuView==='character';this.scooter.visible=!previewActive;if(this.walker)this.walker.visible=walking&&!previewActive;for(const preview of Object.values(this.previewCharacters||{}))preview.visible=previewActive&&preview===this.previewCharacter;if(previewActive){this.camera.position.set(848,18,534);this.look.set(815,9.5,515);}
    const arrival=typeof this.arrivalProgress==='number',resident=this.questResidents?.[0];
    if(arrival&&resident){const p=this.arrivalProgress,ease=x=>x*x*(3-2*x),blend=p<.22?ease(p/.22):p>.8?1-ease((p-.8)/.2):1,base=chaseCameraPose(player,player.angle,innerWidth<650),npc=resident.position,visit=new THREE.Vector3(npc.x-24,17,npc.z+18),greeting=new THREE.Vector3(npc.x,12.2,npc.z);this.camera.position.copy(base.position).lerp(visit,blend);this.look.copy(base.target).lerp(greeting,blend);}
    if(resident){const arm=resident.getObjectByName('right-arm');if(arm)arm.rotation.z=arrival?Math.max(0,Math.min(1,(this.arrivalProgress-.1)/.1,(.9-this.arrivalProgress)/.1))*(2.15+Math.sin(this.arrivalProgress*48)*.1):0;}
    if(this.skyDome)this.skyDome.position.copy(this.camera.position);this.camera.lookAt(this.look);updateFoliageVisibility(this.softOccluders,player,this.camera.position);
    traffic.forEach((car,i)=>{if(!this.carMeshes[i]){this.carMeshes[i]=createCar(car);this.scene.add(this.carMeshes[i]);}applyVehiclePose(this.carMeshes[i],car);});
    for(const m of this.markers){const quest=m.l.type==='quest',done=quest?state.quest?.stage==='completed':stamps.includes(m.l.id);m.g.visible=!quest||target?.id===m.l.id;m.pin.visible=!done;m.pin.position.y=23+Math.sin(this.time*2)*1.2;m.pin.rotation.y=this.time*.7;m.ring.material.color.set(done?0xc2efa1:m.l.color);m.ring.scale.setScalar(target?.id===m.l.id?1.07+Math.sin(this.time*2)*.06:1);}
    this.pedestrians.forEach((p,i)=>{p.position.set(ROADS[i%5]+45,0,180+(i*91+this.time*(i%2?5:-5)+1300)%1220);p.rotation.y=i%2?-Math.PI/2:Math.PI/2;});
    this.artSample?.update(state,this.time);this.renderer.render(this.scene,this.camera);
  }
  resetCamera(player){this.lookController?.reset();this.heading=player.angle;const pose=chaseCameraPose(player,player.angle,innerWidth<650);this.camera.position.copy(constrainCameraPosition(player,pose.position,this.cameraBlockers));this.look.copy(cameraAimTarget(player,player.angle,this.camera.position));}
}
