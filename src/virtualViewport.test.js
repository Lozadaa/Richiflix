import test from 'node:test';
import assert from 'node:assert/strict';
import {viewportRevealDelta,viewportAlignDelta,revealRailCard,revealGridIndex,glideFrames,glideShiftAt,glideViewportBy,shiftViewportFrame,viewportOffset,viewportIsGliding,cancelViewportGlide,TV_GLIDE_MS} from './virtualViewport.js';

test('virtual reveal leaves a visible row still and moves the minimum distance for hidden rows',()=>{
 assert.equal(viewportRevealDelta({top:140,bottom:460,viewportTop:100,height:400}),0);
 assert.equal(viewportRevealDelta({top:90,bottom:410,viewportTop:100,height:400}),-34);
 assert.equal(viewportRevealDelta({top:280,bottom:600,viewportTop:100,height:400}),124);
 assert.equal(viewportRevealDelta({top:280,bottom:880,viewportTop:100,height:400}),156);
});

test('TV alignment snaps the focused row to the top edge less the margin, and the first row to 0',()=>{
 assert.equal(viewportAlignDelta({top:500,viewportTop:400,offset:0}),76);
 assert.equal(viewportAlignDelta({top:200,viewportTop:400,offset:600}),-224);
 assert.equal(viewportAlignDelta({top:424,viewportTop:400,offset:300}),0);
 assert.equal(viewportAlignDelta({top:-900,viewportTop:400,offset:300}),-300);
 assert.equal(viewportAlignDelta({top:380,viewportTop:400,offset:350,first:true}),-350);
});

