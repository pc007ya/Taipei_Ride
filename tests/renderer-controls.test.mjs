import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {Renderer3D,AdaptiveRenderScale,createScooter,createWalker} from '../src/renderer3d.js';
import {createLookController} from '../src/camera-controls.js';
import {START} from '../src/world.js';
function harness(){
 globalThis.innerWidth=1440;globalThis.innerHeight=960;globalThis.devicePixelRatio=2;
 const r=Object.create(Renderer3D.prototype),gpu={ratio:1,w:1440,h:960,info:{render:{calls:12,triangles:3000}},setPixelRatio(n){this.ratio=n;},getPixelRatio(){return this.ratio;},setSize(w,h){this.w=w;this.h=h;},getDrawingBufferSize(v){return v.set(Math.floor(this.w*this.ratio),Math.floor(this.h*this.ratio));},render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);}};
 Object.assign(r,{time:0,lastNight:null,scene:new T.Scene(),camera:new T.PerspectiveCamera(58,1.5,1,1800),cameraBlockers:[],light:new T.HemisphereLight(),sun:new T.DirectionalLight(),glass:new T.MeshStandardMaterial(),lampMaterial:new T.MeshStandardMaterial(),softOccluders:[],scooter:createScooter(),carMeshes:[],markers:[],pedestrians:[],questResidents:[createWalker()],heading:START.angle,look:new T.Vector3(800,10,515),lookController:createLookController(),renderScale:new AdaptiveRenderScale(2),renderer:gpu});
 r.scene.background=new T.Color();r.scene.fog=new T.Fog(0,0,1);r.scene.add(r.scooter,r.questResidents[0]);r.questResidents[0].position.set(829,0,410);r.questResidents[0].rotation.y=Math.PI;r.resize();r.resetCamera(START);
 const state={player:{...START,speed:0},vehicle:{...START},mode:'riding',quest:{stage:'available'},traffic:[],night:false,stamps:[],target:null};return {r,state};
}

test('ultra raises the permitted pixel ratio and lower presets change actual buffer without changing state',()=>{
 const {r,state}=harness(),saved=JSON.stringify(state);r.setQuality('ultra');assert.equal(r.getRenderMetrics().effectiveRenderScale,2);assert.equal(r.getRenderMetrics().drawingBufferWidth,2880);r.setQuality('low');assert.equal(r.getRenderMetrics().effectiveRenderScale,.75);assert.equal(r.getRenderMetrics().renderCssWidth,1440);r.setQuality('auto');assert.equal(r.getRenderMetrics().effectiveRenderScale,1.6);assert.equal(JSON.stringify(state),saved);
});

test('camera look controls change rendering only and reset preserves user look preferences',()=>{
 const {r,state}=harness(),saved=JSON.stringify(state),before=r.camera.position.clone();r.setLookSettings({sensitivity:1.5,invertY:true});r.adjustLook(120,25);r.render(state,.04);const view=r.getViewMetrics();assert.ok(Math.abs(view.yaw-.72)<1e-8&&view.pitch<0);assert.ok(r.camera.position.distanceTo(before)>1);assert.equal(JSON.stringify(state),saved);r.resetCamera(state.player);assert.equal(r.getViewMetrics().yaw,0);assert.equal(r.getViewMetrics().sensitivity,1.5);assert.equal(r.getViewMetrics().invertY,true);
});

test('arrival camera visits the actual quest resident and waves without moving or rewarding the player',()=>{
 const {r,state}=harness(),saved=JSON.stringify(state);r.setArrivalProgress(.5);r.render(state,0);assert.ok(r.camera.position.distanceTo(new T.Vector3(805,17,428))<1e-7);assert.ok(r.questResidents[0].getObjectByName('right-arm').rotation.z>2);assert.equal(JSON.stringify(state),saved);assert.equal(r.time,0);
 r.setArrivalProgress(null);r.resetCamera(state.player);r.render(state,0);assert.equal(r.questResidents[0].getObjectByName('right-arm').rotation.z,0);assert.equal(r.getViewMetrics().arrivalProgress,null);assert.equal(JSON.stringify(state),saved);
});

test('character preview uses distinct cached models and a menu-only dusk does not persist as night',()=>{
 const {r,state}=harness(),saved=JSON.stringify(state);r.setAppearance('river');r.setMenuView('character');r.setIntroProgress(.3);r.render(state,0);assert.equal(r.scooter.userData.character,'female');assert.equal(r.previewCharacter.userData.character,'female');assert.equal(r.previewCharacter.visible,true);assert.equal(r.scooter.visible,false);const count=r.scene.children.length;r.setAppearance('river');assert.equal(r.scene.children.length,count);
 r.setAppearance('sunset');r.setMenuView('city');r.render(state,0);assert.equal(r.lastAtmosphere,'dusk');assert.equal(state.night,false);r.setIntroProgress(null);r.render(state,0);assert.equal(r.lastAtmosphere,'day');assert.equal(r.scooter.visible,true);assert.equal(JSON.stringify(state),saved);
});
