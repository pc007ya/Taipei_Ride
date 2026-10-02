import * as T from '../vendor/three.module.js';
import {createScooter, RIDER_CONTACTS} from './models.js';

// Opt-in art sample. Original sculpted clothing and pose on the explicitly CC0
// MakeHuman hm08 anatomical base; source/provenance stays beside the generated data.
let assetPromise;
export function loadSampleCharacters(){return assetPromise??=Promise.all(['walker','rider'].map(async name=>{const response=await fetch(new URL(`../public/sample/${name}.json`,import.meta.url));if(!response.ok)throw new Error(`Sample ${name}: ${response.status}`);return response.json();})).then(([walker,rider])=>({walker,rider}));}
const textureCache=new Map();
function surface(kind){
 if(textureCache.has(kind))return textureCache.get(kind);
 const n=128,color=new Uint8Array(n*n*4),height=new Uint8Array(n*n*4),rough=new Uint8Array(n*n*4);
 const hash=(x,y)=>{let h=Math.imul(x+31,374761393)^Math.imul(y+17,668265263);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const random=hash(x,y),weave=kind==='denim'?Math.sin((x+y)*Math.PI*.5):Math.sin(x*Math.PI)*.5+Math.cos(y*Math.PI)*.5;
  let detail=kind==='leather'?random*.14:kind==='paint'?random*.022:(random-.5)*.08+weave*.035;
  if(kind==='hair')detail=.05*Math.sin(x*.73)+.03*Math.sin(x*2.7)+random*.04;
  const c=Math.round(255*(.92+detail)),h=Math.round(128+detail*(kind==='skin'?120:500)),r=Math.round(255*(kind==='paint'?.22:kind==='leather'?.74:kind==='skin'?.58:.86));
  const i=(y*n+x)*4;for(let k=0;k<3;k++){color[i+k]=c;height[i+k]=h;rough[i+k]=r;}color[i+3]=height[i+3]=rough[i+3]=255;
 }
 const tex=(data,srgb=false)=>{const t=new T.DataTexture(data,n,n,T.RGBAFormat);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;if(srgb)t.colorSpace=T.SRGBColorSpace;t.needsUpdate=true;return t;};
 const result={map:tex(color,true),bumpMap:tex(height),roughnessMap:tex(rough)};const repeat=kind==='skin'?9:kind==='hair'?3:kind==='paint'?6:34;for(const t of Object.values(result))t.repeat.set(repeat,repeat);textureCache.set(kind,result);return result;
}
function fabric(color,kind){const maps=surface(kind);return new T.MeshStandardMaterial({color,...maps,roughness:1,bumpScale:kind==='skin'?.018:kind==='hair'?.035:.035,metalness:0});}
function geometry(data){const g=new T.BufferGeometry();for(const [key,source,size]of [['position','positions',3],['normal','normals',3],['uv','uv',2],['skinWeight','skinWeights',4]])g.setAttribute(key,new T.Float32BufferAttribute(data[source],size));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(data.skinIndices,4));g.setIndex(data.indices);g.computeBoundingBox();g.computeBoundingSphere();return g;}
function addMesh(parent,geo,mat,name,p){const m=new T.Mesh(geo,mat);m.name=name;if(p)m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function sphere(parent,name,p,size,mat){const m=addMesh(parent,new T.SphereGeometry(1,24,16),mat,name,p);m.scale.set(...size);return m;}
function shoe(parent,p){const group=new T.Group();group.name='sample-sneaker';group.position.set(...p);parent.add(group);const rubber=new T.MeshStandardMaterial({color:0xd3d0c3,roughness:.92}),upper=fabric(0x3c4b4c,'cloth');sphere(group,'sole',[.36,.13,0],[1.3,.15,.53],rubber);sphere(group,'shoe-upper',[.28,.40,0],[1.21,.35,.49],upper);sphere(group,'heel-tab',[-.53,.54,0],[.35,.33,.37],upper);const laceMat=new T.MeshStandardMaterial({color:0xb6b5a8,roughness:.9});for(let i=0;i<4;i++){const l=addMesh(group,new T.CylinderGeometry(.018,.018,.63,6),laceMat,'laces',[.01+i*.2,.748-i*.045,0]);l.rotation.x=Math.PI/2;l.rotation.y=(i%2?1:-1)*.15;}return group;}
function helmet(group,head){const paint=new T.MeshPhysicalMaterial({color:0xdad3ba,roughness:.29,metalness:.04,clearcoat:1,clearcoatRoughness:.13}),inside=new T.MeshStandardMaterial({color:0x302d29,roughness:.96});const p=[],ix=[];
 for(let j=0;j<=18;j++)for(let i=0;i<=36;i++){const a=i/36*Math.PI*2,limit=1.25+.71*(1-Math.cos(a))/2,t=j/18*limit;p.push(Math.sin(t)*Math.cos(a)*1.28,Math.cos(t)*1.11,Math.sin(t)*Math.sin(a)*.99);}
 for(let j=0;j<18;j++)for(let i=0;i<36;i++){const a=j*37+i,b=a+37;ix.push(a,a+1,b,a+1,b+1,b);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(ix);geo.computeVertexNormals();const m=addMesh(group,geo,paint,'ceramic-open-helmet',[head[0]+.16,15.64+(head[1]-15.64),head[2]]);m.material.side=T.DoubleSide;for(const side of [-1,1]){sphere(group,'helmet-lining',[head[0]-.31,head[1]-.29,side*.77],[.41,.36,.17],inside);const strap=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(head[0]+.15,head[1]-.32,side*.78),new T.Vector3(head[0]+.61,head[1]-.98,side*.38),new T.Vector3(head[0]+.74,head[1]-1.0,0)]),12,.045,5,false),inside);group.add(strap);}}

