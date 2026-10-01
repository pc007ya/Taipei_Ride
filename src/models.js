import * as T from '../vendor/three.module.js';
import {PERSON,SCOOTER,CAR} from './scale.js';

// Original parametric models. Every coordinate is authored in the shared 10 u/m scale.
const cache=new Map();
const mat=(c,kind='cloth')=>{const key=`${c}:${kind}`;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color:c,roughness:kind==='paint'?.38:kind==='metal'?.28:kind==='glass'?.19:.86,metalness:kind==='metal'?.72:kind==='paint'?.2:0}));return cache.get(key);};
const skin=0xbb8965,hair=0x242c2b,pants=0x263e47,shoe=0x24302f,trim=0xadc0b9;
const sphere=new T.SphereGeometry(1,14,10),unitBox=new T.BoxGeometry(1,1,1);
function mesh(g,geometry,color,name,kind){const m=new T.Mesh(geometry,typeof color==='object'?color:mat(color,kind));m.name=name||'';g.add(m);return m;}
function ell(g,name,p,size,color,kind){const m=mesh(g,sphere,color,name,kind);m.position.set(...p);m.scale.set(...size);return m;}
function block(g,name,p,size,color,kind){const m=mesh(g,unitBox,color,name,kind);m.position.set(...p);m.scale.set(...size);return m;}
function segment(g,name,a,b,r0,r1,color,kind){const from=new T.Vector3(...a),to=new T.Vector3(...b),d=to.clone().sub(from),m=mesh(g,new T.CylinderGeometry(r1,r0,d.length(),10,1),color,name,kind);m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
function curve(g,name,points,r,color,kind){return mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*3),r,6,false),color,name,kind);}
// Loft smooth, closed cross-sections: continuous primary forms, not overlapping spheres.
function loft(rings,axis='y',sides=20){
 const p=[],uv=[],idx=[];for(let j=0;j<rings.length;j++){const r=rings[j];for(let i=0;i<=sides;i++){const a=i/sides*Math.PI*2,power=r.power||1,c=Math.sign(Math.cos(a))*Math.pow(Math.abs(Math.cos(a)),power),s=Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),power);p.push(...(axis==='y'?[r.x+r.rx*c,r.y,r.z+r.rz*s]:[r.x,r.y+r.ry*c,r.z+r.rz*s]));uv.push(i/sides,j/(rings.length-1));}}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;idx.push(...(axis==='y'?[a,b,a+1,a+1,b,b+1]:[a,a+1,b,a+1,b+1,b]));}
 for(const end of [0,rings.length-1]){const r=rings[end],center=p.length/3;p.push(r.x,r.y,r.z);uv.push(.5,.5);for(let i=0;i<sides;i++){const a=end*(sides+1)+i;idx.push(...((end===0)===(axis==='x')?[center,a+1,a]:[center,a,a+1]));}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();return geo;
}
// Garments follow a continuous joint curve with muscle/cloth cross-sections.
// Elliptical profiles shape thighs, calves and sleeves without sphere joints.
function sweptGarment(points,profiles,folds=false,segments=24,sides=12){
 const path=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),positions=[],indices=[],frames=path.computeFrenetFrames(segments,false),first=frames.tangents[0],reference=new T.Vector3(0,0,1).addScaledVector(first,-first.z);if(reference.lengthSq()<1e-6)reference.set(1,0,0).addScaledVector(first,-first.x);reference.normalize();const cos=reference.dot(frames.normals[0]),sin=reference.dot(frames.binormals[0]);
 for(let j=0;j<=segments;j++){const t=j/segments,p=path.getPoint(t),tangent=frames.tangents[j],side=frames.normals[j].clone().multiplyScalar(cos).addScaledVector(frames.binormals[j],sin).normalize(),front=new T.Vector3().crossVectors(side,tangent).normalize(),f=t*(profiles.length-1),i=Math.min(profiles.length-2,Math.floor(f)),u=f-i,rx=T.MathUtils.lerp(profiles[i][0],profiles[i+1][0],u),rz=T.MathUtils.lerp(profiles[i][1],profiles[i+1][1],u);
  for(let k=0;k<=sides;k++){const a=k/sides*Math.PI*2,crease=folds?1+.035*Math.sin(t*48+a*1.5)*Math.exp(-Math.pow((t-.52)/.16,2)):1,v=p.clone().addScaledVector(front,Math.cos(a)*rx*crease).addScaledVector(side,Math.sin(a)*rz*crease);positions.push(v.x,v.y,v.z);}
 }
 for(let j=0;j<segments;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
 for(const end of [0,segments]){const p=path.getPoint(end/segments),center=positions.length/3;positions.push(p.x,p.y,p.z);for(let i=0;i<sides;i++){const a=end*(sides+1)+i;indices.push(...(end===0?[center,a+1,a]:[center,a,a+1]));}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function roundedBox(w,h,d,r=.2){const shape=new T.Shape(),x=-w/2+r,y=-h/2+r,W=w-2*r,H=h-2*r;shape.moveTo(x,y);shape.lineTo(x+W,y);shape.lineTo(x+W,y+H);shape.lineTo(x,y+H);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:Math.max(.1,d-2*r),bevelEnabled:true,bevelSize:r,bevelThickness:r,bevelSegments:3,steps:1,curveSegments:4});geo.center();geo.computeVertexNormals();return geo;}
