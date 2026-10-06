import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportRevealDelta,revealRailCard,revealGridIndex,glideViewportBy,viewportIsGliding} from './virtualViewport.js';

test('virtual reveal leaves a visible row still and moves the minimum distance for hidden rows',()=>{
 assert.equal(viewportRevealDelta({top:140,bottom:460,viewportTop:100,height:400}),0);
 assert.equal(viewportRevealDelta({top:90,bottom:410,viewportTop:100,height:400}),-34);
 assert.equal(viewportRevealDelta({top:280,bottom:600,viewportTop:100,height:400}),124);
 assert.equal(viewportRevealDelta({top:280,bottom:880,viewportTop:100,height:400}),156);
});

test('rail reveal uses stable reserved bounds without reading a scaling card',()=>{
 const previousWindow=globalThis.window;globalThis.window={};
 try{
  const calls=[],viewport={clientHeight:500,getBoundingClientRect:()=>({top:100}),scrollTop:0,scrollTo:options=>calls.push(options)};
  const rail={getBoundingClientRect:()=>({top:130,bottom:560}),querySelector(){throw Error('Animated card geometry must not drive scrolling.');}};
  revealRailCard(rail,6,viewport);revealRailCard(rail,7,viewport);
  assert.deepEqual(calls,[]);
  rail.getBoundingClientRect=()=>({top:590,bottom:1020});revealRailCard(rail,7,viewport);
  assert.deepEqual(calls,[{top:444,behavior:'instant'}]);
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});

test('grid reveal follows virtual row geometry even when the selected card is transformed',()=>{
 const previousWindow=globalThis.window;globalThis.window={};
 try{
  const calls=[],viewport={clientHeight:500,getBoundingClientRect:()=>({top:100}),scrollTop:0,scrollTo:options=>calls.push(options)};
  const grid={getBoundingClientRect:()=>({top:130}),querySelector(){throw Error('Card transforms must not influence the row destination.');}};
  const layout={columns:7,rowHeight:400,rowGap:30,paddingTop:20};
  revealGridIndex(grid,layout,3,viewport);assert.deepEqual(calls,[]);
  revealGridIndex(grid,layout,10,viewport);assert.deepEqual(calls,[{top:344,behavior:'instant'}]);
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
