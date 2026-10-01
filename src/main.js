import { LANDMARKS, START, createWorld, updatePlayer, updateWalker, syncVehicle, changeTravelMode, makeTraffic, updateTraffic, nearbyLandmark, canCollect, distance } from './world.js';
import { SAVE_KEY, LEGACY_SAVE_KEY, createSession, serializeSession, QUEST_STATIONS, questObjective, questInteraction, interactQuest, recordQuestRide } from './session.js';
import { Renderer, drawMap } from './renderer.js';
const $=id=>document.getElementById(id);
let saveAvailable=true,storageWarningShown=false,saved=null;
try{const current=localStorage.getItem(SAVE_KEY),raw=current===null?localStorage.getItem(LEGACY_SAVE_KEY):current;try{saved=raw===null?null:JSON.parse(raw);}catch{saved=null;}}catch{saveAvailable=false;}
const world=createWorld(),state=createSession(world,saved),player=state.player,traffic=makeTraffic();state.traffic=traffic;state.target=LANDMARKS.find(l=>l.id===state.selectedLandmark)||null;
let started=false,paused=false,lastTime=0,uiClock=0,saveClock=0,toastTimer=0,movingTime=0,completionKind='stamp';
const input={throttle:false,reverse:false,left:false,right:false,brake:false},heldKeys=new Set(),touch=new Set();
let renderer,renderMode='3d';
const destination=()=>state.activity==='quest'?questObjective(state):state.target;
const renderState=()=>({...state,target:destination()});
async function initializeRenderer(){
 const compatibility=new URLSearchParams(location.search).get('renderer')==='2d';
 if(!compatibility){try{const {Renderer3D}=await import('./renderer3d.js');renderer=new Renderer3D($('world'),world);renderer.resetCamera(player);$('render-mode').textContent='3D 漫遊';return;}catch(error){console.warn('WebGL is unavailable; using the Canvas 2D compatibility renderer.',error.message);}}
 activateCompatibility(compatibility?'已選用 2D 相容模式':'此瀏覽器無法啟用 WebGL，已切換 2D 相容模式');
}
function activateCompatibility(message){const old=$('world'),canvas=old.cloneNode(false);old.replaceWith(canvas);renderer=new Renderer(canvas,world);renderer.camera.x=player.x;renderer.camera.y=player.y;renderMode='2d';$('render-mode').textContent='2D 相容模式';$('render-mode').title='目前使用 Canvas 2D 備援。支援 WebGL 的瀏覽器會自動開啟真 3D。';toast(message);}
await initializeRenderer();
$('world').addEventListener('webglcontextlost',event=>{event.preventDefault();activateCompatibility('3D 畫面暫時中斷，已切換 2D 相容模式');});
const dialogs=[...document.querySelectorAll('dialog')];
function clearInput(){heldKeys.clear();touch.clear();for(const k in input)input[k]=false;document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
function readInput(){input.throttle=heldKeys.has('KeyW')||heldKeys.has('ArrowUp')||touch.has('throttle');input.reverse=heldKeys.has('KeyS')||heldKeys.has('ArrowDown')||touch.has('reverse');input.left=heldKeys.has('KeyA')||heldKeys.has('ArrowLeft')||touch.has('left');input.right=heldKeys.has('KeyD')||heldKeys.has('ArrowRight')||touch.has('right');input.brake=heldKeys.has('Space')||touch.has('brake');}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function updateStorageNotice(){$('storage-notice').hidden=saveAvailable;document.querySelector('.welcome-note').textContent=saveAvailable?'原創微型城市 · 免登入 · 旅程自動儲存':'原創微型城市 · 目前無法儲存進度';}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(serializeSession(state)));saveAvailable=true;}catch{saveAvailable=false;if(!storageWarningShown){toast('瀏覽器未允許儲存，重新整理後進度不會保留');storageWarningShown=true;}}updateStorageNotice();}
function modal(id){clearInput();dialogs.forEach(d=>{if(d.open)d.close();});paused=true;$(id).showModal();$('pause').setAttribute('aria-label','繼續漫遊');}
function closeModal(){dialogs.forEach(d=>{if(d.open)d.close();});paused=false;clearInput();$('pause').setAttribute('aria-label','暫停');}
function pause(){if(!started)return;if(dialogs.some(d=>d.open)){closeModal();return;}modal('pause-dialog');save();}
function refreshAtmosphere(){document.body.classList.toggle('night',state.night);$('weather').innerHTML=state.night?'<i></i> 夜色漫遊 <span>20°</span>':'<i></i> 午後慢行 <span>24°</span>';$('atmosphere').setAttribute('aria-label',state.night?'切換為白天':'切換為夜晚');}
function setNight(){state.night=!state.night;refreshAtmosphere();save();}
function resetCamera(){if(renderer.resetCamera)renderer.resetCamera(player);else{renderer.camera.x=player.x;renderer.camera.y=player.y;}}
function resetBike(){state.mode='riding';Object.assign(player,START,{speed:0,collisionCooldown:0});syncVehicle(player,state.vehicle);resetCamera();clearInput();save();renderMission();ui();toast('人車一起回到起點，任務與收藏都保留');}
function target(l){state.target=l;state.selectedLandmark=l?.id||null;renderMission();renderStamps();}
function selectLandmark(l){state.activity='explore';target(l);save();}
function renderStamps(){
 $('stamp-count').textContent=`${state.stamps.length} / 6`;
 $('stamp-rail').replaceChildren(...LANDMARKS.map(l=>{const b=document.createElement('button');b.className=`stamp-icon ${state.stamps.includes(l.id)?'done':''} ${state.activity==='explore'&&state.target?.id===l.id?'active':''}`;b.textContent=l.stamp;b.title=l.name;b.setAttribute('aria-label',`${l.name}${state.stamps.includes(l.id)?'，已收藏':'，設定為目的地'}`);b.onclick=()=>{selectLandmark(l);toast(`城市收藏：${l.name}`);};return b;}));
 $('map-destinations').replaceChildren(...LANDMARKS.map(l=>{const b=document.createElement('button');b.className=state.activity==='explore'&&state.target?.id===l.id?'active':'';b.innerHTML=`${state.stamps.includes(l.id)?'✓':'○'} ${l.name}<span>${state.stamps.includes(l.id)?'已收藏':'前往'}</span>`;b.onclick=()=>{selectLandmark(l);closeModal();toast(`目的地：${l.name}`);};return b;}));
}
function renderMission(){
 const l=destination(),main=state.activity==='quest';
 $('mission-label').textContent=main?'主線 · 雨後的一杯茶':'支線 · 城市收藏';
 $('destination').textContent=l?l.name:main?'送暖任務完成':'自由漫遊';
 $('clue').textContent=l?l.clue:main?'300 遊戲幣已入袋。你可以繼續散步、騎車，或選一站收集城市印記。':'六個城市印記都已收藏。接下來，跟著心情騎吧。';
 const stages={available:1,pickup:2,carrying:3,deliver:4,completed:4};
 $('mission-index').textContent=main?`${String(stages[state.quest.stage]).padStart(2,'0')} / 04`:l?`${String(LANDMARKS.indexOf(l)+1).padStart(2,'0')} / 06`:'06 / 06';
 $('quest-summary').textContent=state.quest.stage==='completed'?'雨後的一杯茶 · 已完成 · 獎勵已領取':questObjective(state).stageLabel;
 $('track-quest').textContent=state.quest.stage==='completed'?'查看已完成的主線':'追蹤主線 · 雨後的一杯茶';
 $('cargo-status').hidden=!['carrying','deliver'].includes(state.quest.stage);$('coin-count').textContent=String(state.coins);$('travel-mode').textContent=state.mode==='walking'?'步行探索':'機車漫遊';
 document.querySelector('[data-control="throttle"]').innerHTML=state.mode==='walking'?'前進<span>↑</span>':'油門<span>↑</span>';
 document.querySelector('[data-control="throttle"]').setAttribute('aria-label',state.mode==='walking'?'前進':'油門');
 document.querySelector('[data-control="reverse"]').textContent=state.mode==='walking'?'後退':'倒車';
 document.querySelector('[data-control="reverse"]').setAttribute('aria-label',state.mode==='walking'?'後退':'倒車');
}
function openMap(){renderStamps();renderMission();modal('map-dialog');requestAnimationFrame(()=>drawMap($('large-map'),renderState(),true));}
function toggleVehicle(){if(!started||paused)return;const result=changeTravelMode(state,world,traffic);clearInput();if(result.ok){save();renderMission();ui();}toast(result.message);}
function collectStamp(){
 const l=nearbyLandmark(player);if(!canCollect(player,l)){if(l)toast('先慢下來，再把這個街角收藏');return;}
 if(state.stamps.includes(l.id)){toast(`${l.name}已在你的城市收藏裡`);return;}
 state.stamps.push(l.id);completionKind='stamp';const complete=state.stamps.length===LANDMARKS.length;
 $('big-stamp').textContent=complete?'北':l.stamp;$('stamp-caption').textContent=complete?'THE CITY IS YOURS':`CITY MEMORY / ${String(state.stamps.length).padStart(2,'0')}`;
 $('stamp-title').textContent=complete?'六站風景，收藏完成！':`${l.name}，已收藏`;$('stamp-description').textContent=complete?'你已繞過霓虹、山色與河岸。這座小城市，還有許多轉角等你隨心漫遊。':l.fact;
 $('collected-count').textContent=`${state.stamps.length} / 6 城市印記`;$('next-stop').innerHTML=complete?'繼續自由漫遊 <span>↗</span>':'下一站，繼續探索 <span>↗</span>';
 target(LANDMARKS.find(x=>!state.stamps.includes(x.id))||null);save();modal('stamp-dialog');
}
function interact(){
 if(!started||paused)return;
 if(state.activity!=='quest'){collectStamp();return;}
 const result=interactQuest(state);toast(result.message);if(!result.ok)return;
 save();renderMission();
 if(result.completed){completionKind='quest';$('big-stamp').textContent='茶';$('stamp-caption').textContent='A CUP AFTER THE RAIN';$('stamp-title').textContent='熱茶送達，心意也到了';$('stamp-description').textContent='修傘師傅接過熱茶，笑著向你道謝。城市裡的小小幫忙，也是一段值得收藏的風景。';$('collected-count').textContent=`+300 遊戲幣 · 餘額 ${state.coins}`;$('next-stop').innerHTML='去收集城市印記 <span>↗</span>';modal('stamp-dialog');}
}
$('start').onclick=()=>{started=true;$('welcome').hidden=true;document.body.classList.add('playing');clearInput();toast(state.activity==='quest'?'W / ↑ 前進，F 上下車；到阿沐茶舖按 E 接委託':'旅程已恢復，W / ↑ 前進，F 可上下車');};
$('pause').onclick=pause;$('resume').onclick=closeModal;$('help').onclick=()=>modal('help-dialog');$('help-done').onclick=()=>{closeModal();if(!started)$('start').click();};
$('atmosphere').onclick=setNight;$('open-map').onclick=openMap;$('minimap-button').onclick=openMap;$('interact').onclick=interact;$('vehicle-action').onclick=toggleVehicle;
$('track-quest').onclick=()=>{state.activity='quest';renderMission();renderStamps();save();closeModal();};
$('reset-bike').onclick=()=>{resetBike();closeModal();};$('reset-trip').onclick=()=>modal('reset-dialog');$('cancel-reset').onclick=()=>modal('pause-dialog');
$('confirm-reset').onclick=()=>{const fresh=createSession(world);Object.assign(player,fresh.player);Object.assign(state,fresh,{player,traffic,target:LANDMARKS[0]});refreshAtmosphere();resetCamera();clearInput();renderMission();renderStamps();save();closeModal();toast('新旅程開始，任務、遊戲幣與城市收藏已重置');};
$('next-stop').onclick=()=>{if(completionKind==='quest'){state.activity='explore';target(LANDMARKS.find(l=>!state.stamps.includes(l.id))||null);save();}closeModal();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=closeModal;
for(const d of dialogs)d.addEventListener('cancel',e=>{e.preventDefault();if(d.id==='reset-dialog')modal('pause-dialog');else closeModal();});
const drivingKeys=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
window.addEventListener('keydown',e=>{if(drivingKeys.includes(e.code)){if(!started||paused)return;e.preventDefault();heldKeys.add(e.code);readInput();return;}if(e.repeat)return;if(e.code==='Escape'){if(!dialogs.some(d=>d.open))pause();return;}if(e.code==='KeyP'){pause();return;}if(dialogs.some(d=>d.open))return;if(e.code==='KeyM')openMap();else if(e.code==='KeyN')setNight();else if(e.code==='KeyR'&&started)resetBike();else if(e.code==='KeyF')toggleVehicle();else if(e.code==='KeyE')interact();});
window.addEventListener('keyup',e=>{heldKeys.delete(e.code);readInput();});
for(const b of document.querySelectorAll('[data-control]')){const name=b.dataset.control;b.addEventListener('pointerdown',e=>{e.preventDefault();if(!started||paused)return;b.setPointerCapture(e.pointerId);touch.add(name);b.classList.add('pressed');readInput();});const release=()=>{touch.delete(name);b.classList.remove('pressed');readInput();};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);b.addEventListener('contextmenu',e=>e.preventDefault());}
window.addEventListener('blur',()=>{clearInput();if(started&&!paused)modal('pause-dialog');save();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(started&&!paused)modal('pause-dialog');save();}});window.addEventListener('pagehide',save);
window.addEventListener('resize',()=>{renderer.resize();if($('map-dialog').open)drawMap($('large-map'),renderState(),true);});
function ui(){
 const l=destination(),near=nearbyLandmark(player),walking=state.mode==='walking',kmh=Math.round(Math.abs(player.speed)*(walking?.35:1.6));
 $('speed').textContent=String(kmh).padStart(2,'0');$('trip-distance').textContent=(player.distance/1000).toFixed(2);$('cargo-status').hidden=!['carrying','deliver'].includes(state.quest.stage);$('coin-count').textContent=String(state.coins);$('travel-mode').textContent=walking?'步行探索':'機車漫遊';$('ride-state').textContent=walking?(kmh?'街角散步':'步行停留'):player.speed<-.5?'慢慢倒車':kmh>0?'城市慢行':'準備出發';
 if(l){const d=distance(player,l);$('distance').textContent=d<1000?`${Math.round(d)} m`:`${(d/1000).toFixed(1)} km`;const dx=l.x-player.x,dy=l.y-player.y;let dir='';if(Math.abs(dy)>Math.abs(dx)*.4)dir+=dy<0?'北':'南';if(Math.abs(dx)>Math.abs(dy)*.4)dir+=dx<0?'西':'東';$('direction').textContent=d<42?'已到附近，按 E 互動':`往${dir}${walking?'走':'騎'} · 跟著圓環`;}else{$('distance').textContent='隨心';$('direction').textContent=state.activity==='quest'?'主線完成 · 收藏支線等你探索':'六站完成 · 城市屬於你';}
 if(state.activity==='quest'&&state.quest.stage==='carrying')$('clue').textContent=l.clue;
 const action=state.activity==='quest'?questInteraction(state):null,showQuest=started&&!paused&&action,showStamp=started&&!paused&&state.activity==='explore'&&near&&!state.stamps.includes(near.id);
 $('interact').hidden=!showQuest&&!showStamp;
 if(showQuest){$('interact').disabled=!action.enabled;$('interact').innerHTML=`${action.label} <kbd>E</kbd>`;}else if(showStamp){$('interact').disabled=!canCollect(player,near);$('interact').innerHTML=canCollect(player,near)?'◎ 拍照打卡 <kbd>E</kbd>':'先慢下來，再打卡';}
 $('vehicle-action').hidden=!started||paused;const away=distance(player,state.vehicle);$('vehicle-action').innerHTML=walking?(away<34?'上車 <kbd>F</kbd>':`機車在 ${Math.ceil(away)} m 外 <kbd>F</kbd>`):'下車散步 <kbd>F</kbd>';
 $('map-district').textContent=player.x<400?'老城與河岸':player.x>1150?'山城之間':'城市中心';drawMap($('minimap'),renderState());if($('map-dialog').open)drawMap($('large-map'),renderState(),true);
}
function frame(ms){
 const dt=Math.min(.04,lastTime?(ms-lastTime)/1000:1/60);lastTime=ms;
 if(started&&!paused){
  const before=player.distance,hit=state.mode==='riding'?updatePlayer(player,input,dt,world):updateWalker(player,input,dt,world,state.vehicle);
  if(state.mode==='riding')syncVehicle(player,state.vehicle);
  if(recordQuestRide(state.quest,player.distance-before,state.mode)){renderMission();save();toast('配送路程已完成，到了修傘攤請下車交付');}
  if(hit&&player.collisionCooldown<=0){player.collisionCooldown=1.5;toast('前方受阻，轉個方向，或按 R 將人車移回起點');}
  updateTraffic(traffic,dt);
  if(state.mode==='riding'&&player.collisionCooldown<=0&&Math.abs(player.speed)>10&&traffic.some(c=>distance(c,player)<19)){player.speed*=-.2;syncVehicle(player,state.vehicle);player.collisionCooldown=1.8;toast('讓一讓，慢慢騎也很好');}
  if(Math.abs(player.speed)>2)movingTime+=dt;if(movingTime>4)$('ride-hint').style.opacity='0';saveClock+=dt;if(saveClock>5){saveClock=0;save();}
 }else if(!started)updateTraffic(traffic,dt*.6);
 renderer.render(renderState(),paused?0:dt);uiClock+=dt;if(uiClock>.1){uiClock=0;ui();}requestAnimationFrame(frame);
}
updateTraffic(traffic,0);renderStamps();renderMission();refreshAtmosphere();updateStorageNotice();ui();requestAnimationFrame(frame);
Object.defineProperty(window,'taipeiRide',{value:Object.freeze({snapshot:()=>({started,paused,player:{...player},vehicle:{...state.vehicle},mode:state.mode,quest:{...state.quest},coins:state.coins,activity:state.activity,objective:destination()?{...destination()}:null,stamps:[...state.stamps],night:state.night,target:state.target?.id||null,renderMode,storageAvailable:saveAvailable,...(renderer.getRenderMetrics?.()||{effectiveRenderScale:null,drawingBufferWidth:null,drawingBufferHeight:null,renderCssWidth:null,renderCssHeight:null})})}),writable:false});