export function createSampleCharacter(data,{mounted=false,appearance='sunset'}={}){
 const group=new T.Group();group.name=mounted?'mounted-rider':'walking-player';group.userData.sample=true;group.userData.license='CC0-1.0';group.userData.character=appearance==='river'?'female':'male';
 const bones=data.bones.map(b=>{const bone=new T.Bone();bone.name=b.name;return bone;});
 data.bones.forEach((b,i)=>{const pi=data.bones.findIndex(p=>p.name===b.parent);bones[i].position.fromArray(b.head);if(pi>=0){bones[i].position.sub(new T.Vector3().fromArray(data.bones[pi].head));bones[pi].add(bones[i]);}else group.add(bones[i]);});group.updateMatrixWorld(true);const skeleton=new T.Skeleton(bones);
 const materials={skin:fabric(0xc79373,'skin'),jacket:fabric(appearance==='river'?0x435777:0x9d5636,'cloth'),denim:fabric(0x263e4b,'denim'),hair:fabric(0x241b17,'hair')};
 for(const part of data.meshes){const g=geometry(part),m=new T.SkinnedMesh(g,materials[part.material]);m.name=part.name;m.castShadow=m.receiveShadow=true;group.add(m);m.bind(skeleton);m.normalizeSkinWeights();}
 const eyeWhite=new T.MeshStandardMaterial({color:0xa9a397,roughness:.58}),iris=new T.MeshStandardMaterial({color:0x2a211a,roughness:.4});
 for(const pos of data.eyes){sphere(group,'embedded-eye',pos,[.171,.166,.171],eyeWhite);const i=addMesh(group,new T.CircleGeometry(.079,20),iris,'iris',[pos[0]+.175,pos[1],pos[2]]);i.rotation.y=Math.PI/2;}
 if(mounted){const head=data.joints.head;helmet(group,[head[0]+.08,head[1]+.56,head[2]]);}
 for(const side of [-1,1]){const foot=shoe(group,mounted?[.58,3.06,side*2.3]:[.02,.02,side*1.06]);group.updateMatrixWorld(true);bones.find(b=>b.name===(side<0?'l':'r')+'-foot').attach(foot);}
 group.updateMatrixWorld(true);const headBone=bones.find(b=>b.name==='head');for(const part of [...group.children])if(['embedded-eye','iris','ceramic-open-helmet','helmet-lining'].includes(part.name))headBone.attach(part);
 group.userData.bones=bones;group.userData.restBones=bones.map(b=>({position:b.position.clone(),rotation:b.quaternion.clone()}));group.userData.materials=materials;
 const cargo=addMesh(group,new T.BoxGeometry(3.8,3.9,4.2),fabric(0xc9a872,'cloth'),'delivery-cargo',[3,9.6,0]);cargo.visible=false;
 return group;
}
export function animateSampleWalker(group,time,speed){const strength=Math.min(.34,Math.abs(speed)*.016),bones=group.userData.bones;if(!bones)return;for(const b of bones){const side=b.name.startsWith('l')?0:Math.PI;if(b.name.endsWith('-thigh'))b.rotation.z=Math.sin(time*8.5+side)*strength;if(b.name.endsWith('-shin'))b.rotation.z=Math.max(0,-Math.sin(time*8.5+side))*.6*strength;if(b.name.endsWith('-foot'))b.rotation.z=-Math.sin(time*8.5+side)*strength-Math.max(0,-Math.sin(time*8.5+side))*.6*strength;if(b.name.endsWith('-arm'))b.rotation.z=-Math.sin(time*8.5+side)*strength*.6;}}
export async function createSampleWalker(appearance='sunset'){return createSampleCharacter((await loadSampleCharacters()).walker,{appearance});}

