import test from 'node:test';
import assert from 'node:assert/strict';
import {createBannerFlow} from './bannerFlow.js';
function fixture(){
 let time=0,sequence=0;const timers=new Map(),changes=[],commits=[];
 const flow=createBannerFlow({onChange:state=>changes.push(state),onCommit:card=>commits.push(card),schedule:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,at:time+delay});return id;},cancel:id=>timers.delete(id)});
 const tick=duration=>{const end=time+duration;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;timers.delete(next[0]);next[1].callback();}time=end;};
 return {flow,tick,changes,commits,timers};
}
test('remote repeats hide once and commit only the last card after a quiet period',()=>{
 const {flow,tick,changes,commits,timers}=fixture();
 flow.select('first');tick(480);assert.deepEqual(commits,['first']);assert.deepEqual(flow.state,{collapsed:false,moving:false});
 for(let index=0;index<24;index++){flow.move();flow.select('card-'+index);tick(80);assert.equal(timers.size,1);}
 assert.deepEqual(commits,['first']);assert.deepEqual(flow.state,{collapsed:true,moving:true});
 tick(399);assert.deepEqual(commits,['first']);tick(1);assert.deepEqual(commits,['first','card-23']);
 assert.deepEqual(changes,[{collapsed:true,moving:true},{collapsed:false,moving:false},{collapsed:true,moving:true},{collapsed:false,moving:false}]);
});
test('wheel movement delays resuming the selected preview without selecting another card',()=>{
 const {flow,tick,commits}=fixture();flow.select('selected');tick(480);flow.move();tick(350);flow.move();tick(479);
 assert.deepEqual(commits,['selected']);tick(1);assert.deepEqual(commits,['selected','selected']);assert.equal(flow.state.collapsed,false);
});
test('reset, navigation without a card, and disposal cannot commit a stale preview',()=>{
 const {flow,tick,commits,timers}=fixture();flow.select('stale');flow.reset();tick(1000);assert.deepEqual(commits,[]);assert.equal(timers.size,0);
 flow.move();tick(480);assert.deepEqual(flow.state,{collapsed:true,moving:false});
 flow.select('also stale');flow.dispose();tick(1000);flow.select('closed');assert.deepEqual(commits,[]);assert.equal(timers.size,0);
});
test('entering the revealed stage keeps it visible and does not create another transition',()=>{
 const {flow,tick,changes,commits}=fixture();flow.select('card');tick(480);flow.keep('card');
 assert.equal(changes.length,2);assert.deepEqual(commits,['card','card']);assert.deepEqual(flow.state,{collapsed:false,moving:false});
});
test('a candidate rejected at rest stays hidden',()=>{
 let settle,committed=0;const flow=createBannerFlow({onCommit:()=>{committed++;return false;},schedule:callback=>{settle=callback;return 1;},cancel:()=>{}});
 flow.select('removed');settle();assert.equal(committed,1);assert.deepEqual(flow.state,{collapsed:true,moving:false});
});
test('entering stage controls reveals immediately and cancels a pending card transition',()=>{
 const {flow,tick,commits,timers}=fixture();flow.select('old');flow.keep('stage');
 assert.deepEqual(flow.state,{collapsed:false,moving:false});assert.deepEqual(commits,['stage']);assert.equal(timers.size,0);
 tick(1000);assert.deepEqual(commits,['stage']);
});