function rounded(g,name,p,size,color,r=.2,kind){const m=mesh(g,roundedBox(...size,r),color,name,kind);m.position.set(...p);return m;}
function contactShadow(group,rx,rz){const m=new T.Mesh(new T.CircleGeometry(1,28),new T.MeshBasicMaterial({color:0x18372f,transparent:true,opacity:.18,depthWrite:false}));m.name='contact-shadow';m.rotation.x=-Math.PI/2;m.position.y=.035;m.scale.set(rx,rz,1);group.add(m);}
function anchor(g,name,p){const a=new T.Object3D();a.name=name;a.position.set(...p);g.add(a);return a;}
export const RIDER_CONTACTS=Object.freeze({seat:[-3,8.55,0],leftGrip:[5.7,11.25,-3.65],rightGrip:[5.7,11.25,3.65],leftFoot:[.9,3.06,-2.3],rightFoot:[.9,3.06,2.3]});

function makeHead(g,p,helmet,character='male'){
 const head=new T.Group();head.name='head';head.position.set(...p);g.add(head);
 mesh(head,loft([{x:-.06,y:-1.03,z:0,rx:.52,rz:.58},{x:.04,y:-.63,z:0,rx:.77,rz:.73},{x:0,y:.1,z:0,rx:.91,rz:.81},{x:-.12,y:.75,z:0,rx:.76,rz:.76},{x:-.16,y:1.08,z:0,rx:.36,rz:.38}]),skin,'face');
 for(const side of [-1,1]){
  ell(head,'ear',[-.09,-.12,side*.81],[.23,.3,.14],0xba8361);
  ell(head,'eye-white',[.835,.13,side*.33],[.028,.055,.129],0xe8e3d6);
  ell(head,'iris',[.868,.13,side*.33],[.013,.046,.052],0x2d352d);
  curve(head,'eyebrow',[[.86,.38,side*.13],[.88,.43,side*.32],[.80,.39,side*.5]],.027,hair);
 }
 segment(head,'nose-bridge',[.83,.3,0],[1.0,-.22,0],.1,.13,skin);ell(head,'nose-tip',[1.05,-.28,0],[.16,.13,.15],0xc5926b);curve(head,'mouth',[[.773,-.59,-.25],[.846,-.63,0],[.773,-.59,.25]],.032,0x754d3e);
 const cp=[],ci=[];for(let j=0;j<=10;j++)for(let i=0;i<=20;i++){const phi=i/20*Math.PI*2,maxTheta=Math.PI*((helmet?.42:.32)+(helmet?.25:.3)*(1-Math.cos(phi))/2),theta=j/10*maxTheta;cp.push(Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi));}for(let j=0;j<10;j++)for(let i=0;i<20;i++){const a=j*21+i,b=a+21;ci.push(a,a+1,b,a+1,b+1,b);}const cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(cp,3));cap.setIndex(ci);cap.computeVertexNormals();const crown=mesh(head,cap,helmet?0xf0e7d2:hair,helmet?'helmet':'hair','paint');crown.position.set(helmet?-.14:-.02,helmet?.28:.2,0);crown.scale.set(helmet?1.03:.98,helmet?1.02:1.04,helmet?.98:.93);
 if(helmet){
  for(const side of [-1,1]){ell(head,'helmet-side',[-.26,.06,side*.81],[.56,.58,.22],0xe1ddca,'paint');curve(head,'chin-strap',[[.02,-.25,side*.83],[.4,-.93,side*.45],[.7,-.98,0]],.055,0x354745);}
  curve(head,'helmet-rim',[[.79,.57,-.64],[1.0,.62,0],[.79,.57,.64]],.075,0x627b77,'metal');
  curve(head,'helmet-vent',[[-.66,1.12,-.38],[-.14,1.28,-.4],[.35,1.13,-.35]],.055,0x63766d);
 }else{
  for(const side of [-1,1])rounded(head,'sideburn',[-.06,.1,side*.74],[.43,.61,.18],hair,.06);
  curve(head,'hair-part',[[-.36,1.13,-.18],[.16,1.07,-.21],[.62,.78,-.27]],.028,0x4a4b40);for(let i=0;i<6;i++){const z=-.49+i*.18;mesh(head,sweptGarment([[-.13,1.21,z],[.35,1.12,z+.04],[.78,.82,z+.08],[.89,.62,z+.1]],[[.035,.115],[.055,.12],[.043,.09],[.012,.015]],false,8,6),i%2?0x292f2b:0x242c29,'hair-tuft');}
 }
 if(character==='female'){ell(head,'hair-tie',[-.91,.03,0],[.33,.32,.36],0x6e4235);curve(head,'ponytail',[[-.98,.05,0],[-1.28,-.4,0],[-1.14,-1.22,.08],[-1.01,-1.85,.18]],.28,0x3c2e28);}
 return head;
}
function makeShoe(g,name,p){const s=new T.Group();s.name=name;s.position.set(...p);g.add(s);rounded(s,'sole',[.32,.13,0],[2.65,.27,1.12],0x101e20,.09);mesh(s,loft([{x:-.82,y:.42,z:0,ry:.22,rz:.45},{x:-.5,y:.53,z:0,ry:.38,rz:.49},{x:.3,y:.48,z:0,ry:.31,rz:.52},{x:1.48,y:.28,z:0,ry:.16,rz:.43}], 'x',16),shoe,'shoe-upper');for(let i=0;i<3;i++)curve(s,'lace',[[.02+i*.2,.77-i*.07,-.26],[.17+i*.2,.79-i*.07,.24]],.022,0xbbc3b4);return s;}
function torso(g,shirt,lean=0,character='male'){
 const rings=[{y:8.95,rx:.79,rz:1.42},{y:9.45,rx:.94,rz:1.56},{y:10.5,rx:.85,rz:1.42},{y:11.75,rx:1.06,rz:1.73},{y:13.02,rx:.94,rz:2.12,power:.7},{y:13.3,rx:.81,rz:1.91,power:.75},{y:13.6,rx:.65,rz:1.48},{y:13.88,rx:.46,rz:.58}].map(r=>({...r,rx:(r.rx+(lean>0&&r.y<10.6?.23:0))*(character==='female'?.92:1),rz:r.rz*(character==='female'?.94:1),x:lean*(r.y-8.95)/4.93,z:0}));
 mesh(g,loft(rings),shirt,'torso');const front=y=>lean*(y-8.95)/4.93+.97;
 curve(g,'zipper',[[front(9.5),9.5,0],[front(11),11,0],[front(12.4),12.4,0],[lean+.56,13.65,0]],.035,0xc1bda4,'metal');
 for(const z of [-.86,.86]){curve(g,'pocket-seam',[[front(10.5),10.5,z-.24],[front(11.1)+.09,11.1,z+.24]],.027,0x637a70);curve(g,'shoulder-seam',[[lean-.18,13.49,z*.55],[lean+.48,13.16,z*1.8]],.035,0x718779);}
 const collar=mesh(g,new T.TorusGeometry(.62,.12,6,16),0x304b48,'collar');collar.rotation.x=Math.PI/2;collar.position.set(lean,13.86,0);
 mesh(g,loft([{x:lean-.04,y:13.58,z:0,rx:.68,rz:.68},{x:lean,y:14.02,z:0,rx:.54,rz:.55},{x:lean+.04,y:14.55,z:0,rx:.45,rz:.45},{x:lean+.07,y:15.0,z:0,rx:.42,rz:.42}]),skin,'neck');
}
function arm(g,name,shoulder,elbow,wrist,shirt,grasp=false){
 const a=new T.Group();a.name=name;a.userData.parts=['upper-arm','forearm','elbow'];g.add(a);const inner=[shoulder[0]-.05,shoulder[1]+.25,shoulder[2]*.6],cap=[shoulder[0],shoulder[1]-.1,shoulder[2]],upper=new T.Vector3(...shoulder).lerp(new T.Vector3(...elbow),.4).toArray(),lower=new T.Vector3(...elbow).lerp(new T.Vector3(...wrist),.48).toArray();mesh(a,sweptGarment([inner,cap,upper,elbow,lower,wrist],[[.16,.16],[.57,.49],[.56,.48],[.43,.39],[.42,.36],[.28,.25]],true),shirt,'sleeve');const dir=new T.Vector3(...wrist).sub(new T.Vector3(...elbow)).normalize(),cuff=new T.Vector3(...wrist).addScaledVector(dir,-.15);segment(a,'cuff',cuff.toArray(),new T.Vector3(...wrist).addScaledVector(dir,.12).toArray(),.3,.3,0x294741);
 const hand=new T.Group();hand.name='hand';hand.position.set(...wrist);a.add(hand);ell(hand,'palm',[grasp?.08:.07,grasp?-.03:-.4,0],[.35,grasp?.25:.47,.22],skin);
 for(let i=0;i<4;i++){const z=(i-1.5)*.12;if(grasp)curve(hand,'finger',[[.03,.12,z],[.31,-.02,z],[.23,-.29,z],[-.08,-.29,z]],.073,0xc59670);else segment(hand,'finger',[.16,-.56,z],[.08,-.97+(i===0||i===3?.14:0),z],.073,.055,skin);}
 ell(hand,'thumb',[.29,grasp?.18:-.37,.2],[.18,.25,.12],skin);return a;
}
function pantsHip(g,p=[0,8.85,0]){const h=new T.Group();h.position.set(...p);h.name='pelvis';g.add(h);const shape=loft([{x:0,y:-.84,z:0,rx:.5,rz:1.0},{x:-.06,y:-.4,z:0,rx:.96,rz:1.78},{x:0,y:.13,z:0,rx:.88,rz:1.58},{x:0,y:.66,z:0,rx:.79,rz:1.32}]);const vertices=shape.attributes.position;for(let i=0;i<vertices.count;i++)if(vertices.getY(i)<-.4)vertices.setY(i,vertices.getY(i)+.48*Math.pow(Math.abs(vertices.getZ(i))/1.78,2));shape.computeVertexNormals();mesh(h,shape,pants,'trouser-waist');mesh(h,loft([{x:0,y:.36,z:0,rx:.85,rz:1.41},{x:0,y:.59,z:0,rx:.81,rz:1.35}], 'y',16),0x1c3034,'belt');block(h,'buckle',[.83,.45,0],[.1,.23,.29],0xadb6a3,'metal');return h;}
function leg(g,name,hip,knee,ankle){const l=new T.Group();l.name=name;l.userData.parts=['thigh','knee','shin','fabric-fold'];g.add(l);const h=new T.Vector3(...hip),k=new T.Vector3(...knee),a=new T.Vector3(...ankle),upper=h.clone().lerp(k,.32),lower=h.clone().lerp(k,.72),calf=k.clone().lerp(a,.4);calf.x-=.13;mesh(l,sweptGarment([h.clone().add(new T.Vector3(0,.4,0)).toArray(),h.toArray(),upper.toArray(),lower.toArray(),k.toArray(),calf.toArray(),a.toArray()],[[.24,.2],[.78,.68],[.9,.76],[.7,.61],[.54,.5],[.63,.54],[.38,.35]],true),pants,'trouser-leg');return l;}
export function createWalker(color=0x6b8b77,detailed=true,character='male'){
 const g=new T.Group();g.name='walking-player';g.userData.character=character;torso(g,color,0,character);pantsHip(g);makeHead(g,[.08,15.57,0],false,character);
 for(const side of [-1,1]){const l=leg(g,side<0?'left-leg':'right-leg',[0,8.7,side*1.03],[.14,4.82,side*1.08],[0,1.03,side*1.13]);makeShoe(l,'shoe',[.02,.02,side*1.13]);l.position.y=8.7;for(const c of l.children)c.position.y-=8.7;
  const a=arm(g,side<0?'left-arm':'right-arm',[0,13.12,side*1.86],[.14,10.43,side*2.18],[.28,8.27,side*2.23],color);a.position.y=13.12;for(const c of a.children)c.position.y-=13.12;
 }
 const cargo=rounded(g,'delivery-cargo',[3,9.6,0],[3.8,3.9,4.2],0xc9a872,.18);cargo.visible=false;g.userData.height=PERSON.height;if(!detailed){const remove=[];g.traverse(o=>{if(['finger','thumb','lace','fabric-fold','eye-white','iris','eyebrow','mouth','ear','zipper','pocket-seam','shoulder-seam','hair-part','hair-tuft'].includes(o.name))remove.push(o);});for(const o of remove)o.removeFromParent();}for(const name of ['head','left-arm','right-arm','left-leg','right-leg'])compact(g.getObjectByName(name),name+'-surface');compact(g,'torso',['head','left-arm','right-arm','left-leg','right-leg','delivery-cargo']);contactShadow(g,2.5,2.25);return g;
}
function mountedRider(character='male'){const g=new T.Group();g.name='mounted-rider';g.userData.riderPart=true;
 const upper=new T.Group();upper.position.set(-3,0,0);g.add(upper);torso(upper,0x6b8b77,2.6,character);makeHead(upper,[2.66,15.54,0],true,character);pantsHip(g,[-2.7,9.37,0]);
 for(const side of [-1,1]){const key=side<0?'left':'right',grip=RIDER_CONTACTS[`${key}Grip`],foot=RIDER_CONTACTS[`${key}Foot`];arm(g,`${key}-arm`,[-.48,13.04,side*1.87],[2.32,11.12,side*2.9],grip,0x6b8b77,true);leg(g,`${key}-leg`,[-3,9.32,side*1.25],[.8,6.38,side*2.15],[.12,3.56,side*2.3]);makeShoe(g,`${key}-shoe`,[foot[0]-.32,foot[1],foot[2]]);anchor(g,`${key}-hand-contact`,grip);anchor(g,`${key}-sole-contact`,foot);}
 anchor(g,'seat-contact',RIDER_CONTACTS.seat);compact(g,'rider-surface');return g;
}
function wheel(g,name,x,r,width){const group=new T.Group();group.name=name;group.position.set(x,r,0);g.add(group);
 mesh(group,new T.TorusGeometry(r-.48,.48,10,24),0x20292a,'tire');for(const side of [-1,1]){const ring=mesh(group,new T.TorusGeometry(r-.87,.14,6,20),trim,'rim','metal');ring.position.z=side*width*.36;for(let i=0;i<5;i++){const a=i/5*Math.PI*2;segment(group,'spoke',[0,0,side*.3],[Math.cos(a)*(r-.95),Math.sin(a)*(r-.95),side*width*.35],.105,.13,0x95aaa7,'metal');}}
 const hub=mesh(group,new T.CylinderGeometry(.4,.4,width*.78,12),trim,'hub','metal');hub.rotation.x=Math.PI/2;return group;}
