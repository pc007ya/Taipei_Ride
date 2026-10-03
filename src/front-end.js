import { createIntroTimeline } from './intro.js';
import { createArrivalTimeline } from './arrival.js';
import { createSoundscape } from './audio.js';
import { initControlsPanel } from './controls-panel.js';
import { drawMap } from './renderer.js';

const PREFERENCES_KEY='taipei-ride:menu:v1';
const QUALITY=['auto','low','medium','high','ultra'];
const bounded=(value,min,max,fallback)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const TIPS=[['停下機車，按 F 下車，走進街角的故事。','Stop and press F to get off your scooter and explore on foot.'],['靠近人物後按 E，接下街區裡的小小委託。','Approach a resident and press E to accept a delivery.'],['按 M 打開地圖，替下一段旅程選一個目的地。','Press M for the map and choose your next destination.']];

/** Presentation settings and scenes never own or mutate quest/vehicle state. */
export function createFrontEnd({getRenderer,onStart,onReturn,openDialog,closeDialog,isPlaying,getNight,setNight,getRenderMode,getAudioState=()=>({}),getJourneySnapshot=()=>window.taipeiRide?.snapshot(),setCinematicActive=()=>{},shouldPlayArrival=()=>false,onResetHints=()=>{},notify=()=>{}}){
 const $=id=>document.getElementById(id);
 let preferences={},preferenceWarning=false;
 try{const value=JSON.parse(localStorage.getItem(PREFERENCES_KEY)||'{}');if(value&&typeof value==='object')preferences=value;}catch{}
 let language=preferences.language==='en'?'en':'zh',appearance=preferences.appearance==='river'?'river':'sunset',quality=QUALITY.includes(preferences.quality)?preferences.quality:'auto';
 let reducedMotion=typeof preferences.reducedMotion==='boolean'?preferences.reducedMotion:Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 let showFps=preferences.showFps===true,hudScale=bounded(preferences.hudScale,.75,1.25,1),sensitivity=bounded(preferences.sensitivity,.3,2.5,1),invertY=preferences.invertY===true,hints=preferences.hints!==false,arrivalSeen=preferences.arrivalSeen===true;
 const audio=createSoundscape({preferences:preferences.audio||{}}),timeline=createIntroTimeline({reducedMotion}),arrival=createArrivalTimeline(),controls=initControlsPanel($('controls-content'),language);
 const choices=[...document.querySelectorAll('.front-choice')],panels=['character-dialog','settings-dialog','about-dialog','help-dialog','stats-dialog','map-dialog'];
 let activeChoice=0,previousPhase='',lastTime=null,menuTime=0,lastTip=-1,panelOpener=null,pauseReturnId=null,disposed=false,appliedRenderer=null,menuView='city',hintTimer=0,measuredFps=0,fpsMs=0,fpsFrames=0,dashboardClock=0,lastArrivalStage='';
 const english=()=>language==='en';
 function persist(){const {master,music,effects}=audio.snapshot();try{localStorage.setItem(PREFERENCES_KEY,JSON.stringify({language,reducedMotion,appearance,quality,showFps,hudScale,sensitivity,invertY,hints,arrivalSeen,audio:{master,music,effects}}));}catch{if(!preferenceWarning){preferenceWarning=true;notify(english()?'Menu settings cannot be saved in this browser.':'選單設定目前無法儲存，重新整理後會恢復預設');}}}
 function selectChoice(index,focus=false){activeChoice=(index+choices.length)%choices.length;choices.forEach((b,i)=>b.classList.toggle('selected',i===activeChoice));if(focus)choices[activeChoice].focus({preventScroll:true});}
 function updateTip(){const index=Math.floor(menuTime/8500)%TIPS.length;if(index===lastTip)return;lastTip=index;$('menu-tip').textContent=TIPS[index][english()?1:0];}
 function updateCharacters(){document.querySelectorAll('[data-appearance]').forEach(button=>{const selected=button.dataset.appearance===appearance;button.setAttribute('aria-pressed',String(selected));button.querySelector('.character-check').textContent=english()?(selected?'Selected':'Select'):(selected?'已選擇':'選擇');});}
 function range(id,value,text){const input=$(`setting-${id}`);input.value=String(value);input.style.setProperty('--range-fill',`${(Number(value)-Number(input.min))/(Number(input.max)-Number(input.min))*100}%`);$(`${id}-value`).textContent=text;}
 function syncSettings(){
  document.querySelectorAll('#setting-quality input').forEach(input=>input.checked=input.value===quality);
  document.querySelectorAll('#setting-language input').forEach(input=>input.checked=input.value===language);
  for(const key of ['master','music','effects'])range(key,Math.round(audio.snapshot()[key]*100),`${Math.round(audio.snapshot()[key]*100)}%`);
  range('hud',Math.round(hudScale*100),`${Math.round(hudScale*100)}%`);range('look',Math.round(sensitivity*100),`${sensitivity.toFixed(1)}×`);
  for(const [id,value]of Object.entries({'setting-motion':reducedMotion,'setting-night':getNight(),'setting-fps':showFps,'setting-invert-y':invertY,'setting-hints':hints}))$(id).checked=value;
  document.querySelectorAll('.switch-control input').forEach(input=>input.nextElementSibling.textContent=english()?(input.checked?'On':'Off'):(input.checked?'開':'關'));
  $('setting-quality').disabled=getRenderMode()!=='3d';$('setting-look').disabled=getRenderMode()!=='3d';$('setting-invert-y').disabled=getRenderMode()!=='3d';
  $('setting-renderer').textContent=getRenderMode()==='3d'?(english()?'WebGL 3D · Adaptive':'WebGL 3D · 自動畫質'):(english()?'Canvas 2D · Compatibility':'Canvas 2D · 相容模式');
 }
 function translate(){
  document.querySelectorAll('[data-zh][data-en]').forEach(el=>el.textContent=el.dataset[language]);
  $('welcome').lang=english()?'en':'zh-Hant';for(const id of [...panels,'pause-dialog'])$(id).lang=$('welcome').lang;
  for(const [id,labels]of Object.entries({master:['主音量','Master volume'],music:['音樂音量','Music volume'],effects:['音效音量','Sound effects'],hud:['介面大小','HUD size'],look:['視角靈敏度','Look sensitivity']}))$(`setting-${id}`).setAttribute('aria-label',labels[english()?1:0]);
  $('menu-language').setAttribute('aria-label',english()?'Switch to Chinese menus':'切換為英文選單');document.querySelectorAll('[data-front-back]').forEach(b=>b.setAttribute('aria-label',english()?'Back':'返回'));
  $('help-done').textContent=english()?'Back':'返回';controls.setLanguage(language);updateCharacters();syncSettings();lastTip=-1;updateTip();lastArrivalStage='';renderArrival();
 }
 function applyPreferences(){document.body.style.setProperty('--hud-scale',String(hudScale));document.body.classList.toggle('hide-tutorial-hints',!hints);$('fps-readout').hidden=!showFps;getRenderer()?.setLookSettings?.({sensitivity,invertY});}
 function setMenuView(view){menuView=view;getRenderer()?.setMenuView?.(view);}
 function clearPanel(){document.body.classList.remove('front-submenu');delete document.body.dataset.frontPanel;setMenuView('city');}
 function render(){const {phase,orbit}=timeline.snapshot();if(previousPhase!==phase){document.body.dataset.frontPhase=phase;$('skip-intro').hidden=phase!=='intro';$('welcome').hidden=phase==='playing';}document.body.classList.toggle('menu-reduced-motion',reducedMotion);const renderer=getRenderer();if(renderer!==appliedRenderer){renderer?.setQuality?.(quality);renderer?.setAppearance?.(appearance);renderer?.setMenuView?.(menuView);renderer?.setLookSettings?.({sensitivity,invertY});appliedRenderer=renderer;}renderer?.setIntroProgress?.(phase==='playing'?null:orbit);if(previousPhase!==phase&&phase==='menu'&&document.activeElement===$('skip-intro'))choices[activeChoice].focus({preventScroll:true});previousPhase=phase;updateTip();}
 function renderPause(){
  const state=getJourneySnapshot();if(!state?.player)return;
  $('pause-character-name').textContent=appearance==='river'?(english()?'Qing':'小晴'):(english()?'Cheng':'阿澄');$('pause-weather').textContent=getNight()?(english()?'Night · 20°':'夜色 · 20°'):(english()?'Day · 24°':'晴 · 24°');$('pause-coins').textContent=`${state.coins||0} ${english()?'COINS':'幣'}`;
  $('pause-district').textContent=$('map-district').textContent;$('pause-location-note').textContent=english()?'An imagined district · Your own pace':'想像街區 · 隨心漫遊';$('pause-quest-name').textContent=$('destination').textContent;$('pause-quest-clue').textContent=$('clue').textContent;$('pause-recent-tip').textContent=$('toast').textContent||TIPS[0][english()?1:0];
  $('stats-distance').textContent=`${(state.player.distance/10000).toFixed(2)} km`;$('stats-stamps').textContent=`${state.stamps?.length||0} / ${state.landmarkCount||6}`;$('stats-coins').textContent=String(state.coins||0);const stages=english()?{available:'Not accepted',pickup:'Collecting tea',carrying:'On the way',deliver:'Ready to deliver',completed:'Completed'}:{available:'尚未接取',pickup:'等待取茶',carrying:'配送途中',deliver:'等待交付',completed:'已完成'};$('stats-quest').textContent=state.sceneId==='xitun'?(english()?'Taipei quest paused':'台北委託保留'):stages[state.quest?.stage]||'—';$('stats-mode').textContent=state.mode==='walking'?(english()?'Walking':'步行'):(english()?'Riding':'騎乘');
  if($('pause-dialog').open)drawMap($('pause-minimap'),{...state,target:state.objective||null});
 }
 function back(){if(pauseReturnId&&$(pauseReturnId).open){pauseReturnId=null;clearPanel();openDialog('pause-dialog');renderPause();panelOpener?.focus({preventScroll:true});return;}pauseReturnId=null;closeDialog();clearPanel();if(!isPlaying())(panelOpener||choices[activeChoice]).focus({preventScroll:true});}
 function openPanel(id,opener,fromPause=false){if(arrival.snapshot().active)return;timeline.skip();panelOpener=opener;pauseReturnId=null;if(id==='settings-dialog')$('replay-intro').hidden=fromPause;render();translate();openDialog(id);pauseReturnId=fromPause?id:null;if(!isPlaying()){document.body.classList.add('front-submenu');document.body.dataset.frontPanel=id;}setMenuView(id==='character-dialog'?'character':'city');if(id==='stats-dialog')renderPause();if(id==='map-dialog'){const state=getJourneySnapshot();if(state?.player)drawMap($('large-map'),{...state,target:state.objective||null},true);}}
 function renderArrival(){const state=arrival.snapshot();$('arrival-intro').hidden=!state.active;document.body.classList.toggle('cinematic',state.active);if(!state.active){delete document.body.dataset.arrivalStage;getRenderer()?.setArrivalProgress?.(null);return;}document.body.dataset.arrivalStage=state.stage;getRenderer()?.setArrivalProgress?.(reducedMotion?.5:state.progress);if(lastArrivalStage===state.stage)return;lastArrivalStage=state.stage;$('arrival-speaker').textContent=english()?'Amu':'阿沐';$('arrival-subtitle').textContent=state.stage==='arriving'?(english()?'The rain has stopped. A warm cup is waiting around the corner.':'雨停了，轉個彎，就是一杯熱茶。'):(english()?'Hey, rider! The tea is ready. Come over when you are ready for a little delivery.':'欸，旅人！茶剛泡好，準備好了就過來，幫我送一份暖意吧。');}
 function finishArrival(){arrivalSeen=true;persist();renderArrival();setCinematicActive(false);resetHints(false);$('world').focus?.({preventScroll:true});}
 function skipArrival(){if(!arrival.skip())return;finishArrival();}
 function start(){if(!timeline.play())return;closeDialog();clearPanel();render();onStart();translate();if(!arrivalSeen&&shouldPlayArrival()){arrival.begin();lastArrivalStage='';setCinematicActive(true);renderArrival();$('skip-arrival').focus({preventScroll:true});}}
 function returnToMenu(){if(!timeline.returnToMenu())return;if(arrival.snapshot().active){arrival.skip();renderArrival();setCinematicActive(false);}closeDialog();clearPanel();onReturn();selectChoice(0);render();translate();choices[0].focus({preventScroll:true});}
 function replay(){if(isPlaying())return;closeDialog();clearPanel();timeline.replay();lastTime=null;render();if(timeline.snapshot().phase==='intro')$('skip-intro').focus({preventScroll:true});}
 function resetHints(savePreference=true){if(savePreference){hints=true;persist();}applyPreferences();onResetHints();const touchView=Boolean(window.matchMedia?.('(pointer: coarse)').matches)||window.innerWidth<=650;$('ride-hint').innerHTML=touchView?(english()?'Hold forward and steering below. Tap the vehicle button to get on or off.':'按住下方前進與方向鍵，點「上／下車」切換移動方式。'):(english()?'<span>W / ↑</span> Move &nbsp; <span>A D / ← →</span> Steer':'<span>W / ↑</span> 出發 &nbsp; <span>A D / ← →</span> 轉向');document.body.classList.add('show-tutorial-hints');clearTimeout(hintTimer);hintTimer=setTimeout(()=>document.body.classList.remove('show-tutorial-hints'),8000);if(savePreference){syncSettings();notify(english()?'Tutorial hints will appear when you resume.':'繼續遊戲時會重新顯示操作提示');}}
 function fullscreenLabel(){$('menu-fullscreen').setAttribute('aria-label',document.fullscreenElement?(english()?'Exit fullscreen':'離開全螢幕'):(english()?'Enter fullscreen':'進入全螢幕'));$('menu-fullscreen').setAttribute('aria-pressed',String(Boolean(document.fullscreenElement)));$('pause-fullscreen').setAttribute('aria-pressed',String(Boolean(document.fullscreenElement)));}
 async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw new Error('unavailable');}catch{const message=english()?'Fullscreen is unavailable here; you can still play.':'這個瀏覽器不支援全螢幕，仍可直接遊玩';notify(message);$('pause-fullscreen-status').textContent=message;}fullscreenLabel();}

 $('start').onclick=start;$('skip-intro').onclick=()=>{timeline.skip();render();};$('skip-arrival').onclick=skipArrival;
 for(const [button,panel]of Object.entries({'menu-character':'character-dialog','menu-settings':'settings-dialog','menu-controls':'help-dialog','menu-about':'about-dialog','pause-settings':'settings-dialog','pause-controls':'help-dialog','pause-map':'map-dialog','pause-stats':'stats-dialog'}))$(button).onclick=()=>openPanel(panel,$(button),button.startsWith('pause-'));
 $('return-menu').onclick=returnToMenu;$('help-done').onclick=back;$('replay-intro').onclick=replay;$('reset-hints').onclick=()=>resetHints();$('menu-fullscreen').onclick=fullscreen;$('pause-fullscreen').onclick=fullscreen;
 document.querySelectorAll('[data-appearance]').forEach(button=>button.onclick=()=>{appearance=button.dataset.appearance==='river'?'river':'sunset';getRenderer()?.setAppearance?.(appearance);updateCharacters();persist();});
 function setLanguage(value){language=value==='en'?'en':'zh';persist();translate();fullscreenLabel();}
 $('menu-language').onclick=()=>setLanguage(english()?'zh':'en');$('setting-language').onchange=event=>setLanguage(event.target.value);
 $('setting-quality').onchange=event=>{quality=QUALITY.includes(event.target.value)?event.target.value:'auto';getRenderer()?.setQuality?.(quality);persist();syncSettings();};
 for(const channel of ['master','music','effects'])$(`setting-${channel}`).oninput=event=>{audio.setVolume(channel,Number(event.target.value)/100);range(channel,event.target.value,`${Math.round(audio.snapshot()[channel]*100)}%`);persist();};
 $('setting-hud').oninput=event=>{hudScale=bounded(Number(event.target.value)/100,.75,1.25,1);range('hud',Math.round(hudScale*100),`${Math.round(hudScale*100)}%`);applyPreferences();persist();};
 $('setting-look').oninput=event=>{sensitivity=bounded(Number(event.target.value)/100,.3,2.5,1);range('look',Math.round(sensitivity*100),`${sensitivity.toFixed(1)}×`);applyPreferences();persist();};
 $('setting-invert-y').onchange=event=>{invertY=event.target.checked;applyPreferences();persist();syncSettings();};$('setting-fps').onchange=event=>{showFps=event.target.checked;applyPreferences();persist();syncSettings();};$('setting-hints').onchange=event=>{hints=event.target.checked;applyPreferences();persist();syncSettings();};
 $('setting-motion').onchange=event=>{reducedMotion=event.target.checked;timeline.setReducedMotion(reducedMotion);persist();render();syncSettings();};$('setting-night').onchange=event=>{if(getNight()!==event.target.checked)setNight();syncSettings();};
 document.addEventListener('fullscreenchange',fullscreenLabel);
 const activateAudio=()=>audio.activate().then(active=>{if(active)audio.click();});window.addEventListener('pointerdown',activateAudio);
 const activateAudioKey=event=>{if(!event.repeat&&['Enter','Space'].includes(event.code))activateAudio();};window.addEventListener('keydown',activateAudioKey,true);
 const silenceAudio=()=>{if(document.hidden)audio.silence();};document.addEventListener('visibilitychange',silenceAudio);
 document.querySelectorAll('[data-front-back]').forEach(button=>button.onclick=back);document.querySelectorAll('#map-dialog [data-close]').forEach(button=>button.onclick=back);
 for(const id of panels)$(id).addEventListener('cancel',event=>{event.preventDefault();event.stopImmediatePropagation();back();},true);
 for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('close',()=>{if(pauseReturnId===dialog.id&&!dialog.open)pauseReturnId=null;if(!document.querySelector('dialog[open]'))clearPanel();});
 const pauseObserver=new window.MutationObserver(()=>{if($('pause-dialog').open){renderPause();translate();}});pauseObserver.observe($('pause-dialog'),{attributes:true,attributeFilter:['open']});
 choices.forEach((button,index)=>{button.addEventListener('pointerenter',()=>selectChoice(index));button.addEventListener('focus',()=>selectChoice(index));});
 const pauseChoices=[...document.querySelectorAll('.pause-choice')];pauseChoices.forEach(button=>{const highlight=()=>pauseChoices.forEach(other=>other.classList.toggle('active',other===button));button.addEventListener('pointerenter',highlight);button.addEventListener('focus',highlight);});
 function onKey(event){
  if(arrival.snapshot().active){event.stopImmediatePropagation();if(event.code==='Escape'||event.code==='Enter'){event.preventDefault();if(!event.repeat)skipArrival();}return;}
  if($('pause-dialog').open&&['ArrowUp','ArrowDown','Home','End'].includes(event.code)){event.preventDefault();event.stopImmediatePropagation();const buttons=[...document.querySelectorAll('.pause-choice')],index=buttons.indexOf(document.activeElement),next=event.code==='Home'?0:event.code==='End'?buttons.length-1:(index+(event.code==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();return;}
  if(isPlaying())return;if(document.querySelector('dialog[open]'))return;
  if(event.code==='Escape'&&timeline.snapshot().phase==='intro'){event.preventDefault();event.stopImmediatePropagation();timeline.skip();render();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.code)){event.preventDefault();event.stopImmediatePropagation();timeline.skip();render();selectChoice(event.code==='Home'?0:event.code==='End'?choices.length-1:activeChoice+(event.code==='ArrowDown'?1:-1),true);return;}
  if(event.code==='Enter'&&(document.activeElement===document.body||document.activeElement===$('world'))){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)choices[activeChoice].click();return;}
  if(['KeyW','KeyA','KeyS','KeyD','KeyP','KeyM','KeyN','KeyR','KeyF','KeyE','ArrowLeft','ArrowRight','Space'].includes(event.code))event.stopImmediatePropagation();
 }
 window.addEventListener('keydown',onKey,true);
 function frame(timestamp){if(disposed)return;const clip=arrival.snapshot().active,gameAudio=getAudioState();audio.update({...gameAudio,playing:isPlaying()&&!clip,paused:Boolean(gameAudio.paused)&&!clip,hidden:document.hidden});if(document.hidden){lastTime=null;fpsMs=0;fpsFrames=0;}else{const dt=lastTime===null?0:Math.max(0,timestamp-lastTime);lastTime=timestamp;timeline.advance(dt);if(!isPlaying())menuTime+=dt;if(arrival.advance(dt))finishArrival();renderArrival();render();fpsMs+=dt;fpsFrames++;if(fpsMs>=500){measuredFps=Math.round(fpsFrames*1000/fpsMs);fpsMs=0;fpsFrames=0;if(showFps){const fps=getJourneySnapshot()?.performance?.fps;$('fps-readout').textContent=`FPS ${Number.isFinite(fps)&&fps>0?Math.round(fps):measuredFps}`;}}dashboardClock+=dt;if(dashboardClock>500){dashboardClock=0;if($('pause-dialog').open||$('stats-dialog').open)renderPause();}}requestAnimationFrame(frame);}
 timeline.ready();applyPreferences();translate();fullscreenLabel();render();requestAnimationFrame(frame);
 return Object.freeze({snapshot:()=>({...timeline.snapshot(),language,appearance,quality,showFps,hudScale,sensitivity,invertY,hints,arrivalSeen,arrival:arrival.snapshot(),controls:controls.snapshot(),audio:audio.snapshot()}),start,returnToMenu,replay,skipArrival,
  dispose(){disposed=true;clearTimeout(hintTimer);pauseObserver.disconnect();audio.dispose();window.removeEventListener('keydown',onKey,true);window.removeEventListener('keydown',activateAudioKey,true);window.removeEventListener('pointerdown',activateAudio);document.removeEventListener('visibilitychange',silenceAudio);document.removeEventListener('fullscreenchange',fullscreenLabel);}});
}
