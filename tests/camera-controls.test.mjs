import test from 'node:test';
import assert from 'node:assert/strict';
import {createLookController} from '../src/camera-controls.js';

test('pointer and gamepad look deltas use sensitivity, pitch limits and invert Y',()=>{
 const c=createLookController();c.adjust(100,20);let s=c.snapshot();assert.ok(Math.abs(s.yaw-.4)<1e-9);assert.equal(s.pitch,.06);
 c.reset();c.configure({sensitivity:2,invertY:true});c.adjust(100,20);s=c.snapshot();assert.ok(Math.abs(s.yaw-.8)<1e-9);assert.equal(s.pitch,-.12);
 c.adjust(1e6,-1e6);s=c.snapshot();assert.ok(s.yaw>=-Math.PI&&s.yaw<=Math.PI);assert.equal(s.pitch,.8);
 c.adjust(0,1e6);assert.equal(c.snapshot().pitch,-.19);const saved=c.snapshot();c.adjust(NaN,Infinity);assert.deepEqual(c.snapshot(),saved);
});

test('look settings and read-only snapshots remain safe across reset',()=>{
 const c=createLookController();c.configure({sensitivity:99,invertY:true});assert.equal(c.snapshot().sensitivity,3);c.adjust(50,50);c.reset();assert.deepEqual(c.snapshot(),{yaw:0,pitch:0,sensitivity:3,invertY:true});
 const copy=c.snapshot();copy.yaw=100;assert.equal(c.snapshot().yaw,0);c.configure({sensitivity:NaN,invertY:'yes'});assert.deepEqual(c.snapshot(),{yaw:0,pitch:0,sensitivity:1,invertY:false});
});
