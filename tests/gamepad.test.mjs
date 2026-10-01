import test from 'node:test';
import assert from 'node:assert/strict';
import {createGamepadInput,deadzone} from '../src/gamepad.js';
const fixture=()=>({index:0,id:'Standard fixture',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))});
const button=(pad,i,down)=>{pad.buttons[i]={pressed:down,value:down?1:0};};

test('gamepad provider fixtures sanitize deadzones and missing/disconnected devices',()=>{
 assert.equal(deadzone(.15),0);assert.equal(deadzone(NaN),0);assert.equal(deadzone(-1),-1);
 let pads=[];const c=createGamepadInput({getGamepads:()=>pads});assert.equal(c.poll().connected,false);
 const p=fixture();pads=[null,p];assert.equal(c.poll({enabled:true}).connected,true);p.axes[0]=NaN;p.axes[1]=Infinity;assert.deepEqual(c.poll({enabled:true}).look,{x:0,y:0});
 p.connected=false;assert.equal(c.poll({enabled:true}).connected,false);
 assert.equal(createGamepadInput({getGamepads:()=>{throw Error('Unavailable');}}).poll().connected,false);
});

test('left stick, triggers and right stick are independent real API inputs',()=>{
 const p=fixture(),c=createGamepadInput({getGamepads:()=>[p]});c.poll({enabled:true});p.axes=[-.8,-.9,.7,-.6];
 let s=c.poll({enabled:true});assert.equal(s.movement.left,true);assert.equal(s.movement.throttle,true);assert.ok(s.look.x>0&&s.look.y<0);
 p.axes=[.8,.9,0,0];button(p,6,true);s=c.poll({enabled:true});assert.equal(s.movement.right,true);assert.equal(s.movement.reverse,true);assert.equal(s.movement.brake,true);
 p.axes=[0,0,0,0];button(p,6,false);button(p,7,true);assert.equal(c.poll({enabled:true}).movement.throttle,true);
});

test('action buttons trigger once per press, including Start while paused',()=>{
 const p=fixture(),c=createGamepadInput({getGamepads:()=>[p]});c.poll({enabled:true});
 for(const [i,action]of [[0,'interact'],[1,'back'],[2,'reset'],[3,'mount'],[8,'map'],[9,'pause']]){button(p,i,true);assert.ok(c.poll({enabled:true,paused:i===9}).actions.includes(action));assert.equal(c.poll({enabled:true,paused:i===9}).actions.length,0);button(p,i,false);c.poll({enabled:true});}
});

test('pause, cutscene and explicit clear require controls to return to neutral',()=>{
 const p=fixture(),c=createGamepadInput({getGamepads:()=>[p]});c.poll({enabled:true});button(p,7,true);assert.equal(c.poll({enabled:true}).movement.throttle,true);
 assert.equal(c.poll({enabled:true,paused:true}).movement.throttle,false);assert.equal(c.poll({enabled:true}).movement.throttle,false);
 button(p,7,false);c.poll({enabled:true});button(p,7,true);assert.equal(c.poll({enabled:true}).movement.throttle,true);
 c.clear();assert.equal(c.poll({enabled:true}).movement.throttle,false);button(p,7,false);c.poll({enabled:true});
 button(p,0,true);button(p,1,true);assert.deepEqual(c.poll({enabled:true,cinematic:true}).actions,['back']);assert.equal(c.poll({enabled:true,cinematic:true}).movement.throttle,false);
});

test('disconnect releases throttle and look and reconnect does not reuse held inputs',()=>{
 const p=fixture();let pads=[p];const c=createGamepadInput({getGamepads:()=>pads});c.poll({enabled:true});p.axes=[0,-1,1,0];c.poll({enabled:true});pads=[];let s=c.poll({enabled:true});assert.equal(s.movement.throttle,false);assert.equal(s.look.x,0);
 pads=[p];s=c.poll({enabled:true});assert.equal(s.movement.throttle,false);p.axes=[0,0,0,0];c.poll({enabled:true});p.axes[1]=-1;assert.equal(c.poll({enabled:true}).movement.throttle,true);
 const external=c.snapshot();external.movement.throttle=false;assert.equal(c.snapshot().movement.throttle,true);
});
