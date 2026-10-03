import * as T from '../vendor/three.module.js';
import {ROADS,ROAD_WIDTH} from './world.js';
// Scene-local geometry, materials and sign textures; no map or renderer cache.
export function createXitunCity(world){
 const city=new T.Group();city.name='simplified-xitun-city';
 const cube=new T.BoxGeometry(1,1,1),solid=new T.MeshStandardMaterial({color:0xffffff,roughness:.9});
 const glass=new T.MeshStandardMaterial({color:0x527a80,roughness:.65,emissive:0xf3d19b,emissiveIntensity:0});
 const lampMaterial=new T.MeshStandardMaterial({color:0xf5df9e,emissive:0xffdc87,emissiveIntensity:.1});
 const batches=new Map(),dummy=new T.Object3D();
 const add=(x,y,z,w,h,d,color,material=solid)=>{if(!batches.has(material))batches.set(material,[]);dummy.position.set(x,y+h/2,z);dummy.scale.set(w,h,d);dummy.rotation.set(0,0,0);dummy.updateMatrix();batches.get(material).push({matrix:dummy.matrix.clone(),color:new T.Color(color)});};
 function label(text,x,y,z,w=85,h=14,bg='#275e54',facing=0){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,512,96);c.fillStyle='#fff5d7';c.textAlign='center';c.textBaseline='middle';c.font='bold 44px "Noto Sans CJK TC", "Microsoft JhengHei",sans-serif';c.fillText(text,256,48);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));mesh.position.set(x,y,z);mesh.rotation.y=facing;city.add(mesh);
 }
 add(800,-2,800,1900,2,1900,0x90a887);
 for(const r of ROADS){add(r,-.65,800,ROAD_WIDTH,1,1440,0x65777a);add(800,-.6,r,1440,1,ROAD_WIDTH,0x65777a);}
 for(const r of ROADS)for(let t=215;t<1440;t+=24){if(ROADS.some(v=>Math.abs(v-t)<50))continue;add(r,.01,t,1,.08,13,0xe8ce7b);add(t,.01,r,13,.08,1,0xe8ce7b);}
 for(const x of ROADS)for(const z of ROADS)for(let i=0;i<6;i++){add(x-22+i*8,.02,z-39,4,.08,9,0xe3e6d9);add(x-22+i*8,.02,z+39,4,.08,9,0xe3e6d9);add(x-39,.02,z-22+i*8,9,.08,4,0xe3e6d9);add(x+39,.02,z-22+i*8,9,.08,4,0xe3e6d9);}
 for(let i=0;i<4;i++)label(i<2?'台灣大道四段':'台灣大道三段',[180,800,1150,1450][i],22,758,100,13,'#3c6855');
 for(const o of world.buildings){
  const cx=o.x+o.w/2,cz=o.y+o.d/2;
  if(o.kind==='opera'){
   // A cream facade with organic openings, dark recessed glazing and a green
   // roof distinguishes the theater without reproducing a detailed CAD model.
   add(cx,0,cz,o.w,o.h,o.d,0x628387,glass);
   const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(o.w,0);shape.lineTo(o.w,o.h);shape.lineTo(0,o.h);shape.closePath();
   for(const [x,y,rx,ry]of [[37,28,22,25],[95,59,26,22],[155,29,27,27],[192,69,10,15]]){const hole=new T.Path();hole.absellipse(x,y,rx,ry,0,Math.PI*2,true,0);shape.holes.push(hole);}
   const geo=new T.ExtrudeGeometry(shape,{depth:4,bevelEnabled:false,curveSegments:12});const cream=new T.MeshStandardMaterial({color:0xeee3cb,roughness:.87,side:T.DoubleSide});const facade=new T.Mesh(geo,cream);facade.position.set(o.x,0,o.y-4);city.add(facade);
   add(cx,0,o.y+3,o.w,o.h,6,0xeee3cb);add(o.x+3,0,cz,6,o.h,o.d,0xeee3cb);add(o.x+o.w-3,0,cz,6,o.h,o.d,0xeee3cb);add(cx,o.h,cz,o.w+3,3,o.d+3,0xddd6be);add(cx,o.h+3,cz,o.w-30,2,o.d-30,0x73955e);
   label(o.sign,cx,13,o.y-5,150,15,'#777469',Math.PI);continue;
  }
  add(cx,0,cz,o.w,o.h,o.d,o.color);add(cx,o.h,cz,o.w+3,3,o.d+3,0xb7c2b2);
  for(let y=24;y<o.h-10;y+=25)for(let x=o.x+12;x<o.x+o.w-7;x+=24){add(x,y,o.y+o.d+.5,13,13,1,0xffffff,glass);add(x,y,o.y-.5,13,13,1,0xffffff,glass);}
  add(cx,0,o.y+o.d,45,18,2,0xffffff,glass);label(o.sign,cx,o.kind==='hospital'?46:25,o.y+o.d+1,o.kind==='hospital'?175:135,17,o.kind==='store'?'#91714b':'#356a66');
  if(o.kind==='hospital'){add(o.x+o.w-24,o.h-38,o.y+o.d+2,6,25,1,0xc45c48);add(o.x+o.w-24,o.h-29,o.y+o.d+2,22,6,1,0xc45c48);add(cx,16,o.y+o.d+9,62,2,18,0x9bc9c5);label('入口',cx,10,o.y+o.d+10,30,9);}
 }
 // The dark center is lower than the green terraces, while the rim stays at
 // walking level. Water bounds match the simulation's fixed obstacle exactly.
 add(965,-1,963,232,1.4,232,0x85a56d);add(970,-.4,966,195,.5,166,0xa0b58b);add(971,-.3,964,136,.7,108,0x58959e);add(970,.2,1057,205,.25,11,0xddd4b9);add(858,.2,967,11,.25,211,0xddd4b9);
 label('秋紅谷',1060,14,1065,75,15,'#697b51');
 for(const o of world.stalls){const cx=o.x+o.w/2,cz=o.y+o.d/2;add(cx,0,cz,o.w,15,o.d,0xa68864);add(cx,24,cz,o.w+5,3,o.d+8,o.color);add(o.x+2,0,o.y+o.d,1.5,24,1.5,0xd6c7a2);add(o.x+o.w-2,0,o.y+o.d,1.5,24,1.5,0xd6c7a2);label(o.sign,cx,18,o.y+o.d+1,39,9,'#815746');}
 label('逢甲夜市',1290,37,435,140,17,'#944d46');
 const trunkGeo=new T.CylinderGeometry(1,1.4,24,7),crownGeo=new T.IcosahedronGeometry(9,1),trunkMat=new T.MeshStandardMaterial({color:0x786e52});
 const foliage=[],softOccluders=[];
 for(const tree of world.trees){const trunk=new T.Mesh(trunkGeo,trunkMat);trunk.position.set(tree.x,12,tree.y);city.add(trunk);const crown=new T.Mesh(crownGeo,new T.MeshStandardMaterial({color:tree.color,roughness:1}));crown.position.set(tree.x,26,tree.y);city.add(crown);crown.updateMatrixWorld();const entry={mesh:crown,bounds:new T.Box3().setFromObject(crown)};foliage.push(entry);softOccluders.push(entry);}
 for(const l of world.lamps){add(l.x,0,l.y,.9,44,.9,0x697c71);add(l.x,42,l.y,5,1,3,0xffffff,lampMaterial);}
 for(const [material,entries]of batches){const mesh=new T.InstancedMesh(cube,material,entries.length);entries.forEach((e,i)=>{mesh.setMatrixAt(i,e.matrix);mesh.setColorAt(i,e.color);});mesh.name='xitun-static-batch';city.add(mesh);}
 return {city,glass,lampMaterial,foliage,softOccluders};
}
