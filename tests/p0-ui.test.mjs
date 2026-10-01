import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'https://taipei-ride.test/',pretendToBeVisual:true});
const {window}=dom;
for(const k of ['window','document','location','localStorage','HTMLButtonElement'])globalThis[k]=window[k];
globalThis.devicePixelRatio=1;globalThis.innerWidth=1440;globalThis.innerHeight=960;
let queuedFrames=[],clock=0;
globalThis.requestAnimationFrame=fn=>{queuedFrames.push(fn);return queuedFrames.length;};
const noOp=()=>{};const gradient={addColorStop:noOp};const ctx=new Proxy({createRadialGradient:()=>gradient,measureText:t=>({width:t.length*10})},{get:(o,k)=>k in o?o[k]:noOp,set:(o,k,v)=>(o[k]=v,true)});
window.HTMLCanvasElement.prototype.getContext=function(kind){return kind==='2d'?ctx:null;};
window.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return {width:172,height:172,left:0,top:0};};
window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};
window.HTMLElement.prototype.setPointerCapture=noOp;
localStorage.setItem('taipei-ride:v2',JSON.stringify({version:2,mode:'riding',player:{x:160,y:1010,angle:Math.PI/2,distance:1200},vehicle:{x:160,y:1010,angle:Math.PI/2},quest:{stage:'deliver',rideDistance:100,rewardClaimed:false},coins:0,stamps:[],activity:'quest',night:false}));
await import('../src/main.js');
const $=id=>document.getElementById(id),snapshot=()=>window.taipeiRide.snapshot();
function key(type,code){window.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));}
function frame(n=1){for(let i=0;i<n;i++){clock+=20;const callbacks=queuedFrames;queuedFrames=[];assert.ok(callbacks.length);for(const fn of callbacks)fn(clock);}}
function click(id){$(id).click();frame();}

test('F/E and touch button integrate walking delivery, parked vehicle and reward save',()=>{
 click('start');key('keydown','KeyE');assert.equal(snapshot().quest.stage,'deliver');assert.equal(snapshot().coins,0);
 const parked={...snapshot().vehicle};key('keydown','KeyF');frame();assert.equal(snapshot().mode,'walking');assert.deepEqual(snapshot().vehicle,parked);assert.notEqual(snapshot().player.x,snapshot().vehicle.x);assert.equal($('travel-mode').textContent,'步行探索');
 key('keydown','KeyE');frame();assert.equal(snapshot().quest.stage,'completed');assert.equal(snapshot().coins,300);assert.equal($('stamp-dialog').open,true);assert.equal($('coin-count').textContent,'300');key('keydown','KeyE');assert.equal(snapshot().coins,300);
 const saved=JSON.parse(localStorage.getItem('taipei-ride:v2'));assert.equal(saved.version,2);assert.equal(saved.mode,'walking');assert.equal(saved.quest.rewardClaimed,true);assert.notEqual(saved.player.x,saved.vehicle.x);
 click('next-stop');assert.equal(snapshot().activity,'explore');click('vehicle-action');assert.equal(snapshot().mode,'riding');assert.equal(snapshot().player.x,parked.x);assert.equal(snapshot().coins,300);
});
test('map can retrack main quest and full reset clears all P0 progression together',()=>{
 click('open-map');click('track-quest');assert.equal(snapshot().activity,'quest');assert.equal(snapshot().paused,false);assert.equal($('destination').textContent,'送暖任務完成');
 key('keydown','KeyP');click('reset-trip');click('confirm-reset');const s=snapshot();assert.equal(s.mode,'riding');assert.equal(s.quest.stage,'available');assert.equal(s.coins,0);assert.deepEqual(s.stamps,[]);assert.equal(s.player.distance,0);assert.deepEqual([s.player.x,s.player.y,s.vehicle.x,s.vehicle.y],[800,515,800,515]);assert.equal(s.night,false);assert.equal(s.activity,'quest');
 const saved=JSON.parse(localStorage.getItem('taipei-ride:v2'));assert.equal(saved.coins,0);assert.equal(saved.quest.stage,'available');
});
