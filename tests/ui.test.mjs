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
await import('../src/main.js');
const $=id=>document.getElementById(id),snapshot=()=>window.taipeiRide.snapshot();
function key(type,code){window.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));}
function frame(n=1){for(let i=0;i<n;i++){clock+=20;const callbacks=queuedFrames;queuedFrames=[];assert.ok(callbacks.length);for(const fn of callbacks)fn(clock);}}
function click(id){$(id).click();frame();}

test('unsupported WebGL automatically falls back with a clear compatibility label',()=>{
 assert.equal(snapshot().started,false);assert.equal(snapshot().renderMode,'2d');for(const key of ['effectiveRenderScale','drawingBufferWidth','drawingBufferHeight','renderCssWidth','renderCssHeight'])assert.equal(snapshot()[key],null);assert.equal($('render-mode').textContent,'2D 相容模式');assert.equal($('stamp-rail').children.length,6);frame();
});
test('keyboard driving reaches first stamp; collection advances mission and saves',()=>{
 click('start');document.querySelector('#stamp-rail button').click();assert.equal(snapshot().started,true);key('keydown','KeyW');frame(80);key('keyup','KeyW');key('keydown','Space');frame(40);key('keyup','Space');
 const p=snapshot().player;assert.ok(p.y<455&&p.y>365,`Reached market: y=${p.y}`);assert.ok(Math.abs(p.speed)<8);key('keydown','KeyE');frame();assert.deepEqual(snapshot().stamps,['market']);assert.equal(snapshot().target,'tower');assert.equal($('stamp-dialog').open,true);assert.deepEqual(JSON.parse(localStorage.getItem('taipei-ride:v2')).stamps,['market']);
 click('next-stop');assert.equal(snapshot().paused,false);
});
test('map changes destination and cleanly resumes without losing stamps',()=>{
 key('keydown','KeyM');frame();assert.equal($('map-dialog').open,true);const buttons=$('map-destinations').querySelectorAll('button');buttons[4].click();frame();assert.equal(snapshot().target,'temple');assert.equal(snapshot().paused,false);assert.deepEqual(snapshot().stamps,['market']);
});
test('pause clears held throttle and reset vehicle preserves progress',()=>{
 key('keydown','KeyW');frame(15);key('keydown','KeyP');frame();const p=snapshot().player;frame(40);assert.deepEqual(snapshot().player,p);click('resume');const speed=snapshot().player.speed;frame(20);assert.ok(snapshot().player.speed<speed);key('keydown','KeyR');frame();assert.equal(snapshot().player.x,800);assert.equal(snapshot().player.y,515);assert.deepEqual(snapshot().stamps,['market']);
});
test('night mode persists and touch pointer cancellation releases throttle',()=>{
 key('keydown','KeyN');assert.equal(snapshot().night,true);assert.equal(JSON.parse(localStorage.getItem('taipei-ride:v2')).night,true);
 const throttle=document.querySelector('[data-control="throttle"]');throttle.dispatchEvent(new window.Event('pointerdown',{bubbles:true,cancelable:true}));frame(25);assert.ok(snapshot().player.speed>0);throttle.dispatchEvent(new window.Event('pointercancel',{bubbles:true}));const speed=snapshot().player.speed;frame(25);assert.ok(snapshot().player.speed<speed);
});
test('reset confirmation cancel retains stamps; explicit confirmation clears journey',()=>{
 key('keydown','KeyP');click('reset-trip');assert.equal($('reset-dialog').open,true);click('cancel-reset');assert.deepEqual(snapshot().stamps,['market']);click('reset-trip');click('confirm-reset');assert.deepEqual(snapshot().stamps,[]);assert.equal(snapshot().player.distance,0);assert.equal(snapshot().target,'market');assert.equal(snapshot().paused,false);
});
test('window blur pauses active play and clears inputs',()=>{
 key('keydown','KeyW');window.dispatchEvent(new window.Event('blur'));assert.equal(snapshot().paused,true);assert.equal($('pause-dialog').open,true);
});
