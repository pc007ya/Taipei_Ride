import * as THREE from '../vendor/three.module.js';
import { BUILDING } from './scale.js';
import {indexSampleGeometry} from './sample-geometry.js';

// One original, render-only material study around the starting intersection.
// Nothing in this module changes the world, colliders, camera, or simulation.
export const SAMPLE_STREET_BOUNDS = Object.freeze({ minX:665, maxX:915, minZ:350, maxZ:592 });
export const SAMPLE_STREET_SHOPS = Object.freeze([
  { x:855, y:357, name:'青禾茶屋', subtitle:'QING HE · TEA & EVERYDAY', color:0xdee0c8, index:0 },
  { x:855, y:535, name:'南風早餐', subtitle:'NAN FENG · BREAKFAST', color:0xc8d5d0, index:1 },
  { x:677, y:535, name:'日常修理所', subtitle:'DAILY REPAIR · SINCE 1986', color:0xc9c5bb, index:2 }
]);
export function isSampleStreetBuilding(o) {
  return o.type === 'building' && SAMPLE_STREET_SHOPS.some(s => s.x===o.x && s.y===o.y);
}
export function sampleStreetFootprints(world) {
  return world.buildings.filter(isSampleStreetBuilding).map(o => ({ x:o.x, z:o.y, w:o.w, d:o.d, height:o.h,
    polygon:[[o.x,o.y],[o.x+o.w,o.y],[o.x+o.w,o.y+o.d],[o.x,o.y+o.d]] }));
}
function noise(x,y,seed=0) {
  let n=Math.imul(x+seed*31,374761393)+Math.imul(y+seed*17,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
}
function dataTexture(size,pixel,color=true) {
  const data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const c=pixel(x,y);const offset=(y*size+x)*4;
    for(let k=0;k<4;k++)data[offset+k]=Math.max(0,Math.min(255,Math.round(c[k]??255)));
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;
  if(color)texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;texture.needsUpdate=true;return texture;
}
const surfaceCache=new Map();
function surface(kind) {
  if(surfaceCache.has(kind))return surfaceCache.get(kind);
  const size=256;
  const value=(x,y)=>{
    const fine=noise(x,y,4),coarse=noise(Math.floor(x/8),Math.floor(y/8),7),slow=Math.sin(x*.033)*Math.sin(y*.028);
    if(kind==='tile') {const gx=x%64,gy=y%32,seam=gx<2||gy<2,edge=gx<5||gy<4;return seam?.47:(edge?.75:.9)+fine*.07+coarse*.02;}
    if(kind==='paving') {const row=Math.floor(y/64),gx=(x+(row%2)*64)%128,gy=y%64;return gx<3||gy<3?.43:.79+noise(Math.floor((x+(row%2)*64)/128),row,8)*.1+fine*.075;}
    if(kind==='asphalt')return .61+fine*.19+coarse*.06+(fine>.95?.11:0)+slow*.02;
    if(kind==='wood')return .63+Math.sin(x*.5+Math.sin(y*.07)*2)*.1+fine*.08+Math.sin(x*.075)*.13;
    if(kind==='metal')return .7+fine*.06+Math.sin(y*.4)*.035;
    return .76+fine*.09+coarse*.035+slow*.025;
  };
  const base={tile:[171,178,171],paving:[145,143,132],asphalt:[81,88,89],wood:[102,76,51],metal:[151,157,153],concrete:[169,164,149]}[kind];
  const map=dataTexture(size,(x,y)=>{const v=value(x,y);return [...base.map(c=>c*v),255];});
  const normalMap=kind==='asphalt'?null:dataTexture(size,(x,y)=>{const at=(a,b)=>value((a+size)%size,(b+size)%size)*230/255,tileSize=kind==='paving'?16:8,dx=(at(x+1,y)-at(x-1,y))*size/(2*tileSize),dy=(at(x,y+1)-at(x,y-1))*size/(2*tileSize),n=new THREE.Vector3(-dx,-dy,1).normalize();return [(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255];},false);
  // Asphalt micro-normal noise costs a full-screen derivative/sample path;
  // retain its aggregate color texture, and reserve relief for architecture.
  // Roughness modulation was only low-amplitude noise. Scalar roughness keeps
  // the ceramic/wood/metal distinction without a third texture read per pixel.
  const result={map,normalMap};surfaceCache.set(kind,result);return result;
}
function signAtlas() {
  // The Node path is also a deterministic texture so geometry tests need no DOM.
  if(typeof document==='undefined')return dataTexture(64,(x,y)=>[190+(x%8),184+(y%6),159,255]);
  const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=768;const c=canvas.getContext('2d');
  const paper=['#d6d0b2','#a74e32','#3e625e'],ink=['#273b32','#f1dec0','#e7dbc0'];
  SAMPLE_STREET_SHOPS.forEach((shop,i)=>{
    const x=i*512;c.fillStyle=paper[i];c.fillRect(x,0,512,768);
    // Fine uneven pigment, generated here rather than sourced imagery.
    for(let a=0;a<2200;a++){const px=noise(a,i,1)*512,py=noise(a,i,2)*768;c.fillStyle=`rgba(29,26,19,${noise(a,i,3)*.035})`;c.fillRect(x+px,py,1+noise(a,i,4)*3,1);}
    c.strokeStyle=ink[i];c.lineWidth=2;c.strokeRect(x+14,16,484,222);c.strokeRect(x+20,22,472,210);
    c.fillStyle=ink[i];c.textAlign='center';c.textBaseline='middle';c.font=`600 ${i===2?69:80}px "Noto Sans CJK TC","Microsoft JhengHei",sans-serif`;c.fillText(shop.name,x+256,102,445);
    c.font='17px sans-serif';c.fillText(shop.subtitle,x+256,188);
    c.strokeRect(x+124,280,264,458);const chars=Array.from(i===0?'青禾茶':i===1?'早餐':'修理');c.font='600 99px "Noto Sans CJK TC","Microsoft JhengHei",sans-serif';
    chars.forEach((char,k)=>c.fillText(char,x+256,342+k*119));
  });
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

// Merge static geometry by material. UVs are in world-sized texels, so a tiled
// wall never stretches a single tile across an entire floor or building.
class GeometryBatches {
  constructor(){this.batches=new Map();this.boxGeometry=new THREE.BoxGeometry(1,1,1).toNonIndexed();}
  add(geometry,matrix,material,color=0xffffff,tileSize=8,uvOverride=null,part='detail') {
    let bucket=this.batches.get(material);
    if(!bucket){bucket={positions:[],normals:[],uvs:[],colors:[],parts:new Set()};this.batches.set(material,bucket);}
    bucket.parts.add(part);const g=geometry.index?geometry.toNonIndexed():geometry;
    const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,v=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix),tint=new THREE.Color(color);
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i).applyMatrix4(matrix);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();
      bucket.positions.push(v.x,v.y,v.z);bucket.normals.push(normal.x,normal.y,normal.z);bucket.colors.push(tint.r,tint.g,tint.b);
      if(uvOverride){const [u0,v0,u1,v1]=uvOverride;bucket.uvs.push(u0+uv.getX(i)*(u1-u0),v0+uv.getY(i)*(v1-v0));}
      else if(Math.abs(normal.y)>.7)bucket.uvs.push(v.x/tileSize,v.z/tileSize);
      else if(Math.abs(normal.x)>.7)bucket.uvs.push(v.z/tileSize,v.y/tileSize);
      else bucket.uvs.push(v.x/tileSize,v.y/tileSize);
    }
    if(geometry.index)g.dispose();
  }
  box(x,y,z,w,h,d,material,color=0xffffff,part='detail',tileSize=8){
    const matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y+h/2,z),new THREE.Quaternion(),new THREE.Vector3(w,h,d));
    this.add(this.boxGeometry,matrix,material,color,tileSize,null,part);
  }
  plane(x,y,z,w,h,angle,material,uv=[0,0,1,1],part='detail'){
    const geo=new THREE.PlaneGeometry(w,h),matrix=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),new THREE.Vector3(1,1,1));this.add(geo,matrix,material,0xffffff,8,uv,part);geo.dispose();
  }
  line(points,radius,material,part='wiring'){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),geometry=new THREE.TubeGeometry(curve,Math.max(4,points.length*3),radius,5,false);
    this.add(geometry,new THREE.Matrix4(),material,0xffffff,8,null,part);geometry.dispose();
  }
  finish(group){
    for(const [material,b]of this.batches){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(b.colors,3));indexSampleGeometry(geometry);geometry.computeBoundingSphere();
      const mesh=new THREE.Mesh(geometry,material);mesh.name=`sample-${material.name}`;mesh.receiveShadow=true;mesh.castShadow=!material.userData.ground&&!material.transparent;mesh.userData.parts=[...b.parts];group.add(mesh);
    }
    this.boxGeometry.dispose();
  }
}

