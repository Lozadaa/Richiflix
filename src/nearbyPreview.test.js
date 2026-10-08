import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyPreviewItems} from './nearbyPreview.js';
const items=Array.from({length:40},(_,index)=>({id:index}));
test('preview warms two future titles in the remote direction, with vertical grid stride and no row wrap',()=>{
 assert.deepEqual(nearbyPreviewItems({items,index:10,key:'ArrowRight'}).map(item=>item.id),[11,12]);
 assert.deepEqual(nearbyPreviewItems({items,index:10,key:'ArrowLeft'}).map(item=>item.id),[9,8]);
 assert.deepEqual(nearbyPreviewItems({items,index:10,key:'ArrowDown',columns:7,kind:'grid'}).map(item=>item.id),[17,24]);
 assert.deepEqual(nearbyPreviewItems({items,index:10,key:'ArrowUp',columns:7,kind:'grid'}).map(item=>item.id),[3]);
 assert.deepEqual(nearbyPreviewItems({items,index:6,key:'ArrowRight',columns:7,kind:'grid'}),[]);
 assert.deepEqual(nearbyPreviewItems({items,index:39}),[]);
});
test('circular rails prewarm across both ends without requesting the focused title twice',()=>{
 assert.deepEqual(nearbyPreviewItems({items,index:0,key:'ArrowLeft',loop:true}).map(item=>item.id),[39,38]);
 assert.deepEqual(nearbyPreviewItems({items,index:39,key:'ArrowRight',loop:true}).map(item=>item.id),[0,1]);
 assert.deepEqual(nearbyPreviewItems({items:items.slice(0,2),index:0,loop:true}).map(item=>item.id),[1]);
 assert.deepEqual(nearbyPreviewItems({items:items.slice(0,1),index:0,loop:true}),[]);
 assert.deepEqual(nearbyPreviewItems({items,index:0,key:'ArrowLeft',loop:true,kind:'grid',columns:7}),[]);
});
