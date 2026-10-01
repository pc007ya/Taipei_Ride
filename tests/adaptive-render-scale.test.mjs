import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {AdaptiveRenderScale,Renderer3D,createScooter} from '../src/renderer3d.js';
import {START} from '../src/world.js';

function clock(controller){let now=0;controller.sample(now);return {tick(count,ms){for(let i=0;i<count;i++){now+=ms;controller.sample(now);}return now;},sample(ms,visible=true){now+=ms;return controller.sample(now,visible);}};}
function fakeGPU(){return {ratio:1,width:1,height:1,style:{},renderCalls:0,setPixelRatio(n){this.ratio=n;},getPixelRatio(){return this.ratio;},setSize(w,h){this.width=w;this.height=h;this.style={width:`${w}px`,height:`${h}px`};},getDrawingBufferSize(v){return v.set(Math.floor(this.width*this.ratio),Math.floor(this.height*this.ratio));},render(scene,camera){this.renderCalls++;scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}};}
function rendererHarness(pixelRatio=1){const r=Object.create(Renderer3D.prototype);r.renderer=fakeGPU();r.renderScale=new AdaptiveRenderScale(pixelRatio);r.camera=new T.PerspectiveCamera(58,1.5,1,1800);r.resize(1440,960,pixelRatio);return r;}

test('adaptive quality initializes from DPR with a bounded ceiling',()=>{
 assert.equal(new AdaptiveRenderScale(1).scale,1);assert.equal(new AdaptiveRenderScale(3).scale,1.6);
 for(const value of [NaN,Infinity,0,-1])assert.equal(new AdaptiveRenderScale(value).scale,1);
 const c=new AdaptiveRenderScale(1),time=clock(c);time.tick(200,16);assert.equal(c.scale,1);
 const fractional=new AdaptiveRenderScale(1.234567),f=clock(fractional);f.tick(30,100);f.tick(7000,16);assert.ok(fractional.scale<=1.234567,'Rounding must never exceed a fractional DPR ceiling');
});

test('sustained real slow frames progressively lower scale but never below 0.55',()=>{
 const c=new AdaptiveRenderScale(1),time=clock(c);time.tick(29,100);assert.equal(c.scale,1,'No drop before a full three seconds');time.tick(1,100);assert.equal(c.scale,.8);
 time.tick(30,100);assert.equal(c.scale,.64);time.tick(30,100);assert.equal(c.scale,.55);time.tick(300,100);assert.equal(c.scale,.55);
 const extreme=new AdaptiveRenderScale(1),slow=clock(extreme);slow.tick(6,3000);assert.equal(extreme.scale,.8,'Even very low visible FPS must adapt');
});

test('short hitches, hidden tabs and bad timestamps cannot masquerade as sustained low FPS',()=>{
 const c=new AdaptiveRenderScale(1),time=clock(c);time.tick(12,100);time.tick(120,16);assert.equal(c.scale,1);
 const isolated=new AdaptiveRenderScale(1),t=clock(isolated);t.sample(50000);t.tick(5,16);assert.equal(isolated.scale,1,'A single long debugger/OS hitch is not continuous GPU load');
 t.sample(100000,false);t.tick(200,16);assert.equal(isolated.scale,1);
 isolated.sample(NaN);isolated.sample(0);isolated.sample(-1);assert.equal(isolated.scale,1);
});

test('quality recovers only after long fast-frame hysteresis and neutral load resets recovery',()=>{
 const c=new AdaptiveRenderScale(1),time=clock(c);time.tick(90,100);assert.equal(c.scale,.55);
 time.tick(375,16);assert.equal(c.scale,.55);time.tick(100,30);assert.equal(c.scale,.55,'Neutral 33 FPS does not oscillate the scale');
 time.tick(600,16);assert.equal(c.scale,.55,'Less than twelve fresh fast seconds does not restore quality');
 time.tick(160,16);assert.equal(c.scale,.65);time.tick(4000,16);assert.equal(c.scale,1,'Recovery never exceeds the device ceiling');
});

