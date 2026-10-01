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
Object.defineProperty(window.Storage.prototype,'getItem',{value(){throw new Error('Storage blocked');}});
Object.defineProperty(window.Storage.prototype,'setItem',{value(){throw new Error('Storage blocked');}});
await import('../src/main.js');
const $=id=>document.getElementById(id),snapshot=()=>window.taipeiRide.snapshot();
function key(type,code){window.dispatchEvent(new window.KeyboardEvent(type,{code,bubbles:true,cancelable:true}));}
function frame(n=1){for(let i=0;i<n;i++){clock+=20;const callbacks=queuedFrames;queuedFrames=[];assert.ok(callbacks.length);for(const fn of callbacks)fn(clock);}}
function click(id){$(id).click();frame();}

test('blocked storage has a persistent warning before play and warns once on save',()=>{
 assert.equal(snapshot().storageAvailable,false);assert.equal($('storage-notice').hidden,false);assert.match(document.querySelector('.welcome-note').textContent,/無法儲存/);
 click('start');frame(260);assert.match($('toast').textContent,/重新整理後進度不會保留/);
 $('toast').textContent='subsequent gameplay message';frame(260);assert.equal($('toast').textContent,'subsequent gameplay message');assert.equal($('storage-notice').hidden,false);
});
