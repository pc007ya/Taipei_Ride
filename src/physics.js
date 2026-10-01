import { PERSON, SCOOTER, CAR } from './scale.js';

// Convex, centred footprints. Forward is +X for both rendering and physics.
// The 16-sided walking/trunk polygons circumscribe their physical circles.
const EPS = 1e-7, SKIN = .002;
export const PLAY_BOUNDS = Object.freeze({ min:93, max:1515 });
const circle = radius => Array.from({length:16},(_,i)=>{
  const a=(i+.5)*Math.PI/8,r=radius/Math.cos(Math.PI/16);
  return {x:Math.cos(a)*r,y:Math.sin(a)*r};
});
const rectangle = (length,width) => [{x:-length/2,y:-width/2},{x:length/2,y:-width/2},{x:length/2,y:width/2},{x:-length/2,y:width/2}];
const footprints = {walking:circle(PERSON.radius),riding:rectangle(SCOOTER.length,SCOOTER.occupiedWidth),scooter:rectangle(SCOOTER.length,SCOOTER.occupiedWidth),car:rectangle(CAR.length,CAR.mirrorWidth)};
function polygon(vertices,source=null){
 const xs=vertices.map(v=>v.x),ys=vertices.map(v=>v.y);
 return {vertices,minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),source};
}
export function collisionBody(pose,kind='riding'){
 const c=Math.cos(pose.angle||0),s=Math.sin(pose.angle||0);
 return polygon((footprints[kind]||footprints.riding).map(v=>({x:pose.x+v.x*c-v.y*s,y:pose.y+v.x*s+v.y*c})),pose);
}
const obstacleCache=new WeakMap();
export function obstacleBody(o){
 if(obstacleCache.has(o))return obstacleCache.get(o);
 const result=o.radius?polygon(circle(o.radius).map(v=>({x:o.x+v.x,y:o.y+v.y})),o):polygon([{x:o.x,y:o.y},{x:o.x+o.w,y:o.y},{x:o.x+o.w,y:o.y+o.d},{x:o.x,y:o.y+o.d}],o);
 obstacleCache.set(o,result);return result;
}
const bounds=[{x:-10000,y:-10000,w:10093,d:30000},{x:1515,y:-10000,w:10000,d:30000},{x:-10000,y:-10000,w:30000,d:10093},{x:-10000,y:1515,w:30000,d:10000}].map(obstacleBody);
export function fixedBodies(world){return [...(world.obstacles||[]).map(obstacleBody),...bounds];}
const axes=body=>body.vertices.map((v,i)=>{const n=body.vertices[(i+1)%body.vertices.length],dx=n.x-v.x,dy=n.y-v.y,l=Math.hypot(dx,dy);return {x:-dy/l,y:dx/l};});
const project=(body,n)=>{let min=Infinity,max=-Infinity;for(const v of body.vertices){const d=v.x*n.x+v.y*n.y;min=Math.min(min,d);max=Math.max(max,d);}return {min,max};};
function broadOverlap(a,b,dx=0,dy=0){return a.minX+Math.min(0,dx)<b.maxX+EPS&&a.maxX+Math.max(0,dx)>b.minX-EPS&&a.minY+Math.min(0,dy)<b.maxY+EPS&&a.maxY+Math.max(0,dy)>b.minY-EPS;}
export function overlapContact(a,b){
 if(!broadOverlap(a,b))return null;
 let depth=Infinity,normal=null;
 for(const n of [...axes(a),...axes(b)]){
  const pa=project(a,n),pb=project(b,n);
  if(pa.max<=pb.min+EPS||pb.max<=pa.min+EPS)return null;
  const negative=pa.max-pb.min,positive=pb.max-pa.min;
  const d=Math.min(negative,positive);
  if(d<depth){depth=d;normal=negative<positive?{x:-n.x,y:-n.y}:n;}
 }
 return {depth,normal};
}
export function bodiesOverlap(a,b){return !!overlapContact(a,b);}
// Swept separating-axis test uses relative motion: both moving footprints may
// cross within a frame even when their end points do not overlap.
export function sweepCollision(a,b,delta,otherDelta={x:0,y:0}){
 const dx=delta.x-otherDelta.x,dy=delta.y-otherDelta.y;
 if(!broadOverlap(a,b,dx,dy))return null;
 const penetration=overlapContact(a,b);if(penetration)return {time:0,normal:penetration.normal,overlap:true};
 let entry=-Infinity,exit=Infinity,normal=null;
 for(const n of [...axes(a),...axes(b)]){
  const pa=project(a,n),pb=project(b,n),v=dx*n.x+dy*n.y;
  if(Math.abs(v)<EPS){if(pa.max<=pb.min+EPS||pb.max<=pa.min+EPS)return null;continue;}
  const t1=(pb.min-pa.max)/v,t2=(pb.max-pa.min)/v,near=Math.min(t1,t2),far=Math.max(t1,t2);
  if(near>entry){entry=near;normal=v>0?{x:-n.x,y:-n.y}:n;}
  exit=Math.min(exit,far);if(entry>exit+EPS)return null;
 }
 if(entry< -EPS||entry>1+EPS||exit<0||!normal)return null;
 return {time:Math.max(0,entry),normal};
}
export function poseCollides(pose,kind,world,blockers=[]){
 const body=collisionBody(pose,kind);
 return [...fixedBodies(world),...blockers].some(b=>bodiesOverlap(body,b));
}
function hull(points){
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
 const lower=[],upper=[];
 for(const p of sorted){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
 for(const p of sorted.reverse()){while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
 return polygon(lower.slice(0,-1).concat(upper.slice(0,-1)));
}
export function rotateSafely(pose,kind,angle,solids){
 if(Math.abs(angle-pose.angle)<EPS)return true;
 // Small angular substeps plus the convex hull of both poses prevent a long
 // vehicle's corners rotating through a wall, even if the final pose is clear.
 const steps=Math.max(1,Math.ceil(Math.abs(angle-pose.angle)/.02)),start=pose.angle;
 for(let i=1;i<=steps;i++){
  const next=start+(angle-start)*i/steps,body=hull([...collisionBody(pose,kind).vertices,...collisionBody({...pose,angle:next},kind).vertices]);
  if(solids.some(b=>bodiesOverlap(body,b)))return false;
  pose.angle=next;
 }
 return true;
}
export function moveBody(pose,kind,delta,solids,{slide=true}={}){
 const before={x:pose.x,y:pose.y};let remaining={...delta},hit=false,vehicleHit=false,fixedHit=false;
 for(let pass=0;pass<4&&Math.hypot(remaining.x,remaining.y)>EPS;pass++){
  const body=collisionBody(pose,kind);let first=null;
  for(const solid of solids){const contact=sweepCollision(body,solid,remaining);if(contact&&(!first||contact.time<first.time))first={...contact,solid};}
  if(!first){pose.x+=remaining.x;pose.y+=remaining.y;break;}
  hit=true;const dynamic=['car','scooter','player'].includes(first.solid.source?.collisionType);vehicleHit ||=dynamic;fixedHit ||=!dynamic;
  const length=Math.hypot(remaining.x,remaining.y),travel=Math.max(0,first.time-SKIN/length);
  pose.x+=remaining.x*travel;pose.y+=remaining.y*travel;
  if(!slide)break;
  remaining.x*=1-travel;remaining.y*=1-travel;
  const into=remaining.x*first.normal.x+remaining.y*first.normal.y;
  if(into<0){remaining.x-=into*first.normal.x;remaining.y-=into*first.normal.y;}else break;
 }
 return {hit,vehicleHit,fixedHit,x:pose.x-before.x,y:pose.y-before.y,distance:Math.hypot(pose.x-before.x,pose.y-before.y)};
}
export function recoverPose(pose,kind,world,blockers=[]){
 const solids=[...fixedBodies(world),...blockers],isClear=p=>!solids.some(b=>bodiesOverlap(collisionBody(p,kind),b));
 if(isClear(pose))return true;
 const original={x:pose.x,y:pose.y};
 for(let i=0;i<12;i++){
  let deepest=null;const body=collisionBody(pose,kind);
  for(const solid of solids){const c=overlapContact(body,solid);if(c&&(!deepest||c.depth>deepest.depth))deepest=c;}
  if(!deepest){pose.speed=0;return true;}
  pose.x+=deepest.normal.x*(deepest.depth+SKIN);pose.y+=deepest.normal.y*(deepest.depth+SKIN);
 }
 // Corrupt/restored placements may be wedged between multiple solids. Search
 // locally for a fully valid pose rather than leave an overlap or push a wall.
 for(let r=2;r<=80;r+=2)for(let i=0;i<32;i++){
  const a=i*Math.PI/16,candidate={...pose,x:original.x+Math.cos(a)*r,y:original.y+Math.sin(a)*r};
  if(isClear(candidate)){Object.assign(pose,{x:candidate.x,y:candidate.y,speed:0});return true;}
 }
 Object.assign(pose,original);return false;
}