test('scaling changes only drawing buffer resolution, preserving CSS dimensions and camera projection',()=>{
 const r=rendererHarness(2),before=r.camera.projectionMatrix.elements.slice();assert.deepEqual(r.getRenderMetrics(),{effectiveRenderScale:1.6,drawingBufferWidth:2304,drawingBufferHeight:1536,renderCssWidth:1440,renderCssHeight:960});
 r.updateRenderScale(0,true);for(let t=100;t<=3000;t+=100)r.updateRenderScale(t,true);
 assert.equal(r.getRenderMetrics().effectiveRenderScale,1.28);assert.equal(r.getRenderMetrics().drawingBufferWidth,1843);assert.equal(r.getRenderMetrics().drawingBufferHeight,1228);
 assert.deepEqual(r.renderer.style,{width:'1440px',height:'960px'});assert.deepEqual(r.camera.projectionMatrix.elements,before);
 r.resize(390,844,1);assert.equal(r.getRenderMetrics().effectiveRenderScale,1);assert.equal(r.camera.aspect,390/844);assert.equal(r.camera.fov,66);assert.deepEqual(r.renderer.style,{width:'390px',height:'844px'});
 r.updateRenderScale(4000,true);for(let t=4100;t<=7000;t+=100)r.updateRenderScale(t,true);assert.equal(r.renderScale.scale,.8);
 r.resize(844,390,2);assert.equal(r.renderScale.scale,.8,'A viewport/DPR resize preserves an already reduced quality level');assert.equal(r.camera.aspect,844/390);assert.equal(r.camera.fov,58);
 assert.equal(r.getRenderMetrics().drawingBufferWidth,675);assert.equal(r.getRenderMetrics().drawingBufferHeight,312);
 const copy=r.getRenderMetrics();copy.effectiveRenderScale=900;assert.equal(r.getRenderMetrics().effectiveRenderScale,.8,'QA metrics are detached read-only observations');
});

test('actual render loop measures wall time while paused and keeps day/night and walking poses intact',()=>{
 const r=rendererHarness(1);globalThis.innerWidth=1440;globalThis.innerHeight=960;
 Object.assign(r,{time:0,lastNight:null,scene:new T.Scene(),cameraBlockers:[],light:new T.HemisphereLight(),sun:new T.DirectionalLight(),glass:new T.MeshStandardMaterial(),lampMaterial:new T.MeshStandardMaterial(),softOccluders:[],scooter:createScooter(),carMeshes:[],markers:[],pedestrians:[],heading:START.angle,look:new T.Vector3(800,16,515)});
 r.scene.background=new T.Color();r.scene.fog=new T.Fog(0,0,1);r.scene.add(r.scooter);r.camera.position.set(800,85,660);
 let wallMs=0;r.updateRenderScale=function(){return Renderer3D.prototype.updateRenderScale.call(this,wallMs,true);};
 const state={player:{...START,speed:0},vehicle:{...START},mode:'riding',quest:{stage:'deliver'},traffic:[],night:false,stamps:[],target:null};
 r.render(state,0);for(let i=1;i<=30;i++){wallMs+=100;if(i===10)state.night=true;if(i===20){state.mode='walking';state.player.x=820;}r.render(state,0);}
 assert.equal(r.renderScale.scale,.8);assert.equal(r.time,0,'Rendering quality never advances the simulation clock');assert.equal(r.renderer.renderCalls,31,'Quality changes keep using the real render path');
 assert.equal(r.lastNight,true);assert.equal(r.scene.background.getHex(),0x112835);assert.equal(r.scooter.position.x,800);assert.equal(r.walker.position.x,820);assert.equal(r.walker.visible,true);assert.equal(r.walker.getObjectByName('delivery-cargo').visible,true);
 state.mode='riding';state.player.x=800;state.night=false;wallMs+=100;r.render(state,0);assert.equal(r.walker.visible,false);assert.equal(r.lastNight,false);assert.equal(r.renderScale.scale,.8);assert.equal(r.getRenderMetrics().renderCssWidth,1440);
});
