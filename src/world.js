import { PERSON, SCOOTER, CAR, BUILDING, toMetres } from './scale.js';
import { collisionBody, obstacleBody, fixedBodies, bodiesOverlap, sweepCollision, poseCollides, rotateSafely, moveBody, recoverPose } from './physics.js';
export { WORLD_SCALE, PERSON, SCOOTER, CAR, BUILDING, toMetres, toKmh } from './scale.js';
export { collisionBody, bodiesOverlap, poseCollides } from './physics.js';
export const WORLD_SIZE = 1600;
export const ROAD_WIDTH = 70;
export const TRAFFIC_LANE_OFFSET = ROAD_WIDTH / 4;
export const ROADS = [160, 480, 800, 1120, 1440];
export const START = { x: 800, y: 515, angle: -Math.PI / 2 };
export const LANDMARKS = [
  { id:'market', name:'巷口夜市', en:'NIGHT MARKET', x:800, y:410, bx:635, by:285, type:'market', color:'#ffab6e', stamp:'味', clue:'讓一份熱騰騰的街邊小吃，開啟今天的漫遊。', fact:'騎樓、霓虹與小吃攤，把城市的日常變成風景。' },
  { id:'tower', name:'台北 101', en:'SKYLINE STOP', x:1120, y:650, bx:1238, by:630, type:'tower', color:'#90dcca', stamp:'高', clue:'沿著東側大道，尋找層層向上的青綠色天際線。', fact:'竹節般的輪廓，是這座台北地標給人的鮮明印象。' },
  { id:'hill', name:'象山綠意', en:'GREEN ESCAPE', x:1440, y:1200, bx:1330, by:1280, type:'hill', color:'#a8dc77', stamp:'山', clue:'往東南的綠意慢行，停下來看看城市的另一面。', fact:'在山與城相遇的地方，放慢速度就有新的視角。' },
  { id:'hall', name:'自由廣場', en:'OPEN HORIZONS', x:970, y:1120, bx:970, by:945, type:'hall', color:'#a9c7ff', stamp:'廣', clue:'寬廣的廣場、白色牆面與藍色屋頂就在南邊。', fact:'留一點空白給散步，也留一點時間給自己。' },
  { id:'temple', name:'龍山寺街區', en:'TEMPLE CORNER', x:160, y:1050, bx:315, by:1030, type:'temple', color:'#ff9e8c', stamp:'祈', clue:'向西穿過老街，在紅瓦屋簷前完成一站。', fact:'廟宇與街巷相依，讓老城的故事繼續流動。' },
  { id:'river', name:'大稻埕河岸', en:'RIVERSIDE', x:160, y:260, bx:67, by:250, type:'river', color:'#8eddea', stamp:'河', clue:'到西北側的河岸，收集最後一抹水光。', fact:'沿著河風騎一段，把忙碌暫時留在身後。' }
];
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export function seeded(seed=731) { let n=seed; return () => { n=(Math.imul(n,1664525)+1013904223)>>>0; return n/4294967296; }; }
export function isRoad(x,y) { return ROADS.some(c=>Math.abs(x-c)<ROAD_WIDTH/2 || Math.abs(y-c)<ROAD_WIDTH/2); }
export function createWorld() {
  const rng=seeded(); const buildings=[], trees=[], stalls=[], lamps=[], obstacles=[];
  const palette=['#b1c8c8','#c7bcab','#d1baa8','#a3b4b2','#bcb8c6','#9fbdc8','#d2c8b2'];
  for(let ix=0;ix<4;ix++) for(let iy=0;iy<4;iy++) {
    const x=ROADS[ix]+55, y=ROADS[iy]+55;
    // Landmark blocks are custom-built; leave them out of the procedural streets.
    if((ix===1&&iy===0)||(ix===3&&iy===1)||(ix===3&&iy===3)||(ix===2&&iy===2)||(ix===0&&iy===2)) continue;
    for(let a=0;a<3;a++) for(let b=0;b<3;b++) {
      const w=48+rng()*12,d=48+rng()*12;
      const obj={type:'building',x:x+a*71,y:y+b*71,w,d,h:28+rng()*55,color:palette[Math.floor(rng()*palette.length)],seed:rng(),sign:rng()>.56?['茶','麵','早餐','書店','咖啡','便利商店'][Math.floor(rng()*6)]:''};
      obj.floorCount=clamp(Math.floor(obj.h/13),2,6);obj.h=BUILDING.groundFloorHeight+(obj.floorCount-1)*BUILDING.upperFloorHeight;obj.height=obj.h;
      buildings.push(obj); obstacles.push({type:'building',x:obj.x,y:obj.y,w,d,height:obj.h});
    }
  }
  // Original landmark geometry with a deliberately fictional street arrangement.
  buildings.push({type:'tower',x:1200,y:590,w:82,d:82,h:302,height:302,floorCount:10,color:'#7bb9ad'});
  obstacles.push({type:'building',x:1200,y:590,w:82,d:82,height:302});
  buildings.push({type:'hall',x:915,y:900,w:105,d:92,h:62,height:62,floorCount:2,color:'#ece8d7'});
  obstacles.push({type:'building',x:915,y:900,w:105,d:92,height:62});
  buildings.push({type:'temple',x:260,y:975,w:118,d:92,h:62,height:62,floorCount:2,color:'#c55443'});
  obstacles.push({type:'building',x:260,y:975,w:118,d:92,height:62});
  for(let i=0;i<7;i++) {
    const x=554+i%4*50,y=248+Math.floor(i/4)*89;
    stalls.push({type:'stall',x,y,w:35,d:26,h:23,color:['#ee815f','#edb747','#73b8a2','#b89cc7'][i%4],sign:['茶','鹽酥雞','麵','豆花','飯','甜','果'][i]});
    obstacles.push({type:'stall',x,y,w:35,d:26,height:23});
  }
  for(let i=0;i<125;i++) {
    const c=ROADS[Math.floor(rng()*5)],t=100+rng()*1380;
    const x=i%2?c+49:t,y=i%2?t:c+49;
    if(isRoad(x,y)) continue;
    if(buildings.some(b=>x>b.x-8&&x<b.x+b.w+8&&y>b.y-8&&y<b.y+b.d+8)) continue;
    trees.push({type:'tree',x,y,h:35+rng()*20,color:i%3?'#54846b':'#6b9a73'});
  }
  for(let i=0;i<30;i++) trees.push({type:'tree',x:1215+rng()*170,y:1190+rng()*190,h:35+rng()*20,color:['#416d58','#629267','#4b805e'][i%3]});
  for(const tree of trees){tree.height=tree.h;tree.trunkRadius=1.2+rng()*.6;obstacles.push({type:'tree',x:tree.x,y:tree.y,radius:tree.trunkRadius,height:tree.h});}
  for(const road of ROADS)for(let t=270;t<1450;t+=210){
    const x=road+40,y=t;
    if(ROADS.some(c=>Math.abs(y-c)<ROAD_WIDTH/2+3)||buildings.some(b=>x>b.x-3&&x<b.x+b.w+3&&y>b.y-3&&y<b.y+b.d+3)||trees.some(tree=>Math.hypot(tree.x-x,tree.y-y)<5))continue;
    lamps.push({type:'lamp',x,y,height:48,h:48,radius:1.3,poleRadius:.45});obstacles.push({type:'lamp',x,y,radius:1.3,height:48});
  }
  return { buildings, trees, stalls, lamps, obstacles };
}
// Legacy point query remains available to map/mission code. Physical movement
// uses the shared oriented footprints below, never a centre-distance shortcut.
export function collides(x,y,obstacles,radius=PERSON.radius) {
 const probe=obstacleBody({x,y,radius});
 if(!Number.isFinite(x)||!Number.isFinite(y)||x-radius<93||x+radius>1515||y-radius<93||y+radius>1515)return true;
 return obstacles.some(o=>bodiesOverlap(probe,obstacleBody(o)));
}
export function createPlayer() { return {...START,speed:0,distance:0,collisionCooldown:0}; }
export function nearbyLandmark(p,landmarks=LANDMARKS) { return landmarks.find(l=>distance(p,l)<45) || null; }
export function canCollect(p,l) { return !!l&&distance(p,l)<45&&Math.abs(p.speed)<8; }
export function cleanProgress(data,landmarks=LANDMARKS) {
  if(!data||typeof data!=='object') return { stamps:[],distance:0,night:false };
  return {stamps:Array.isArray(data.stamps)?[...new Set(data.stamps.filter(id=>landmarks.some(l=>l.id===id)))]:[],distance:typeof data.distance==='number'&&Number.isFinite(data.distance)?clamp(data.distance,0,1e9):0,night:data.night===true};
}
export function syncVehicle(player,vehicle){Object.assign(vehicle,{x:player.x,y:player.y,angle:player.angle,speed:player.speed});}
const finite=(n,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
const safeDt=dt=>clamp(finite(dt),0,.04);
const dynamicBody=(pose,kind,type)=>{const body=collisionBody(pose,kind);body.source={collisionType:type,pose};return body;};
function controlActor(p,input,dt,mode,world,solids){
 p.speed=finite(p.speed);p.angle=finite(p.angle,START.angle);p.distance=finite(p.distance);p.collisionCooldown=Math.max(0,finite(p.collisionCooldown)-dt);
 const steering=(input.right?1:0)-(input.left?1:0),forward=(input.throttle?1:0)-(input.reverse?1:0);
 let turn;
 if(mode==='walking'){
  const desired=input.brake?0:forward*(forward<0?PERSON.reverseSpeed:PERSON.walkSpeed);
  p.speed+=(desired-p.speed)*Math.min(1,dt*12);if(Math.abs(p.speed)<.15)p.speed=0;
  turn=steering*2.8*dt;
 }else{
  if(input.brake)p.speed*=Math.exp(-8*dt);else if(forward)p.speed+=forward*48*dt;else p.speed*=Math.exp(-1.6*dt);
  p.speed=clamp(p.speed,-SCOOTER.reverseSpeed,SCOOTER.maxSpeed*(isRoad(p.x,p.y)?1:.65));if(Math.abs(p.speed)<.2)p.speed=0;
  turn=steering*2.15*dt*Math.min(1,Math.abs(p.speed)/24)*Math.sign(p.speed);
 }
 rotateSafely(p,mode,p.angle+turn,solids);
 return {x:Math.cos(p.angle)*p.speed*dt,y:Math.sin(p.angle)*p.speed*dt};
}
function moveActor(p,input,dt,mode,world,blockers=[]){
 const solids=[...fixedBodies(world),...blockers],desired=controlActor(p,input,dt,mode,world,solids);
 const result=moveBody(p,mode,desired,solids);
 // Head-on contact cancels propulsion. On an oblique contact the sweep removes
 // normal displacement while retaining the tangent, so holding throttle slides.
 if(result.hit&&result.distance<Math.hypot(desired.x,desired.y)*.02)p.speed=0;
 if(Math.abs(p.speed)<.2)p.speed=0;
 p.distance+=result.distance;return result;
}
export function updatePlayer(p,input,dt,world,traffic=[]){
 const blockers=traffic.map(c=>dynamicBody(c,'car','car'));recoverPose(p,'riding',world,blockers);
 const steps=Math.max(1,Math.ceil(safeDt(dt)*120)),step=safeDt(dt)/steps;let hit=false;
 for(let i=0;i<steps;i++)hit=moveActor(p,input,step,'riding',world,blockers).hit||hit;return hit;
}
export function updateWalker(p,input,dt,world,vehicle=null,traffic=[]){
 const blockers=traffic.map(c=>dynamicBody(c,'car','car'));if(vehicle)blockers.push(dynamicBody(vehicle,'scooter','scooter'));recoverPose(p,'walking',world,blockers);
 const steps=Math.max(1,Math.ceil(safeDt(dt)*120)),step=safeDt(dt)/steps;let hit=false;
 for(let i=0;i<steps;i++)hit=moveActor(p,input,step,'walking',world,blockers).hit||hit;return hit;
}
const TRAFFIC_ROUTES=[[160,480,1120,1440],[480,160,1440,1120],[160,160,1440,1440],[160,800,1440,1120]];
export function trafficPose(route,t){
 const [a,b,c,d]=TRAFFIC_ROUTES[route]||TRAFFIC_ROUTES[0],left=a+TRAFFIC_LANE_OFFSET,right=c-TRAFFIC_LANE_OFFSET,top=b+TRAFFIC_LANE_OFFSET,bottom=d-TRAFFIC_LANE_OFFSET,r=28,w=right-left-2*r,h=bottom-top-2*r,arc=Math.PI*r/2,perimeter=2*(w+h)+4*arc;
 let n=((finite(t)%1)+1)%1*perimeter;
 const segments=[w,arc,h,arc,w,arc,h,arc];let segment=0;while(segment<7&&n>=segments[segment])n-=segments[segment++];
 let x,y,angle;
 if(segment===0){x=left+r+n;y=top;angle=0;}
 else if(segment===2){x=right;y=top+r+n;angle=Math.PI/2;}
 else if(segment===4){x=right-r-n;y=bottom;angle=Math.PI;}
 else if(segment===6){x=left;y=bottom-r-n;angle=-Math.PI/2;}
 else{
  const corners={1:[right-r,top+r,-Math.PI/2],3:[right-r,bottom-r,0],5:[left+r,bottom-r,Math.PI/2],7:[left+r,top+r,Math.PI]};
  const [cx,cy,start]=corners[segment],theta=start+n/r;x=cx+Math.cos(theta)*r;y=cy+Math.sin(theta)*r;angle=theta+Math.PI/2;
 }
 return {x,y,angle,perimeter};
}
export function makeTraffic(){
 const cars=[];
 for(let i=0;i<14;i++){
  const car={t:i/14,speed:17+i%4*5,route:i%3,color:['#efbc50','#7195ae','#df795f','#d4d9d2','#547d72'][i%5],type:'car',actualSpeed:0,yielding:false};
  // Do not spawn intersecting cars where their routes share a lane.
  for(let attempt=0;attempt<100;attempt++){Object.assign(car,trafficPose(car.route,car.t));if(!cars.some(c=>bodiesOverlap(collisionBody(car,'car'),collisionBody(c,'car'))))break;car.t=(car.t+.011)%1;}
  cars.push(car);
 }
 return cars;
}
function nextTrafficPose(car,dt){
 const speed=clamp(finite(car.speed),0,72);
 if(!speed)return {...car};
 if(!Number.isInteger(car.route))return {...car,x:car.x+Math.cos(car.angle)*speed*dt,y:car.y+Math.sin(car.angle)*speed*dt};
 const current=trafficPose(car.route,car.t),t=(finite(car.t)+speed*dt/current.perimeter)%1;
 return {...trafficPose(car.route,t),t};
}
function advanceTraffic(cars,dt,world,blockers=[],yielding=new Set()){
 const fixed=fixedBodies(world);
 for(const car of cars){
  if(!Number.isFinite(car.x)||!Number.isFinite(car.y)||!Number.isFinite(car.angle))Object.assign(car,trafficPose(car.route,car.t));
  car.actualSpeed=0;car.yielding=false;if(dt<=0)continue;
  const desired=nextTrafficPose(car,dt),solids=[...fixed,...blockers,...cars.filter(other=>other!==car).map(other=>dynamicBody(other,'car','car'))];
  const carBody=collisionBody(car,'car');
  if(solids.some(body=>bodiesOverlap(carBody,body))){
   // A reloaded parked scooter can coincide with newly generated traffic. Move
   // only that invalid traffic spawn to a clear pose on its own route; do not
   // relocate the player's parked vehicle or let the overlap persist forever.
   if(Number.isInteger(car.route)){
    const initial=finite(car.t),perimeter=trafficPose(car.route,initial).perimeter;
    for(let offset=10;offset<perimeter;offset+=10){
     const t=(initial+offset/perimeter)%1,candidate=trafficPose(car.route,t),candidateBody=collisionBody(candidate,'car');
     if(!solids.some(body=>bodiesOverlap(candidateBody,body))){Object.assign(car,candidate,{t});break;}
    }
   }else recoverPose(car,'car',world,blockers.concat(cars.filter(other=>other!==car).map(other=>dynamicBody(other,'car','car'))));
   car.yielding=true;continue;
  }
  if(yielding.has(car)){car.yielding=true;continue;}
  const candidate={x:car.x,y:car.y,angle:car.angle},angle=car.angle+Math.atan2(Math.sin(desired.angle-car.angle),Math.cos(desired.angle-car.angle));
  if(!rotateSafely(candidate,'car',angle,solids)){car.yielding=true;continue;}
  const result=moveBody(candidate,'car',{x:desired.x-car.x,y:desired.y-car.y},solids,{slide:false});
  // Route parameter advances only on a fully safe move, so yielding never
  // teleports traffic back onto a route or forces the actor against a wall.
  if(result.hit){car.yielding=true;continue;}
  Object.assign(car,{x:candidate.x,y:candidate.y,angle:candidate.angle,t:desired.t,actualSpeed:result.distance/dt});
 }
}
export function updateTraffic(cars,dt,world={obstacles:[]},state=null){
 const duration=safeDt(dt),steps=Math.max(1,Math.ceil(duration*120));
 const blockers=state?[dynamicBody(state.player,state.mode,'player'),...(state.mode==='walking'?[dynamicBody(state.vehicle,'scooter','scooter')]:[])]:[];
 for(let i=0;i<steps;i++)advanceTraffic(cars,duration/steps,world,blockers);
}
// Main loop must call this once, instead of independently moving each actor.
// Notification cooldowns never disable collision response.
export function stepSimulation(state,input,dt,world,traffic=state.traffic||[]){
 const p=state.player,mode=state.mode==='walking'?'walking':'riding',duration=safeDt(dt),steps=Math.max(1,Math.ceil(duration*120)),step=duration/steps;
 const summary={hit:false,buildingHit:false,vehicleHit:false,movedDistance:0};
 const parked=mode==='walking'?[dynamicBody(state.vehicle,'scooter','scooter')]:[];
 recoverPose(p,mode,world,[...traffic.map(c=>dynamicBody(c,'car','car')),...parked]);
 for(let i=0;i<steps;i++){
  const old={x:p.x,y:p.y},cars=traffic.map(c=>dynamicBody(c,'car','car'));
  const desired=controlActor(p,input,step,mode,world,[...fixedBodies(world),...cars,...parked]);
  const actorBody=collisionBody(p,mode),yielding=new Set();
  for(const car of traffic){
   const next=nextTrafficPose(car,step),motion={x:next.x-car.x,y:next.y-car.y};
   if(sweepCollision(actorBody,collisionBody(car,'car'),desired,motion))yielding.add(car);
  }
  const result=moveBody(p,mode,desired,[...fixedBodies(world),...cars,...parked]);
  if(result.hit&&result.distance<Math.hypot(desired.x,desired.y)*.02)p.speed=0;
  if(Math.abs(p.speed)<.2)p.speed=0;
  p.distance+=result.distance;summary.hit ||=result.hit;summary.buildingHit ||=result.fixedHit;summary.vehicleHit ||=result.vehicleHit;summary.movedDistance+=distance(old,p);
  const blockers=[dynamicBody(p,mode,'player'),...parked];
  advanceTraffic(traffic,step,world,blockers,yielding);
 }
 p.actualSpeed=duration>0?summary.movedDistance/duration:0;
 if(mode==='riding')syncVehicle(p,state.vehicle);
 return summary;
}
export function findDismountPosition(vehicle,world,traffic=[]){
 const blockers=traffic.map(car=>dynamicBody(car,'car','car')),solids=[...fixedBodies(world),...blockers];
 const angles=[Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4];
 for(const radius of [14,20,27])for(const offset of angles){
  const angle=vehicle.angle+offset,candidate={x:vehicle.x+Math.cos(angle)*radius,y:vehicle.y+Math.sin(angle)*radius,angle:vehicle.angle};
  if(poseCollides(candidate,'walking',world,[...blockers,dynamicBody(vehicle,'scooter','scooter')]))continue;
  // The dismount starts over one's own scooter, but must not cross any other
  // physical object (including moving/stationary traffic, trunks or lamp bases).
  const walk={x:vehicle.x,y:vehicle.y,angle:vehicle.angle},result=moveBody(walk,'walking',{x:candidate.x-walk.x,y:candidate.y-walk.y},solids,{slide:false});
  if(!result.hit)return candidate;
 }
 return null;
}
export function changeTravelMode(state,world,traffic=[]){
 if(state.mode==='riding'){
  if(Math.abs(state.player.speed)>=8)return {ok:false,message:'速度太快，先煞車慢下來再下車'};
  const vehicle={...state.vehicle,x:state.player.x,y:state.player.y,angle:state.player.angle,speed:0};
  const safe=findDismountPosition(vehicle,world,traffic);if(!safe)return {ok:false,message:'旁邊沒有安全落腳處，挪動機車再試一次'};
  Object.assign(state.vehicle,vehicle);state.mode='walking';Object.assign(state.player,safe,{speed:0,collisionCooldown:0});return {ok:true,message:'已下車，機車停在原地；靠近後按 F 上車'};
 }
 if(distance(state.player,state.vehicle)>=34)return {ok:false,message:`離機車還有 ${Math.ceil(toMetres(distance(state.player,state.vehicle)))} m，靠近後才能上車`};
 const blockers=traffic.map(car=>dynamicBody(car,'car','car'));
 const path={...state.player},result=moveBody(path,'walking',{x:state.vehicle.x-path.x,y:state.vehicle.y-path.y},[...fixedBodies(world),...blockers],{slide:false});
 if(result.hit)return {ok:false,message:'中間有障礙，請繞到機車旁再上車'};
 if(poseCollides(state.vehicle,'riding',world,blockers))return {ok:false,message:'機車位置受阻，可按 R 將人車一起移回起點'};
 state.mode='riding';Object.assign(state.player,{x:state.vehicle.x,y:state.vehicle.y,angle:state.vehicle.angle,speed:0,collisionCooldown:0});state.vehicle.speed=0;return {ok:true,message:'已上車，沿著街道繼續前進'};
}
