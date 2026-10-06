import test from 'node:test';
import assert from 'node:assert/strict';
import {rowWindow,railWindow,nextGridIndex,nextRailIndex,pinWindowFocus} from './virtualWindow.js';
test('grid keeps a fixed DOM budget across 27k titles, including pinned focus',()=>{
 const count=27000,columns=7,rowHeight=450,viewport=510;
 for(let index=0;index<500;index++){
  const result=rowWindow({count,columns,rowHeight,viewport,offset:Math.floor(index/columns)*rowHeight,focusedIndex:0});
  assert.ok(result.indices.length<=43);assert.ok(result.indices.includes(index));assert.ok(result.indices.includes(0));
 }
});
test('grid exposes every last title without an extra load button',()=>{
 const count=501,columns=7,rowHeight=450;
 const result=rowWindow({count,columns,rowHeight,offset:Math.floor((count-1)/columns)*rowHeight,viewport:510});
 assert.ok(result.indices.includes(count-1));assert.equal(result.totalRows,72);
 assert.equal(nextGridIndex(496,'ArrowDown',columns,count),500);
 assert.equal(nextGridIndex(500,'ArrowDown',columns,count),null);
 assert.equal(nextGridIndex(6,'ArrowRight',columns,count),null);
 assert.equal(nextGridIndex(7,'ArrowLeft',columns,count),null);
});
test('rails bound mounted images even when focus remains outside the scroll window',()=>{
 for(let index=0;index<1000;index++){
  const result=railWindow({count:27000,itemWidth:210,gap:30,offset:index*240,viewport:1680,focusedIndex:0});
  assert.ok(result.indices.length<=14);assert.ok(result.indices.includes(index));assert.ok(result.indices.includes(0));
 }
});
test('circular rails include the final action and wrap in both directions without clones',()=>{
 const count=27001;
 assert.equal(nextRailIndex(0,'ArrowLeft',count),27000);
 assert.equal(nextRailIndex(27000,'ArrowLeft',count),26999);
 assert.equal(nextRailIndex(26999,'ArrowRight',count),27000);
 assert.equal(nextRailIndex(27000,'ArrowRight',count),0);
 for(const index of [0,26999,27000]){
  const window=railWindow({count,itemWidth:210,gap:30,viewport:1680,offset:index*240,focusedIndex:index});
  assert.ok(window.indices.length<=14);assert.ok(window.indices.includes(index));
  assert.equal(new Set(window.indices).size,window.indices.length);
 }
});
test('circular rails handle singleton, empty and invalid indices while grids keep boundaries',()=>{
 assert.equal(nextRailIndex(0,'ArrowLeft',2),1);assert.equal(nextRailIndex(1,'ArrowRight',2),0);
 assert.equal(nextRailIndex(0,'ArrowRight',1),0);
 for(const count of [0,NaN,-1,1.5])assert.equal(nextRailIndex(0,'ArrowRight',count),null);
 for(const index of [-1,3,1.5])assert.equal(nextRailIndex(index,'ArrowRight',3),null);
 assert.equal(nextRailIndex(0,'ArrowDown',3),null);
 assert.equal(nextGridIndex(0,'ArrowLeft',7,30),null);
});
test('a delayed scroll window retains the new focus once without mutating its queued indices',()=>{
 const pending=[0,1,2],currentFocus=27000;
 const pinned=pinWindowFocus(pending,currentFocus,27001);
 assert.deepEqual(pinned,[0,1,2,27000]);assert.deepEqual(pending,[0,1,2]);
 assert.equal(pinWindowFocus(pinned,currentFocus,27001),pinned);
 assert.equal(pinWindowFocus(pending,-1,27001),pending);
 assert.equal(pinWindowFocus(pending,27001,27001),pending);
});
