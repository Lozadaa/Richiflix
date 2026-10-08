import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeekAccumulator,naturalCross} from './seekAccumulator.js';

test('seek accelerates within the window and applies once',()=>{
 let t=0,applied=[];const timers=[];const acc=createSeekAccumulator({now:()=>t,schedule:(fn,ms)=>{timers.push({fn,at:t+ms});return timers.length;},cancel:id=>{timers[id-1]=null;}});
 acc.onApply(v=>applied.push(v));
 assert.equal(acc.press(1,{position:100,duration:3600}).delta,10);t+=300;
 assert.equal(acc.press(1,{position:100,duration:3600}).delta,40);t+=300;
 assert.equal(acc.press(1,{position:100,duration:3600}).delta,100);
 t+=400;timers.filter(Boolean).forEach(x=>x.at<=t&&x.fn());assert.deepEqual(applied,[200]);
});
test('seek clamps at the ends and resets after the window',()=>{
 let t=0;const acc=createSeekAccumulator({now:()=>t,schedule:()=>1,cancel:()=>{}});
 assert.equal(acc.press(1,{position:3595,duration:3600}).target,3599); // plan: 3580 (+10 = 3590 never reached the clamp)
 assert.equal(acc.press(-1,{position:5,duration:3600}).target,0);
 t+=700;assert.equal(acc.press(1,{position:100,duration:3600}).delta,10);
});
test('holding counts a repeat every 250 ms and 2 minutes cost a short hold',()=>{
 let t=0;const acc=createSeekAccumulator({now:()=>t,schedule:()=>1,cancel:()=>{}});
 acc.press(1,{position:0,duration:3600});
 for(let i=0;i<4;i++){t+=50;assert.equal(acc.press(1,{position:0,duration:3600,repeat:true}),null);}
 t=250;assert.equal(acc.press(1,{position:0,duration:3600,repeat:true}).delta,40);
 t=500;acc.press(1,{position:0,duration:3600,repeat:true});t=750;assert.equal(acc.press(1,{position:0,duration:3600,repeat:true}).delta,220);
});
test('flush applies at once and the next press keeps accelerating from the burst start',()=>{
 let t=0;const applied=[];const acc=createSeekAccumulator({now:()=>t,schedule:()=>1,cancel:()=>{}});acc.onApply((target,burst)=>applied.push([target,burst.from]));
 acc.press(1,{position:100,duration:3600});acc.flush();t+=200;acc.press(1,{position:110,duration:3600});acc.flush();acc.flush();
 assert.deepEqual(applied,[[110,100],[140,100]]);
 acc.press(-1,{position:140,duration:3600});acc.cancel();acc.flush();assert.equal(applied.length,2);
});
test('next-episode card only fires when playback crosses the threshold, not on a jump',()=>{
 assert.equal(naturalCross({previous:3569,position:3570.5,duration:3600}),true);
 assert.equal(naturalCross({previous:3480,position:3599,duration:3600}),false); // 120 s jump near the end
 assert.equal(naturalCross({previous:3575,position:3576,duration:3600}),false); // already inside
 assert.equal(naturalCross({previous:0,position:1,duration:0}),false);
});