export function createScooter(character='male'){const g=new T.Group();g.name='player-scooter';const paint=0xc4d4bd,dark=0x1f3e3c;
 wheel(g,'rear-wheel',-6.8,2.7,1.25);wheel(g,'front-wheel',7.15,2.7,1.25);
 mesh(g,loft([{x:-9.7,y:5.7,z:0,ry:.45,rz:.4},{x:-8.7,y:5.8,z:0,ry:1.42,rz:2.1},{x:-6.5,y:5.6,z:0,ry:2.06,rz:3.25},{x:-3.4,y:5.24,z:0,ry:2.27,rz:3.25},{x:-.8,y:4.65,z:0,ry:1.17,rz:2.45}], 'x',24),paint,'rear-fairing','paint');
 mesh(g,loft([{x:5.25,y:2.8,z:0,rx:.55,rz:2.45},{x:6.05,y:4.5,z:0,rx:1.08,rz:3.26},{x:6.65,y:7.0,z:0,rx:1.04,rz:3.0},{x:6.16,y:8.95,z:0,rx:.77,rz:2.25},{x:5.52,y:10.15,z:0,rx:.6,rz:1.08}], 'y',24),paint,'front-leg-shield','paint');
 mesh(g,loft([{x:-2.1,y:2.79,z:0,ry:.2,rz:2.4},{x:-.6,y:2.72,z:0,ry:.27,rz:3.4},{x:3.9,y:2.76,z:0,ry:.27,rz:3.35},{x:5.1,y:3.08,z:0,ry:.18,rz:2.6}], 'x',20),dark,'step-through-floor');
 for(const side of [-1,1])for(let i=0;i<4;i++)curve(g,'floor-grip',[[-.8+i*.78,3.0,side*1.55],[-.8+i*.78,3.0,side*2.8]],.043,0x738a79);
 mesh(g,loft([{x:-8.35,y:7.85,z:0,ry:.2,rz:1.4},{x:-7.3,y:8.05,z:0,ry:.57,rz:2.6},{x:-3.25,y:8.14,z:0,ry:.42,rz:2.7},{x:-.77,y:7.73,z:0,ry:.35,rz:1.78}], 'x',24),0x413e34,'saddle');
 for(const side of [-1,1]){curve(g,'saddle-piping',[[-8,8.1,side*1.65],[-6.7,8.36,side*2.36],[-3,8.36,side*2.4],[-1,7.98,side*1.65]],.045,0xb9ad89);curve(g,'side-panel-seam',[[-8.45,6.42,side*1.99],[-6.4,6.75,side*3.11],[-3.5,6.45,side*3.17],[-1.5,5.43,side*2.64]],.04,0x6b877a);segment(g,'rear-shock',[-7.45,2.85,side*.75],[-5.5,6.56,side*1.18],.15,.18,0xa9b2a5,'metal');for(let j=0;j<7;j++){const coil=mesh(g,new T.TorusGeometry(.29,.055,5,10),0x324849,'shock-coil','metal');coil.position.set(-7.4+j*.23,3.1+j*.44,side*1.17);coil.rotation.z=-.47;}}
 const fender=mesh(g,new T.TorusGeometry(2.84,.07,8,24,Math.PI*.85),paint,'front-fender','paint');fender.position.set(7.15,2.7,0);fender.rotation.z=Math.PI*.075;fender.scale.z=10;
 for(const z of [-.7,.7])segment(g,'front-fork',[7.15,2.7,z],[5.75,8.6,z],.16,.22,trim,'metal');
 segment(g,'steering-column',[5.7,8.8,0],[5.4,11.4,0],.3,.36,dark);rounded(g,'handlebar-cowl',[5.4,11.4,0],[2.5,1.65,3.9],paint,.35,'paint');
 segment(g,'handlebar',[5.7,11.25,-4.1],[5.7,11.25,4.1],.2,.2,dark);
 for(const side of [-1,1]){segment(g,'rubber-grip',[5.7,11.25,side*3.05],[5.7,11.25,side*4.15],.27,.27,0x233735);curve(g,'brake-lever',[[6.15,11.35,side*2.9],[6.3,11.38,side*3.5],[6.2,11.27,side*4.05]],.065,trim,'metal');curve(g,'mirror-stem',[[5.32,12.0,side*1.8],[4.95,13.24,side*3.12],[4.65,14.4,side*3.9]],.075,0x81968f,'metal');ell(g,'mirror',[4.65,14.48,side*3.6],[.66,.4,.65],0x879e9d,'glass');anchor(g,side<0?'left-grip-contact':'right-grip-contact',RIDER_CONTACTS[side<0?'leftGrip':'rightGrip']);}
 rounded(g,'headlight',[6.72,11.43,0],[.25,.99,2.22],0xeee8c9,.18,'glass');rounded(g,'instrument-panel',[4.2,11.92,0],[.29,.65,1.45],0x203b40,.09,'glass');
 for(const side of [-1,1]){ell(g,'indicator',[6.32,9.2,side*2.19],[.27,.29,.52],0xc59440,'glass');ell(g,'rear-indicator',[-9.02,5.78,side*1.35],[.2,.25,.45],0xc59440,'glass');}
 rounded(g,'tail-light',[-9.6,6.23,0],[.27,.61,1.63],0xa7352c,.09,'glass');rounded(g,'license-plate',[-9.6,4.85,0],[.18,.98,1.82],0xe8e4ce,.045);curve(g,'exhaust',[[-8.2,3.2,-2.11],[-5.62,3.04,-2.48],[-2.8,3.1,-2.46]],.31,0x697c77,'metal');
 for(const [key,p]of Object.entries(RIDER_CONTACTS))anchor(g,`${key}-vehicle-anchor`,p);
 const cargo=rounded(g,'delivery-cargo',[-7.8,10.3,0],[3.5,3.5,4.1],0xc9a872,.2);cargo.visible=false;g.add(mountedRider(character));g.userData.character=character;g.userData.dimensions={length:SCOOTER.length,width:SCOOTER.width};for(const name of ['front-wheel','rear-wheel'])compact(g.getObjectByName(name),name+'-alloy',['tire'],true);compact(g,'scooter-surface',['front-wheel','rear-wheel','mounted-rider','delivery-cargo'],true);contactShadow(g,9.8,3.4);return g;
}
export function setMountedRiderVisible(scooter,visible){const rider=scooter.getObjectByName('mounted-rider');if(rider)rider.visible=visible;}
// Merge opaque colors for NPCs and traffic shells so detail does not multiply draw calls.
export function bakeColorMeshes(group,name='baked-model',kind='cloth',local=false,exclude=[],predicate=()=>true){
 group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),positions=[],normals=[],colors=[];group.traverse(o=>{if(!o.isMesh||!o.visible||o.material.transparent||o.name==='delivery-cargo'||!predicate(o))return;for(let a=o;a&&a!==group;a=a.parent)if(exclude.includes(a))return;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);if(local)geo.applyMatrix4(inverse);const p=geo.attributes.position.array,n=geo.attributes.normal.array,c=o.material.color,sourceColors=o.material.vertexColors?geo.attributes.color:null;positions.push(...p);normals.push(...n);for(let i=0;i<p.length/3;i++)colors.push(c.r*(sourceColors?sourceColors.getX(i):1),c.g*(sourceColors?sourceColors.getY(i):1),c.b*(sourceColors?sourceColors.getZ(i):1));geo.dispose();});const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));const out=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:kind==='paint'?.4:kind==='metal'?.28:kind==='glass'?.19:.85,metalness:kind==='metal'?.72:kind==='paint'?.18:0}));out.name=name;return out;
}
function compact(group,name,keepNames=[],vehicle=false){
 const kept=group.children.filter(c=>keepNames.includes(c.name)||(!c.isMesh&&c.children.length===0)),parts=[];group.traverse(o=>{if(o.name)parts.push(o.name);parts.push(...(o.userData.parts||[]));});group.userData.parts=[...new Set(parts)];
 const category=o=>o.material.metalness>.5?'metal':o.material.roughness<.25?'glass':o.material.roughness<.65?'paint':'cloth';
 const baked=(vehicle?['cloth','paint','metal','glass']:['cloth']).map(kind=>bakeColorMeshes(group,name+(vehicle?'-'+kind:''),kind,true,kept,vehicle?o=>category(o)===kind:()=>true)).filter(m=>m.geometry.attributes.position.count);
 for(const c of [...group.children])if(!kept.includes(c))group.remove(c);group.add(...baked);return group;
}
const pedestrians=new Map();export function createPedestrian(color=0x8f9b79,detailed=false){const key=`${color}:${detailed}`;if(!pedestrians.has(key))pedestrians.set(key,bakeColorMeshes(createWalker(color,detailed),'street-resident'));const original=pedestrians.get(key),p=new T.Mesh(original.geometry,original.material);p.name=original.name;return p;}
export function createCar(car={color:0xbdc5b5}){const g=new T.Group();g.name='traffic-car';const paint=car.color;
 mesh(g,loft([{x:-21.7,y:5.4,z:0,ry:.72,rz:5.9},{x:-20,y:5.75,z:0,ry:1.75,rz:8.45},{x:-15.5,y:5.94,z:0,ry:2.65,rz:8.9},{x:4,y:5.91,z:0,ry:2.46,rz:8.93},{x:17.8,y:5.65,z:0,ry:2.12,rz:8.58},{x:21.8,y:5.17,z:0,ry:1.1,rz:6.9}].map(r=>({...r,power:.3})), 'x',24),paint,'car-body','paint');
 const cabin=(points,color,name)=>{const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));geo.setIndex(points.every(p=>p[2]>0)?[0,2,1,0,3,2]:[0,1,2,0,2,3]);geo.computeVertexNormals();const m=mesh(g,geo,color,name,color===paint?'paint':'glass');m.material=m.material.clone();m.material.side=T.DoubleSide;return m;};
 const roofRear=[-7.5,14.1],roofFront=[3.8,14.1],rearBase=[-13,8],frontBase=[11,8];
 cabin([[-7.5,14.1,-6.5],[-7.5,14.1,6.5],[3.8,14.1,6.5],[3.8,14.1,-6.5]],paint,'car-roof');
 cabin([[3.8,14.1,-6.5],[3.8,14.1,6.5],[11,8,7.5],[11,8,-7.5]],paint,'front-window-frame');
 cabin([[-13,8,-7.5],[-13,8,7.5],[-7.5,14.1,6.5],[-7.5,14.1,-6.5]],paint,'rear-window-frame');
 cabin([[4.23,13.78,-6.06],[4.23,13.78,6.06],[10.54,8.51,6.97],[10.54,8.51,-6.97]],0x38545b,'windscreen');
 cabin([[-12.53,8.56,-6.97],[-12.53,8.56,6.97],[-7.84,13.77,6.06],[-7.84,13.77,-6.06]],0x38545b,'rear-windscreen');
 const sideZ=y=>7.5-(y-8)/6.1;
 for(const side of [-1,1]){
  cabin([[-13,8,side*7.5],[-7.5,14.1,side*6.5],[3.8,14.1,side*6.5],[11,8,side*7.5]],paint,'cabin-side-frame');
  const sideGlass=points=>points.map(([x,y])=>[x,y,side*(sideZ(y)+.025)]);
  cabin(sideGlass([[-11.85,8.73],[-7.2,13.46],[-2.25,13.46],[-2.25,8.73]]),0x38545b,'rear-side-window');
  cabin(sideGlass([[-1.47,8.73],[-1.47,13.46],[3.26,13.46],[9.74,8.73]]),0x38545b,'front-side-window');
  curve(g,'window-sill',[[-12.5,8.35,side*7.51],[-2,8.35,side*7.51],[10.5,8.35,side*7.51]],.075,trim,'metal');
  const carBody=g.getObjectByName('car-body');carBody.updateMatrixWorld(true);const points=[];for(let y=4.2;y<=8.01;y+=.38){const ray=new T.Raycaster(new T.Vector3(-1.7,y,side*20),new T.Vector3(0,0,-side)),hit=ray.intersectObject(carBody)[0];if(hit)points.push([hit.point.x,hit.point.y,hit.point.z+side*.018]);}if(points.length>2)curve(g,'door-seam',points,.023,0x536b69);
  for(const x of [-8,2.5])rounded(g,'door-handle',[x,7.7,side*8.64],[1.5,.23,.18],trim,.055,'metal');ell(g,'car-mirror',[7.2,9.5,side*9.5],[1.34,.58,.9],paint,'paint');
 }
 rounded(g,'front-grille',[21.87,4.73,0],[.21,1.52,8.3],0x273b3b,.06);rounded(g,'front-license',[21.85,4.34,0],[.2,.95,3.25],0xe9e6d6,.06);rounded(g,'rear-license',[-21.85,5.17,0],[.2,.95,3.25],0xe9e6d6,.06);
 for(const z of [-5.8,5.8]){rounded(g,'car-headlight',[21.16,6.46,z],[.68,.8,3.0],0xe3e4c8,.14,'glass');rounded(g,'car-tail-light',[-21.05,6.42,z],[.61,.87,3.17],0xab483c,.12,'glass');}
 compact(g,'car-shell',[],true);
 for(const x of [-13.2,13.6])for(const side of [-1,1]){const w=new T.Group();w.position.set(x,3.15,side*8.1);w.name='car-wheel';const tire=mesh(w,new T.TorusGeometry(2.48,.68,8,20),0x202b2e,'tire');tire.scale.z=1.5;const disc=mesh(w,new T.CylinderGeometry(1.93,1.93,.35,16),0x93a6a4,'wheel-alloy','metal');disc.rotation.x=Math.PI/2;disc.position.z=side*.67;for(let i=0;i<5;i++){const a=i*Math.PI*2/5;segment(w,'wheel-spoke',[0,0,side*.89],[Math.cos(a)*1.7,Math.sin(a)*1.7,side*.89],.14,.27,0xd4ddcc,'metal');}const baked=bakeColorMeshes(w,'car-wheel','paint');g.add(baked);}
 g.userData.dimensions={...CAR};contactShadow(g,21.8,9.4);return g;}

export const APPEARANCES=Object.freeze({forest:0x6b8b77,river:0x536e98,sunset:0xb97545});
export function applyCharacterPalette(root,id='forest'){
 const color=new T.Color(APPEARANCES[id]??APPEARANCES.forest),original=new T.Color(APPEARANCES.forest);
 root.traverse(o=>{const attr=o.geometry?.attributes.color;if(!attr)return;let indices=o.geometry.userData.outfitIndices;if(!indices){indices=[];for(let i=0;i<attr.count;i++)if(Math.abs(attr.getX(i)-original.r)<1e-5&&Math.abs(attr.getY(i)-original.g)<1e-5&&Math.abs(attr.getZ(i)-original.b)<1e-5)indices.push(i);o.geometry.userData.outfitIndices=indices;}for(const i of indices)attr.setXYZ(i,color.r,color.g,color.b);if(indices.length)attr.needsUpdate=true;});
}