export function createSampleStreet(world) {
  const group=new THREE.Group();group.name='original-start-street-material-study';
  const batch=new GeometryBatches(),materials={};
  function material(name,color,options={}){
    if(options.normalMap){options.normalScale=new THREE.Vector2(options.bumpScale??1,options.bumpScale??1);delete options.bumpScale;}const m=new THREE.MeshStandardMaterial({name,color,vertexColors:true,roughness:.87,...options});materials[name]=m;return m;
  }
  const tile=material('ceramic-tile',0xffffff,{...surface('tile'),bumpScale:.13});
  const concrete=material('aged-concrete',0xffffff,{...surface('concrete'),bumpScale:.09});
  const paving=material('paving',0xffffff,{...surface('paving'),bumpScale:.075});paving.userData.ground=true;
  const asphalt=material('asphalt',0xffffff,{...surface('asphalt'),bumpScale:.065});asphalt.userData.ground=true;
  const wood=material('wood',0xffffff,{...surface('wood'),bumpScale:.055});
  const metal=material('galvanized-metal',0xffffff,{...surface('metal'),bumpScale:.018,metalness:.45,roughness:.58});
  const dark=material('dark-recess',0x1c2828,{roughness:.98});
  const frame=material('painted-metal',0x3b4843,{metalness:.32,roughness:.55});
  const plaster=material('interior-plaster',0x817960,{...surface('concrete'),bumpScale:.05});
  const glass=material('window-glass',0x556e70,{roughness:.23,metalness:.28});
  const reflection=material('glass-highlights',0xa1b3ab,{roughness:.25,metalness:.32,transparent:true,opacity:.25,depthWrite:false});
  const warm=material('warm-fixtures',0xd1b774,{emissive:0xe7b357,emissiveIntensity:.25,roughness:.58});
  const sign=material('shop-signs',0xffffff,{map:signAtlas(),roughness:.78,emissive:0x5b5039,emissiveIntensity:.045});
  const grimeTexture=dataTexture(128,(x,y)=>{const f=1-y/127,a=(Math.pow(f,2.9)*.5+Math.pow(f,6)*noise(x,0)*.6)*(.5+noise(x,y)*.5);return [39,42,30,a*135];});
  const grime=material('joint-weathering',0xffffff,{map:grimeTexture,transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const ground=(x0,z0,x1,z1,mat,y=.467)=>batch.box((x0+x1)/2,y-.012,(z0+z1)/2,x1-x0,.012,z1-z0,mat,0xffffff,'ground-surface',mat===asphalt?8:16);
  // Flat road overlays remain below the original paint (.51); no raised items.
  ground(765,350,835,445,asphalt);ground(665,445,915,515,asphalt);ground(765,515,835,592,asphalt);
  for(const [x0,x1]of [[665,765],[835,915]])for(const [z0,z1]of [[350,445],[515,592]])ground(x0,z0,x1,z1,paving,.817);
  // Gutter sediment is a flat dark line inside the curb, never a driving obstacle.
  for(const [z0,z1]of [[350,445],[515,592]])for(const x of [765.9,834.1])batch.box(x,.473,(z0+z1)/2,1.4,.008,z1-z0,dark,0x88978a,'gutter-seam');
  for(const [x0,x1]of [[665,765],[835,915]])for(const z of [445.9,514.1])batch.box((x0+x1)/2,.473,z,x1-x0,.008,1.4,dark,0x88978a,'gutter-seam');

  for(const o of world.buildings.filter(isSampleStreetBuilding)) {
    const shop=SAMPLE_STREET_SHOPS.find(s=>s.x===o.x&&s.y===o.y),cx=o.x+o.w/2,cz=o.y+o.d/2;
    const floor=BUILDING.groundFloorHeight;
    // The ground-floor core is inset 7u to create actual 70cm shop depth.
    batch.box(cx,.9,cz,o.w-14,floor-1,o.d-14,plaster,0xffffff,'interior-core');
    batch.box(cx,.86,cz,o.w-.1,.28,o.d-.1,concrete,0xc9c5b5,'store-threshold');
    batch.box(cx,floor,cz,o.w-4.4,o.h-floor,o.d-4.4,concrete,shop.color,'upper-core');
    // Four architectural faces share one material set; low geometry stays within
    // the exact same original footprint, including shop doors and trim.
    for(let face=0;face<4;face++){
      const alongX=face%2===0,width=alongX?o.w:o.d,depth=alongX?o.d:o.w,normal=face<2?1:-1;
      const local=(u,v,y)=>alongX?[cx+u,y,cz+normal*(depth/2-v)]:[cx+normal*(depth/2-v),y,cz+u];
      const part=(u,v,y,w,h,d,mt,color=0xffffff,name='facade')=>{const [x,yy,z]=local(u,v,y);batch.box(x,yy,z,alongX?w:d,h,alongX?d:w,mt,color,name);};
      const signPlane=(u,v,y,w,h,mt,uv,name)=>{const p=local(u,v,y);batch.plane(...p,w,h,[0,Math.PI/2,Math.PI,-Math.PI/2][face],mt,uv,name);};
      // Structural tile piers and recessed dark display bays.
      for(const u of [-width/2+1.3,width/2-1.3])part(u,1.35,.95,2.6,30.3,2.6,tile,shop.color,'arcade-tile-pier');
      part(0,1.3,23.5,width-5.2,8.4,2.6,tile,shop.color,'tile-fascia');
      part(0,6.95,1.15,width-5.8,22.15,.1,dark,0xffffff,'deep-shop-shadow');
      part(0,4.1,1.2,width-6.2,.26,5.4,wood,0xffffff,'interior-floor');
      // Large frames establish adult scale: 22u door, floor at 32u.
      const bays=3,bayWidth=(width-6)/bays;
      for(let b=0;b<bays;b++){
        const u=-width/2+3+bayWidth*(b+.5),isDoor=b===1;
        part(u,5.3,1.5,bayWidth-.9,21.9,.35,plaster,0xffffff,'warm-interior-backwall');
        // Shelves/counter are physically behind the glass. Their broad planes
        // remain visible at street distance rather than relying on small props.
        if(!isDoor){
          part(u,4.15,1.5,bayWidth-1.7,7.5,2.5,wood,0xffffff,'shop-counter');
          part(u,3.95,9,bayWidth-1.1,.6,3,concrete,0xd0c8a9,'countertop');
          for(const sy of [13.2,17.7]){part(u,5.1,sy,bayWidth-1.4,.42,2.1,wood,0xffffff,'shelf');for(let jar=0;jar<3;jar++)part(u+(jar-1)*2.7,4.65,sy+.42,1.45,1.6,1.2,jar===1?warm:metal,jar===1?0xffffff:0xb0b7a2,'tea-tins');}
        }
        for(const edge of [-1,1])part(u+edge*(bayWidth-.7)/2,2.1,1.25,.5,22.1,.55,wood,0xffffff,'storefront-mullion');
        part(u,2.1,1.25,bayWidth,.45,.55,wood,0xffffff,'storefront-frame');part(u,2.1,22.9,bayWidth,.65,.55,wood,0xffffff,'storefront-frame');
        if(isDoor){part(u,2.25,1.7,bayWidth-.8,6.2,.12,glass,0x8f9e91,'door-bottom-glass');part(u+bayWidth*.28,1.7,10,.27,2.25,.4,metal,0xd2c3a0,'door-handle');}
        // Transparent panes preserve the modeled interiors; thin, offset bands
        // add a controlled sky reflection without opaque white rectangles.
        signPlane(u,1.98,14.7,bayWidth-.8,15.8,reflection,[0,0,1,1],'shop-glazing');
        part(u,2.04,8.1,bayWidth-.55,.32,.45,frame,0xffffff,'glazing-crossbar');
      }
      // Slim projecting cornice and internally contained awning/fixture strip.
      part(0,1.48,23.45,width-.25,.75,2.95,frame,0xffffff,'store-cornice');
      part(0,.5,31.25,width-.1,.65,.95,concrete,0xd8d5bc,'floor-cornice');
      signPlane(0,.08,27.48,width-6.1,6.55,sign,[shop.index/3,2/3,(shop.index+1)/3,1],'original-shop-sign');
      part(0,1.54,22.9,width-8,.18,.65,warm,0xffffff,'under-fascia-light');
      // A restrained base weather stain ties facade columns to the pavement.
      for(const u of [-width/2+1.3,width/2-1.3])signPlane(u,.036,3.1,2.5,4.3,grime,[0,0,1,1],'base-splash-weathering');
      const floors=Math.round((o.h-floor)/30);
      for(let f=0;f<floors;f++){
        const y=floor+f*30,windowWidth=Math.min(10,(width-12)/3),windowHeight=15.5,windowY=y+8;
        // Ceramic spandrels and piers create genuine window reveals.
        part(0,1.1,y,width,8,2.2,tile,shop.color,'ceramic-spandrel');
        part(0,1.1,y+23.5,width,6.5,2.2,tile,shop.color,'ceramic-spandrel');
        const slots=[-width*.29,0,width*.29];let previous=-width/2;
        for(let k=0;k<slots.length;k++){
          const u=slots[k],left=u-windowWidth/2;if(left>previous)part((previous+left)/2,1.1,windowY,left-previous,windowHeight,2.2,tile,shop.color,'window-wall-pier');previous=u+windowWidth/2;
          part(u,1.95,windowY,windowWidth,windowHeight,.25,dark,0xffffff,'window-reveal');
          part(u,1.78,windowY+.5,windowWidth-.8,windowHeight-.8,.12,glass,k===1?0x829289:0xffffff,'recessed-window');
          // One softly lit interior panel and unequal curtains add occupancy.
          if((f+k+shop.index)%3===0)part(u+windowWidth*.24,1.63,windowY+1,windowWidth*.33,windowHeight-1.9,.08,plaster,0xd4cbaa,'window-curtain');
          for(const side of [-1,1])part(u+side*(windowWidth-.4)/2,.84,windowY,.35,windowHeight,.6,metal,0x89968e,'window-metal-frame');
          part(u,.84,windowY,windowWidth,.4,.6,metal,0x89968e,'window-metal-frame');part(u,.84,windowY+windowHeight-.4,windowWidth,.4,.6,metal,0x89968e,'window-metal-frame');part(u,.84,windowY,.32,windowHeight,.6,metal,0x89968e,'window-center-frame');
          part(u,.6,windowY-.55,windowWidth+1.4,.55,1.15,concrete,0xd5d5bd,'projecting-sill');
          part(u,.9,windowY+7.4,windowWidth,.22,.45,metal,0x7e8982,'window-crossbar');
        }
        if(previous<width/2)part((previous+width/2)/2,1.1,windowY,width/2-previous,windowHeight,2.2,tile,shop.color,'window-wall-pier');
        part(0,.65,y+29.3,width,.7,1.3,concrete,0xd4d2ba,'floor-joint');
        // AC units stay tucked within the original bounds instead of extending
        // invisible collision volumes over the sidewalk.
        if(f===0&&face%2===1){const u=width*.3;part(u,1.03,y+2.4,7.6,4.3,1.85,metal,0xcbd0bb,'air-conditioner');for(let slat=0;slat<6;slat++)part(u,.075,y+2.85+slat*.54,6.5,.17,.1,frame,0xb4b6a2,'air-conditioner-grille');}
      }
      // Narrow secondary signage sits on the corner pier, within the existing
      // facade envelope. Its smaller scale keeps the main shop name dominant.
      if(face===0||face===(o.x>800?3:1)){
        const u=width/2-2.8,sy=Math.min(47,o.h-12);
        part(u,.24,sy-9.75,4.2,19.5,.44,frame,0xffffff,'secondary-sign-frame');
        signPlane(u,.012,sy,3.8,19,sign,[(shop.index*512+124)/1536,30/768,(shop.index*512+388)/1536,488/768],'original-vertical-shop-sign');
      }
      part(0,.75,o.h,width,2.6,1.5,concrete,0xb9bba8,'roof-parapet');
      // Wall-bound electrical runs: each wire remains on the facade and never
      // spans a roadway, rider clearance, or an existing walking corridor.
      const wirePoints=[local(-width*.41,.35,34.3),local(-width*.18,.4,33.55),local(width*.1,.35,33.9),local(width*.41,.35,34.25)];batch.line(wirePoints,.075,frame,'facade-service-wire');
    }
    batch.box(cx,o.h-.08,cz,o.w-3,.3,o.d-3,concrete,0x868e83,'flat-roof');
    // A compact service riser makes the low tea-house roof believable.
    batch.box(o.x+o.w*.66,o.h+.22,o.y+o.d*.65,8,5.8,9,metal,0xa1aca0,'rooftop-service-box');
  }
  batch.finish(group);
  let drawCalls=0,triangles=0;group.traverse(o=>{if(o.isMesh){drawCalls++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  group.userData={renderOnly:true,originalProceduralAssets:true,bounds:{...SAMPLE_STREET_BOUNDS},footprints:sampleStreetFootprints(world),drawCalls,triangles,
    doorHeight:BUILDING.doorHeight,groundFloorHeight:BUILDING.groundFloorHeight,shops:SAMPLE_STREET_SHOPS.map(s=>s.name),materials:Object.keys(materials),
    roadPolygons:[[[765,350],[835,350],[835,445],[765,445]],[[665,445],[915,445],[915,515],[665,515]],[[765,515],[835,515],[835,592],[765,592]]]};
  return group;
}
