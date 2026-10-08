import test from 'node:test';
import assert from 'node:assert/strict';
import {rowWindow,railWindow,nextGridIndex,nextRailIndex,pinWindowFocus,assignSlots,haloPlacement,haloFrames,premountTarget,anchoredRailOffset,railTailSpace} from './virtualWindow.js';
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
test('R5.1/R5.2 rail hysteresis: 20 Right keys over 8 visible cells change the window at most twice, never below the overscan',()=>{
 const stride=240,geometry={count:1000,itemWidth:210,gap:30,viewport:8*stride};let previous=railWindow({...geometry,offset:0,focusedIndex:0}),changes=0;
 assert.deepEqual([previous.start,previous.end],[0,14]);
 for(let focus=1;focus<=20;focus++){
  const offset=Math.max(0,focus-7)*stride,next=railWindow({...geometry,offset,focusedIndex:focus,previous});
  if(next.start!==previous.start||next.end!==previous.end)changes++;
  assert.ok(focus>3||changes===0,'the first keys mount nothing');
  const first=offset/stride,last=first+8;assert.ok(next.start<=first&&next.end>=last&&next.end-next.start===14,`focus ${focus}: [${next.start},${next.end})`);
  previous=next;
 }
 assert.ok(changes<=2,`${changes} window changes`);
 // Back and forth by one cell inside the window: no change at all.
 const held=railWindow({...geometry,offset:12*stride,previous});assert.deepEqual([held.start,held.end],[previous.start,previous.end]);
 // A wrap to the start (circular rail) rebuilds a full window from 0.
 const wrapped=railWindow({...geometry,offset:0,focusedIndex:0,previous:{start:986,end:1000}});assert.deepEqual([wrapped.start,wrapped.end],[0,14]);
 // Short rails and shrunk catalogues stay inside the count.
 const short=railWindow({count:5,itemWidth:210,gap:30,viewport:1920,previous:{start:0,end:14}});assert.deepEqual([short.start,short.end],[0,5]);
});
test('R5.1 grid hysteresis: the window holds until the view crosses half a row past it',()=>{
 const base={count:27000,columns:8,rowHeight:300,viewport:600,overscan:1};const first=rowWindow({...base,offset:300});
 assert.deepEqual([first.start,first.end],[0,4]);
 assert.deepEqual([rowWindow({...base,offset:340,previous:first}).start,rowWindow({...base,offset:340,previous:first}).end],[0,4]);
 const moved=rowWindow({...base,offset:600,previous:first});assert.deepEqual([moved.start,moved.end],[1,5]);
 assert.ok(moved.indices.length<=40);
});
test('R5.3 slots: a kept key never changes slot, entering keys reuse freed slots, reuse=false gives fresh ones',()=>{
 const keys=(from,to)=>Array.from({length:to-from},(_,index)=>`item-${from+index}`);
 let slots=assignSlots(new Map(),keys(0,14));assert.deepEqual([...new Set(slots.values())].sort((a,b)=>a-b),keys(0,14).map((_,index)=>index));
 const selected='item-10',before=slots.get(selected);
 slots=assignSlots(slots,keys(5,19));
 assert.equal(slots.get(selected),before,'the selected card keeps its node');
 assert.ok([...slots.values()].every(slot=>slot<14),'entering keys reuse the 5 freed slots');
 assert.equal(assignSlots(slots,keys(5,19)).get('item-18'),slots.get('item-18'),'idempotent');
 const fresh=assignSlots(slots,keys(7,21),false);
 assert.equal(fresh.get(selected),before);assert.ok(fresh.get('item-19')>=14&&fresh.get('item-20')>=14,'no reuse while the panel may hold shifted cells');
 assert.equal(new Set(fresh.values()).size,fresh.size);
});
test('row halo sits on the card-open box from the model and lifts like the focused card',()=>{
 for(const index of [0,1,7,39])assert.deepEqual(haloPlacement({index,kind:'rail',width:210,gap:30,paddingLeft:86}),{x:86,y:0},'A2: the rail halo stays at the fixed column');
 assert.deepEqual(haloPlacement({index:3,width:210,gap:30,paddingLeft:86,paddingTop:12}),{x:86,y:12});
 assert.deepEqual(haloPlacement({index:9,kind:'grid',width:192,gap:30,columns:7,rowHeight:400,paddingLeft:12,paddingTop:20}),{x:12+2*222,y:420});
 assert.equal(haloPlacement({index:-1,width:210}),null);
 assert.deepEqual(haloFrames({x:720,y:0},1.06),[{transform:'translate3d(720px,0px,0)'},{transform:'translate3d(720px,-6px,0) scale(1.06)'}]);
});
test('pre-mount picks the next far rail in the last vertical direction within the card budget',()=>{
 const rail=(near,cells=near?14:0)=>({near,cells,size:14});
 const rails=[rail(true),rail(true),rail(true),rail(false),rail(false)];
 assert.equal(premountTarget({rails,active:1,direction:1}),3);
 assert.equal(premountTarget({rails,active:1,direction:-1}),-1);// everything above is already mounted
 assert.equal(premountTarget({rails:[rail(false),rail(true),rail(true),rail(true)],active:2,direction:-1}),0);
 assert.equal(premountTarget({rails:[rail(true),rail(true),rail(true),rail(true),rail(false)],active:1,direction:1}),-1);// 56+14=70 > 64
 assert.equal(premountTarget({rails,active:1,direction:1,budget:50}),-1);
 assert.equal(premountTarget({rails:[rail(true),rail(true),rail(true),rail(true),rail(true),rail(false)],active:1,direction:1}),-1);// 3 hops max
 assert.equal(premountTarget({rails,active:-1}),-1);
});
test('anchoredRailOffset keeps every card at the fixed column',()=>{
 const layout={itemWidth:210,gap:30,paddingLeft:86,viewport:1920,count:40};
 assert.equal(anchoredRailOffset({index:0,...layout}),0);
 assert.equal(anchoredRailOffset({index:1,...layout}),240);
 assert.equal(anchoredRailOffset({index:7,...layout}),7*240);
 assert.equal(anchoredRailOffset({index:39,...layout}),39*240); // la cola permite llegar
 assert.equal(anchoredRailOffset({index:2,...layout,count:3}),2*240); // fila corta: también se ancla
 assert.equal(railTailSpace(layout),1920-86-210);
 assert.equal(anchoredRailOffset({...layout,index:nextRailIndex(39,'ArrowRight',40)}),0,'wrap end -> start lands on 0');
 for(const index of [-1,40,1.5])assert.equal(anchoredRailOffset({...layout,index}),0);
 assert.equal(anchoredRailOffset({...layout,count:1,index:0}),0);
});
test('TV tail allows every focused card to stay before the midpoint without growing the DOM window',()=>{
 for(const viewport of [960,1280,1920,3840])for(const count of [2,5,9,240,27001]){
  const g={count,itemWidth:210,gap:30,paddingLeft:12,paddingRight:12,viewport},tail=railTailSpace(g);
  const max=count*240-30+g.paddingLeft+tail-viewport;
  for(const index of [0,1,count-1]){
   const offset=anchoredRailOffset({...g,index}),left=12+index*240-offset;
   assert.ok(offset<=Math.max(0,max),`count ${count}: destination fits the actual scroll range`);
   assert.ok(left+210/2<viewport/2,`count ${count}, index ${index}: focus stays before the midpoint`);
   assert.ok(railWindow({...g,offset,focusedIndex:index}).indices.length<=Math.ceil(viewport/240)+6,'no placeholder cards for the tail');
  }
 }
});
