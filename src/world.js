export const WORLD_SIZE = 1600;
export const ROAD_WIDTH = 70;
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
  const rng=seeded(); const buildings=[], trees=[], stalls=[], obstacles=[];
  const palette=['#b1c8c8','#c7bcab','#d1baa8','#a3b4b2','#bcb8c6','#9fbdc8','#d2c8b2'];
  for(let ix=0;ix<4;ix++) for(let iy=0;iy<4;iy++) {
    const x=ROADS[ix]+55, y=ROADS[iy]+55;
    // Landmark blocks are custom-built; leave them out of the procedural streets.
    if((ix===1&&iy===0)||(ix===3&&iy===1)||(ix===3&&iy===3)||(ix===2&&iy===2)||(ix===0&&iy===2)) continue;
    for(let a=0;a<3;a++) for(let b=0;b<3;b++) {
      const w=48+rng()*12,d=48+rng()*12;
      const obj={type:'building',x:x+a*71,y:y+b*71,w,d,h:28+rng()*55,color:palette[Math.floor(rng()*palette.length)],seed:rng(),sign:rng()>.56?['茶','麵','早餐','書店','咖啡','便利商店'][Math.floor(rng()*6)]:''};
      buildings.push(obj); obstacles.push({x:obj.x,y:obj.y,w,d});
    }
  }
  // Original landmark geometry with a deliberately fictional street arrangement.
  buildings.push({type:'tower',x:1200,y:590,w:82,d:82,h:240,color:'#7bb9ad'});
  obstacles.push({x:1200,y:590,w:82,d:82});
  buildings.push({type:'hall',x:915,y:900,w:105,d:92,h:59,color:'#ece8d7'});
  obstacles.push({x:915,y:900,w:105,d:92});
  buildings.push({type:'temple',x:260,y:975,w:118,d:92,h:47,color:'#c55443'});
  obstacles.push({x:260,y:975,w:118,d:92});
  for(let i=0;i<7;i++) {
    const x=554+i%4*50,y=248+Math.floor(i/4)*89;
    stalls.push({type:'stall',x,y,w:35,d:26,h:23,color:['#ee815f','#edb747','#73b8a2','#b89cc7'][i%4],sign:['茶','鹽酥雞','麵','豆花','飯','甜','果'][i]});
    obstacles.push({x,y,w:35,d:26});
  }
  for(let i=0;i<125;i++) {
    const c=ROADS[Math.floor(rng()*5)],t=100+rng()*1380;
    const x=i%2?c+49:t,y=i%2?t:c+49;
    if(isRoad(x,y)) continue;
    if(buildings.some(b=>x>b.x-8&&x<b.x+b.w+8&&y>b.y-8&&y<b.y+b.d+8)) continue;
    trees.push({type:'tree',x,y,h:16+rng()*12,color:i%3?'#54846b':'#6b9a73'});
  }
  for(let i=0;i<30;i++) trees.push({type:'tree',x:1215+rng()*170,y:1190+rng()*190,h:20+rng()*28,color:['#416d58','#629267','#4b805e'][i%3]});
  return { buildings, trees, stalls, obstacles };
}
export function collides(x,y,obstacles,radius=8) {
  if(x<93||x>1515||y<93||y>1515) return true;
  return obstacles.some(b=>x+radius>b.x&&x-radius<b.x+b.w&&y+radius>b.y&&y-radius<b.y+b.d);
}
export function createPlayer() { return {...START,speed:0,distance:0,collisionCooldown:0}; }
export function updatePlayer(p,input,dt,world) {
  dt=clamp(dt,0,.04);
  const forward=(input.throttle?1:0)-(input.reverse?1:0);
  const surface=isRoad(p.x,p.y)?1:.65;
  if(input.brake) p.speed*=Math.exp(-8*dt);
  else if(forward) p.speed+=forward*48*dt;
  else p.speed*=Math.exp(-1.6*dt);
  p.speed=clamp(p.speed,-28,72*surface);
  if(Math.abs(p.speed)<.2) p.speed=0;
  const steering=(input.right?1:0)-(input.left?1:0);
  p.angle+=steering*2.15*dt*Math.min(1,Math.abs(p.speed)/24)*Math.sign(p.speed);
  const dx=Math.cos(p.angle)*p.speed*dt,dy=Math.sin(p.angle)*p.speed*dt;
  let hit=false;
  if(!collides(p.x+dx,p.y,world.obstacles)) p.x+=dx; else hit=true;
  if(!collides(p.x,p.y+dy,world.obstacles)) p.y+=dy; else hit=true;
  if(hit) p.speed*=-.2;
  p.distance+=Math.hypot(hit?0:dx,hit?0:dy);
  p.collisionCooldown=Math.max(0,p.collisionCooldown-dt);
  return hit;
}
export function nearbyLandmark(p) { return LANDMARKS.find(l=>distance(p,l)<45) || null; }
export function canCollect(p,l) { return !!l&&distance(p,l)<45&&Math.abs(p.speed)<8; }
export function makeTraffic() {
  const cars=[];
  for(let i=0;i<14;i++) cars.push({x:0,y:0,angle:0,t:i/14,speed:17+i%4*5,route:i%3,color:['#efbc50','#7195ae','#df795f','#d4d9d2','#547d72'][i%5],type:'car'});
  return cars;
}
export function updateTraffic(cars,dt) {
  const routes=[[160,480,1120,1440],[480,160,1440,1120],[160,160,1440,1440]];
  for(const car of cars) {
    const [a,b,c,d]=routes[car.route],w=c-a,h=d-b,perimeter=2*(w+h);
    car.t=(car.t+car.speed*dt/perimeter)%1;
    let n=car.t*perimeter;
    if(n<w){car.x=a+n;car.y=b+13;car.angle=0;}
    else if(n<w+h){car.x=c-13;car.y=b+n-w;car.angle=Math.PI/2;}
    else if(n<2*w+h){car.x=c-(n-w-h);car.y=d-13;car.angle=Math.PI;}
    else{car.x=a+13;car.y=d-(n-2*w-h);car.angle=-Math.PI/2;}
  }
}
export function cleanProgress(data) {
  if(!data||typeof data!=='object') return { stamps:[],distance:0,night:false };
  return {stamps:Array.isArray(data.stamps)?[...new Set(data.stamps.filter(id=>LANDMARKS.some(l=>l.id===id)))]:[],distance:typeof data.distance==='number'&&Number.isFinite(data.distance)?clamp(data.distance,0,1e9):0,night:data.night===true};
}

