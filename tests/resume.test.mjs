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
localStorage.setItem('taipei-ride:v1',JSON.stringify({stamps:['tower','hill','hall','temple','river'],distance:2345,night:true}));
await import('../src/main.js');
const $=id=>document.getElementById(id),snapshot=()=>window.taipeiRide.snapshot();
function key(type,code){window.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));}
function frame(n=1){for(let i=0;i<n;i++){clock+=20;const callbacks=queuedFrames;queuedFrames=[];assert.ok(callbacks.length);for(const fn of callbacks)fn(clock);}}
function click(id){$(id).click();frame();}

test('saved journey restores five stamps, distance, night, and the remaining destination',()=>{
 assert.equal(snapshot().stamps.length,5);assert.equal(snapshot().player.distance,2345);assert.equal(snapshot().night,true);assert.equal(snapshot().target,'market');
});
test('sixth stamp completes the journey and enables free roaming',()=>{
 click('start');key('keydown','KeyW');frame(80);key('keyup','KeyW');key('keydown','Space');frame(40);key('keyup','Space');key('keydown','KeyE');frame();
 assert.equal(snapshot().stamps.length,6);assert.equal(snapshot().target,null);assert.equal($('stamp-title').textContent,'六站風景，收藏完成！');assert.equal($('destination').textContent,'自由漫遊');click('next-stop');assert.equal(snapshot().paused,false);
 const before=snapshot().player.distance;key('keydown','KeyW');frame(20);key('keyup','KeyW');assert.ok(snapshot().player.distance>before);
});
