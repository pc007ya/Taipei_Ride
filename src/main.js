import { LANDMARKS, START, createWorld, createPlayer, updatePlayer, makeTraffic, updateTraffic, nearbyLandmark, canCollect, distance, cleanProgress } from './world.js';
import { Renderer, drawMap } from './renderer.js';
const $=id=>document.getElementById(id);
const STORAGE_KEY='taipei-ride:v1';
let saveAvailable=true, storageWarningShown=false, saved={};
try { const raw=localStorage.getItem(STORAGE_KEY);try{saved=JSON.parse(raw||'{}');}catch{saved={};} } catch { saveAvailable=false; }
const progress=cleanProgress(saved);
const world=createWorld(), player=createPlayer(), traffic=makeTraffic();
player.distance=progress.distance;
const state={player,traffic,stamps:progress.stamps,night:progress.night,target:LANDMARKS.find(l=>!progress.stamps.includes(l.id))||null};
let started=false, paused=false, lastTime=0, uiClock=0, saveClock=0, toastTimer=0, movingTime=0;
const input={throttle:false,reverse:false,left:false,right:false,brake:false},heldKeys=new Set(),touch=new Set();
let renderer;
let renderMode='3d';
async function initializeRenderer(){
  const compatibility=new URLSearchParams(location.search).get('renderer')==='2d';
  if(!compatibility){
    try{const {Renderer3D}=await import('./renderer3d.js');renderer=new Renderer3D($('world'),world);$('render-mode').textContent='3D 漫遊';return;}
    catch(error){console.warn('WebGL is unavailable; using the Canvas 2D compatibility renderer.',error.message);}
  }
  activateCompatibility(compatibility?'已選用 2D 相容模式':'此瀏覽器無法啟用 WebGL，已切換 2D 相容模式');
}
function activateCompatibility(message){
  const old=$('world'),canvas=old.cloneNode(false);old.replaceWith(canvas);renderer=new Renderer(canvas,world);renderMode='2d';$('render-mode').textContent='2D 相容模式';$('render-mode').title='目前使用 Canvas 2D 備援。支援 WebGL 的瀏覽器會自動開啟真 3D。';toast(message);
}
await initializeRenderer();
$('world').addEventListener('webglcontextlost',event=>{event.preventDefault();activateCompatibility('3D 畫面暫時中斷，已切換 2D 相容模式');});
const dialogs=[...document.querySelectorAll('dialog')];
function clearInput(){heldKeys.clear();touch.clear();for(const k in input)input[k]=false;document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
function readInput(){input.throttle=heldKeys.has('KeyW')||heldKeys.has('ArrowUp')||touch.has('throttle');input.reverse=heldKeys.has('KeyS')||heldKeys.has('ArrowDown')||touch.has('reverse');input.left=heldKeys.has('KeyA')||heldKeys.has('ArrowLeft')||touch.has('left');input.right=heldKeys.has('KeyD')||heldKeys.has('ArrowRight')||touch.has('right');input.brake=heldKeys.has('Space')||touch.has('brake');}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({stamps:state.stamps,distance:player.distance,night:state.night}));saveAvailable=true;}
 catch{saveAvailable=false;if(!storageWarningShown){toast('瀏覽器未允許儲存，重新整理後進度不會保留');storageWarningShown=true;}}
 updateStorageNotice();
}
function updateStorageNotice(){
 $('storage-notice').hidden=saveAvailable;
 document.querySelector('.welcome-note').textContent=saveAvailable?'原創微型城市 · 免登入 · 自動儲存集章':'原創微型城市 · 目前無法儲存進度';
}
function modal(id){clearInput();dialogs.forEach(d=>{if(d.open)d.close();});paused=true;$(id).showModal();$('pause').setAttribute('aria-label','繼續漫遊');}
function closeModal(){dialogs.forEach(d=>{if(d.open)d.close();});paused=false;clearInput();$('pause').setAttribute('aria-label','暫停');}
function pause(){if(!started)return;if(dialogs.some(d=>d.open)){closeModal();return;}modal('pause-dialog');save();}
function setNight(){state.night=!state.night;document.body.classList.toggle('night',state.night);$('weather').innerHTML=state.night?'<i></i> 夜色漫遊 <span>20°</span>':'<i></i> 午後慢行 <span>24°</span>';$('atmosphere').setAttribute('aria-label',state.night?'切換為白天':'切換為夜晚');save();}
function resetBike(){Object.assign(player,START,{speed:0,collisionCooldown:0});if(renderer.resetCamera)renderer.resetCamera(player);else{renderer.camera.x=player.x;renderer.camera.y=player.y;}clearInput();toast('回到起點了，城市印記依然保留');}
function target(l){state.target=l;renderMission();renderStamps();}
function renderStamps(){
  $('stamp-count').textContent=`${state.stamps.length} / 6`;
  $('stamp-rail').replaceChildren(...LANDMARKS.map(l=>{const b=document.createElement('button');b.className=`stamp-icon ${state.stamps.includes(l.id)?'done':''} ${state.target?.id===l.id?'active':''}`;b.textContent=l.stamp;b.title=l.name;b.setAttribute('aria-label',`${l.name}${state.stamps.includes(l.id)?'，已收藏':'，設定為目的地'}`);b.onclick=()=>{target(l);toast(`目的地：${l.name}`);};return b;}));
  $('map-destinations').replaceChildren(...LANDMARKS.map(l=>{const b=document.createElement('button');b.className=state.target?.id===l.id?'active':'';b.innerHTML=`${state.stamps.includes(l.id)?'✓':'○'} ${l.name}<span>${state.stamps.includes(l.id)?'已收藏':'前往'}</span>`;b.onclick=()=>{target(l);closeModal();toast(`目的地：${l.name}`);};return b;}));
}
function renderMission(){
  const l=state.target;
  $('destination').textContent=l?l.name:'自由漫遊';
  $('clue').textContent=l?l.clue:'六個城市印記都已收藏。接下來，跟著心情騎吧。';
  $('mission-index').textContent=l?`${String(LANDMARKS.indexOf(l)+1).padStart(2,'0')} / 06`:'06 / 06';
}
function openMap(){renderStamps();modal('map-dialog');requestAnimationFrame(()=>drawMap($('large-map'),state,true));}
function collect(){
  const l=nearbyLandmark(player);
  if(!canCollect(player,l)){if(l)toast('先慢下來，再把這個街角收藏');return;}
  if(state.stamps.includes(l.id)){toast(`${l.name}已在你的城市收藏裡`);return;}
  state.stamps.push(l.id);save();renderStamps();
  const complete=state.stamps.length===LANDMARKS.length;
  $('big-stamp').textContent=complete?'北':l.stamp;
  $('stamp-caption').textContent=complete?'THE CITY IS YOURS':`CITY MEMORY / ${String(state.stamps.length).padStart(2,'0')}`;
  $('stamp-title').textContent=complete?'六站風景，收藏完成！':`${l.name}，已收藏`;
  $('stamp-description').textContent=complete?'你已繞過霓虹、山色與河岸。這座小城市，還有許多轉角等你隨心漫遊。':l.fact;
  $('collected-count').textContent=`${state.stamps.length} / 6 城市印記`;
  $('next-stop').innerHTML=complete?'繼續自由漫遊 <span>↗</span>':'下一站，繼續探索 <span>↗</span>';
  target(LANDMARKS.find(x=>!state.stamps.includes(x.id))||null);modal('stamp-dialog');
}
$('start').onclick=()=>{started=true;$('welcome').hidden=true;document.body.classList.add('playing');clearInput();toast(state.stamps.length?'歡迎回來，繼續收集城市風景':'按住 W 或 ↑ 出發，沿著大道向北騎');};
$('pause').onclick=pause;$('resume').onclick=closeModal;$('help').onclick=()=>modal('help-dialog');$('help-done').onclick=()=>{closeModal();if(!started)$('start').click();};
$('atmosphere').onclick=setNight;$('open-map').onclick=openMap;$('minimap-button').onclick=openMap;$('interact').onclick=collect;
$('reset-bike').onclick=()=>{resetBike();closeModal();};$('reset-trip').onclick=()=>modal('reset-dialog');$('cancel-reset').onclick=()=>modal('pause-dialog');
$('confirm-reset').onclick=()=>{state.stamps=[];player.distance=0;target(LANDMARKS[0]);resetBike();save();closeModal();toast('新的旅程，從第一個街角開始');};
$('next-stop').onclick=closeModal;
for(const b of document.querySelectorAll('[data-close]')) b.onclick=closeModal;
for(const d of dialogs){d.addEventListener('cancel',e=>{e.preventDefault();if(d.id==='reset-dialog')modal('pause-dialog');else closeModal();});}
const drivingKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
window.addEventListener('keydown',e=>{
  if(drivingKeys.includes(e.code)){if(!started||paused)return;e.preventDefault();heldKeys.add(e.code);readInput();return;}
  if(e.repeat)return;
  if(e.code==='Escape'){if(!dialogs.some(d=>d.open))pause();return;}
  if(e.code==='KeyP'){pause();return;}
  if(dialogs.some(d=>d.open))return;
  if(e.code==='KeyM')openMap();
  else if(e.code==='KeyN')setNight();
  else if(e.code==='KeyR'&&started)resetBike();
  else if(e.code==='KeyE'&&started)collect();
});
window.addEventListener('keyup',e=>{heldKeys.delete(e.code);readInput();});
for(const b of document.querySelectorAll('[data-control]')){
  const name=b.dataset.control;
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!started||paused)return;b.setPointerCapture(e.pointerId);touch.add(name);b.classList.add('pressed');readInput();});
  const release=()=>{touch.delete(name);b.classList.remove('pressed');readInput();};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  b.addEventListener('contextmenu',e=>e.preventDefault());
}
window.addEventListener('blur',()=>{clearInput();if(started&&!paused)modal('pause-dialog');save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(started&&!paused)modal('pause-dialog');save();}});
window.addEventListener('pagehide',save);
window.addEventListener('resize',()=>{renderer.resize();if($('map-dialog').open)drawMap($('large-map'),state,true);});
function ui(){
  const l=state.target,near=nearbyLandmark(player);const kmh=Math.round(Math.abs(player.speed)*1.6);
  $('speed').textContent=String(kmh).padStart(2,'0');$('trip-distance').textContent=(player.distance/1000).toFixed(2);
  $('ride-state').textContent=player.speed<-.5?'慢慢倒車':kmh>0?'城市慢行':'準備出發';
  if(l){const d=distance(player,l);$('distance').textContent=d<1000?`${Math.round(d)} m`:`${(d/1000).toFixed(1)} km`;const dx=l.x-player.x,dy=l.y-player.y;let dir='';if(Math.abs(dy)>Math.abs(dx)*.4)dir+=dy<0?'北':'南';if(Math.abs(dx)>Math.abs(dy)*.4)dir+=dx<0?'西':'東';$('direction').textContent=d<45?'已到附近，放慢速度':`往${dir}騎 · 跟著圓環走`;}else{$('distance').textContent='隨心';$('direction').textContent='六站完成 · 城市屬於你';}
  const show=started&&!paused&&near&&!state.stamps.includes(near.id);$('interact').hidden=!show;
  if(show){$('interact').disabled=!canCollect(player,near);$('interact').innerHTML=canCollect(player,near)?'◎ 拍照打卡 <kbd>E</kbd>':'先慢下來，再打卡';}
  $('map-district').textContent=player.x<400?'老城與河岸':player.x>1150?'山城之間':'城市中心';
  drawMap($('minimap'),state);if($('map-dialog').open)drawMap($('large-map'),state,true);
}
function frame(ms){
  const dt=Math.min(.04,lastTime?(ms-lastTime)/1000:1/60);lastTime=ms;
  if(started&&!paused){
    const hit=updatePlayer(player,input,dt,world);
    if(hit&&player.collisionCooldown<=0){player.collisionCooldown=1.5;toast('轉個方向試試，或按 R 回到起點');}
    updateTraffic(traffic,dt);
    if(player.collisionCooldown<=0&&Math.abs(player.speed)>10&&traffic.some(c=>distance(c,player)<19)){player.speed*=-.2;player.collisionCooldown=1.8;toast('讓一讓，慢慢騎也很好');}
    if(Math.abs(player.speed)>2)movingTime+=dt;
    if(movingTime>4)$('ride-hint').style.opacity='0';
    saveClock+=dt;if(saveClock>5){saveClock=0;save();}
  }else if(!started)updateTraffic(traffic,dt*.6);
  renderer.render(state,paused?0:dt);
  uiClock+=dt;if(uiClock>.1){uiClock=0;ui();}
  requestAnimationFrame(frame);
}
updateTraffic(traffic,0);renderStamps();renderMission();
if(state.night){state.night=false;setNight();}
updateStorageNotice();ui();requestAnimationFrame(frame);
// A read-only snapshot supports automated QA without changing gameplay state.
Object.defineProperty(window,'taipeiRide',{value:Object.freeze({snapshot:()=>({started,paused,player:{...player},stamps:[...state.stamps],night:state.night,target:state.target?.id||null,renderMode,storageAvailable:saveAvailable})}),writable:false});