test('rail reveal aligns its row section, heading included, without reading a scaling card',()=>{
 const previousWindow=globalThis.window;globalThis.window={};
 try{
  const calls=[],section={getBoundingClientRect:()=>({top:590})},viewport={clientHeight:500,scrollHeight:4000,getBoundingClientRect:()=>({top:100}),scrollTop:200,scrollTo:options=>calls.push(options),querySelector:()=>({})};
  const rail={closest:()=>section,getBoundingClientRect(){throw Error('Rail rect is not the alignment anchor.');},querySelector(){throw Error('Animated card geometry must not drive scrolling.');}};
  revealRailCard(rail,6,viewport);assert.deepEqual(calls,[{top:666,behavior:'instant'}]);
  viewport.querySelector=()=>section;revealRailCard(rail,7,viewport);assert.deepEqual(calls.at(-1),{top:0,behavior:'instant'});
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});

test('grid reveal aligns virtual rows to the top in TV, clamps the last row and returns to 0 on the first',()=>{
 const previousWindow=globalThis.window;globalThis.window={};
 try{
  const calls=[],viewport={clientHeight:500,scrollHeight:1300,getBoundingClientRect:()=>({top:100}),scrollTop:0,scrollTo:options=>{calls.push(options);viewport.scrollTop=options.top;}};
  const grid={getBoundingClientRect:()=>({top:130-viewport.scrollTop}),querySelector(){throw Error('Card transforms must not influence the row destination.');}};
  const layout={columns:7,rowHeight:400,rowGap:30,paddingTop:20};
  revealGridIndex(grid,layout,10,viewport);assert.deepEqual(calls.at(-1),{top:426,behavior:'instant'});
  revealGridIndex(grid,layout,17,viewport);assert.deepEqual(calls.at(-1),{top:800,behavior:'instant'});
  revealGridIndex(grid,layout,24,viewport);assert.equal(calls.length,2);// already at the end: no bounce
  revealGridIndex(grid,layout,3,viewport);assert.deepEqual(calls.at(-1),{top:0,behavior:'instant'});
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});

test('grid reveal on the window (PC) keeps the minimum reveal',()=>{
 const previousWindow=globalThis.window,calls=[];globalThis.window={innerHeight:500,scrollY:0,scrollTo:options=>calls.push(options)};
 try{
  const grid={getBoundingClientRect:()=>({top:30})},layout={columns:7,rowHeight:400,rowGap:30,paddingTop:20};
  revealGridIndex(grid,layout,3,window);assert.deepEqual(calls,[]);
  revealGridIndex(grid,layout,10,window);assert.deepEqual(calls,[{top:344,behavior:'instant'}]);
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});

test('R1.6 compensation: the scroll lands at once and the content starts where it was drawn, also when retargeted mid-flight',()=>{
 assert.deepEqual(glideFrames(500),[{transform:'translate3d(0,500px,0)'},{transform:'translate3d(0,0,0)'}]);
 assert.equal(glideShiftAt(500,0),500);assert.equal(glideShiftAt(500,.5),250);assert.equal(glideShiftAt(500,1),0);assert.equal(glideShiftAt(500,null),0,'an ended glide leaves no shift');
 const previousWindow=globalThis.window;globalThis.window={matchMedia:()=>({matches:false}),requestAnimationFrame(){}};
 try{
  let progress=0;const calls=[],animations=[];
  const content={animate(keyframes,options){const animation={keyframes,options,playState:'running',effect:{getComputedTiming:()=>({progress})},cancel(){this.playState='idle';}};animations.push(animation);return animation;}};
  const viewport={scrollTop:0,scrollHeight:5000,clientHeight:500,matches:selector=>selector==='.tv-mode .page-scene',querySelector:selector=>selector===':scope > .content'?content:null,scrollTo({top}){calls.push(top);this.scrollTop=top;}};
  glideViewportBy(viewport,500);
  assert.deepEqual(calls,[500],'one instant scroll, no per-frame writes');assert.equal(animations[0].keyframes[0].transform,'translate3d(0,500px,0)','first frame: content drawn where it was');
  assert.equal(animations[0].options.duration,TV_GLIDE_MS.min);assert.equal(viewportOffset(viewport),0,'the drawn offset, not scrollTop');assert.equal(viewportIsGliding(viewport),true);
  progress=.5;assert.equal(viewportOffset(viewport),250);
  glideViewportBy(viewport,500);
  assert.equal(animations[0].playState,'idle');assert.deepEqual(calls,[500,750]);assert.equal(animations[1].keyframes[0].transform,'translate3d(0,500px,0)','starts from the drawn 250, lands on 750');
  progress=0;glideViewportBy(viewport,500);assert.deepEqual(calls,[500,750],'same destination while running: keep going');assert.equal(animations.length,2);
  animations[1].playState='finished';progress=null;animations[1].onfinish();assert.equal(viewportOffset(viewport),750);assert.equal(viewportIsGliding(viewport),false);
  cancelViewportGlide(viewport);
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
test('banner collapse composes with a vertical glide and reverses from its drawn position without scrolling',()=>{
 const previousWindow=globalThis.window;globalThis.window={matchMedia:()=>({matches:false}),requestAnimationFrame(){}};
 try{
  let progress=0;const animations=[],scrolls=[];
  const content={animate(frames,options){const animation={frames,options,playState:'running',effect:{getComputedTiming:()=>({progress})},cancel(){this.playState='idle';}};animations.push(animation);return animation;}};
  const viewport={scrollTop:0,scrollHeight:5000,clientHeight:500,matches:()=>true,querySelector:()=>content,scrollTo({top}){this.scrollTop=top;scrolls.push(top);}};
  glideViewportBy(viewport,200);progress=.5;
  shiftViewportFrame(viewport,450);assert.equal(animations[0].playState,'idle');assert.equal(animations[1].frames[0].transform,'translate3d(0,550px,0)');assert.deepEqual(scrolls,[200],'the boundary makes no scroll writes');
  progress=.5;shiftViewportFrame(viewport,-450);assert.equal(animations[1].playState,'idle');assert.equal(animations[2].frames[0].transform,'translate3d(0,-175px,0)','a quick return starts at the drawn frame');
  assert.equal(viewportIsGliding(viewport),true);progress=null;animations[2].onfinish();assert.equal(viewportIsGliding(viewport),false);
  globalThis.window.matchMedia=()=>({matches:true});shiftViewportFrame(viewport,450);assert.equal(animations.length,3,'reduced motion changes geometry without animation');
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
