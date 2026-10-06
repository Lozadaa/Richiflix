import test from 'node:test';
import assert from 'node:assert/strict';
import {rowWindow,railWindow,nextGridIndex} from './virtualWindow.js';
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