function curvedShell(original,rings,sides=24){
 const p=original.attributes.position,positions=[],indices=[],steps=28;
 const paths=Array.from({length:sides+1},(_,i)=>new T.CatmullRomCurve3(Array.from({length:rings},(_,j)=>new T.Vector3().fromBufferAttribute(p,j*(sides+1)+i))));
 for(let j=0;j<=steps;j++)for(let i=0;i<=sides;i++)positions.push(...paths[i].getPoint(j/steps).toArray());
 const axisY=Math.abs(paths[0].getPoint(0).y-paths[0].getPoint(1).y)>Math.abs(paths[0].getPoint(0).x-paths[0].getPoint(1).x);
 for(let j=0;j<steps;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;indices.push(...(axisY?[a,b,a+1,a+1,b,b+1]:[a,a+1,b,a+1,b+1,b]));}
 for(const end of [0,steps]){const c=new T.Vector3();for(let i=0;i<sides;i++)c.add(new T.Vector3().fromArray(positions,(end*(sides+1)+i)*3));c.divideScalar(sides);const center=positions.length/3;positions.push(...c.toArray());for(let i=0;i<sides;i++){const a=end*(sides+1)+i;indices.push(...((end===0)===!axisY?[center,a+1,a]:[center,a,a+1]));}}
 const uv=[];for(let j=0;j<=steps;j++)for(let i=0;i<=sides;i++)uv.push(i/sides,j/steps);uv.push(.5,.5,.5,.5);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function mergeByMaterial(root){
 const map=new Map();root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert();root.traverse(o=>{if(!o.isMesh||!o.visible||o.name==='delivery-cargo')return;for(let a=o;a&&a!==root;a=a.parent)if(a.name==='mounted-rider')return;const key=o.material;let entry=map.get(key);if(!entry){entry={positions:[],normals:[],uv:[]};map.set(key,entry);}const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(inverse.clone().multiply(o.matrixWorld));entry.positions.push(...g.attributes.position.array);entry.normals.push(...g.attributes.normal.array);const uv=g.attributes.uv;entry.uv.push(...(uv?uv.array:new Float32Array(g.attributes.position.count*2)));g.dispose();});
 const keep=root.children.filter(c=>c.name==='mounted-rider'||c.name==='delivery-cargo'||(!c.isMesh&&c.children.length===0));root.clear();root.add(...keep);for(const [material,d]of map){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(d.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(d.normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(d.uv,2));addMesh(root,g,material,'sample-scooter-surface');}}
export async function createSampleScooter(appearance='sunset'){
 const {rider}=await loadSampleCharacters(),s=createScooter('male',true);s.remove(s.getObjectByName('mounted-rider'));s.getObjectByName('contact-shadow')?.removeFromParent();
 const paint=new T.MeshPhysicalMaterial({color:0x657c72,...surface('paint'),roughness:1,metalness:.27,clearcoat:1,clearcoatRoughness:.11,bumpScale:.008});
 const rubber=fabric(0x171b1c,'leather'),seat=fabric(0x39342b,'leather'),plastic=fabric(0x273a38,'leather'),metal=new T.MeshStandardMaterial({color:0xa4afa9,metalness:.9,roughness:.24}),glass=new T.MeshPhysicalMaterial({color:0xc9dfdf,metalness:.2,roughness:.13,clearcoat:1});
 const remove=[];s.traverse(o=>{if(o.name==='front-leg-shield'||o.name==='rear-fairing')o.geometry=curvedShell(o.geometry,5);if(o.name==='saddle')o.geometry=curvedShell(o.geometry,4);if(!o.isMesh||o.name==='delivery-cargo')return;if(['side-panel-seam','saddle-piping','headlight','handlebar-cowl'].includes(o.name)){remove.push(o);return;}const kind=o.material.metalness>.5?'metal':o.material.roughness<.25?'glass':o.material.roughness<.65?'paint':'plastic';o.material=/tire|rubber-grip/.test(o.name)?rubber:/saddle/.test(o.name)?seat:({metal,glass,paint,plastic}[kind]);o.castShadow=o.receiveShadow=true;});for(const m of remove)m.removeFromParent();
 sphere(s,'curved-handlebar-nacelle',[5.44,11.43,0],[1.38,.79,2.22],paint);sphere(s,'headlamp-lens',[6.72,11.47,0],[.20,.54,1.39],glass);
 // A physically shaded inset seat and broad reflective shells carry the detail;
 // batching keeps the whole vehicle at a handful of material draws.
 mergeByMaterial(s);s.add(createSampleCharacter(rider,{mounted:true,appearance}));s.userData.sample=true;return s;
}