export function syncVehicle(player,vehicle){Object.assign(vehicle,{x:player.x,y:player.y,angle:player.angle,speed:player.speed});}
export function updateWalker(p,input,dt,world,vehicle=null){
 dt=clamp(dt,0,.04);
 const steering=(input.right?1:0)-(input.left?1:0);p.angle+=steering*2.8*dt;
 const direction=(input.throttle?1:0)-(input.reverse?1:0),desired=input.brake?0:direction*(direction<0?12:21);
 p.speed+=(desired-p.speed)*Math.min(1,dt*12);if(Math.abs(p.speed)<.15)p.speed=0;
 const dx=Math.cos(p.angle)*p.speed*dt,dy=Math.sin(p.angle)*p.speed*dt;
 const blocked=(x,y)=>collides(x,y,world.obstacles,6)||(vehicle&&Math.hypot(x-vehicle.x,y-vehicle.y)<12);
 const before={x:p.x,y:p.y};let hit=false;
 if(!blocked(p.x+dx,p.y))p.x+=dx;else hit=true;
 if(!blocked(p.x,p.y+dy))p.y+=dy;else hit=true;
 if(hit)p.speed=0;p.distance+=distance(before,p);p.collisionCooldown=Math.max(0,p.collisionCooldown-dt);return hit;
}
export function findDismountPosition(vehicle,world,traffic=[]){
 const angles=[Math.PI/2,-Math.PI/2,Math.PI,0,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4];
 for(const radius of [20,27,34])for(const offset of angles){
  const angle=vehicle.angle+offset,candidate={x:vehicle.x+Math.cos(angle)*radius,y:vehicle.y+Math.sin(angle)*radius};
  if(collides(candidate.x,candidate.y,world.obstacles,6)||traffic.some(car=>distance(car,candidate)<22))continue;
  let clear=true;for(let step=1;step<=Math.ceil(radius/3);step++){const t=step/Math.ceil(radius/3);if(collides(vehicle.x+(candidate.x-vehicle.x)*t,vehicle.y+(candidate.y-vehicle.y)*t,world.obstacles,6)){clear=false;break;}}
  if(clear)return {...candidate,angle:vehicle.angle};
 }
 return null;
}
export function changeTravelMode(state,world,traffic=[]){
 if(state.mode==='riding'){
  if(Math.abs(state.player.speed)>=8)return {ok:false,message:'速度太快，先煞車慢下來再下車'};
  syncVehicle(state.player,state.vehicle);state.vehicle.speed=0;
  const safe=findDismountPosition(state.vehicle,world,traffic);if(!safe)return {ok:false,message:'旁邊沒有安全落腳處，挪動機車再試一次'};
  state.mode='walking';Object.assign(state.player,safe,{speed:0,collisionCooldown:0});return {ok:true,message:'已下車，機車停在原地；靠近後按 F 上車'};
 }
 if(distance(state.player,state.vehicle)>=34)return {ok:false,message:`離機車還有 ${Math.ceil(distance(state.player,state.vehicle))} m，靠近後才能上車`};
 const steps=Math.ceil(distance(state.player,state.vehicle)/3);for(let i=1;i<=steps;i++){const t=i/steps;if(collides(state.player.x+(state.vehicle.x-state.player.x)*t,state.player.y+(state.vehicle.y-state.player.y)*t,world.obstacles,6))return {ok:false,message:'中間有障礙，請繞到機車旁再上車'};}
 if(collides(state.vehicle.x,state.vehicle.y,world.obstacles,8))return {ok:false,message:'機車位置受阻，可按 R 將人車一起移回起點'};
 state.mode='riding';Object.assign(state.player,{x:state.vehicle.x,y:state.vehicle.y,angle:state.vehicle.angle,speed:0,collisionCooldown:0});state.vehicle.speed=0;return {ok:true,message:'已上車，沿著街道繼續前進'};
}
