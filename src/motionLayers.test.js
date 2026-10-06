import test from 'node:test';
import assert from 'node:assert/strict';
import {leaseTransformLayers} from './motionLayers.js';
test('layer leases restore prior styles and stale timers cannot strip a renewed lease',()=>{
 const element={style:{willChange:'opacity'}},tasks=[],schedule=callback=>tasks.push(callback);
 leaseTransformLayers([element],{schedule});leaseTransformLayers([element],{schedule});
 tasks[0]();assert.equal(element.style.willChange,'transform');tasks[1]();assert.equal(element.style.willChange,'opacity');
});
test('early release restores every neighbour once and ignores later timers',()=>{
 const elements=Array.from({length:4},()=>({style:{willChange:''}})),tasks=[];
 const release=leaseTransformLayers(elements,{schedule:callback=>tasks.push(callback)});release();tasks[0]();
 assert.ok(elements.every(element=>element.style.willChange===''));
});
