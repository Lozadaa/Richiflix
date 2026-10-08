import test from 'node:test';
import assert from 'node:assert/strict';
import {createBannerFlow,createBannerCarousel,bannerKeyAction} from './bannerFlow.js';
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
function carouselFixture(options={}){
 let time=0,sequence=0;const timers=new Map(),changes=[],state={ready:()=>true};
 const carousel=createBannerCarousel({onChange:index=>changes.push(index),ready:index=>state.ready(index),schedule:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,at:time+delay});return id;},cancel:id=>timers.delete(id),...options});
 const tick=duration=>{const end=time+duration;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;timers.delete(next[0]);next[1].callback();}time=end;};
 return {carousel,tick,changes,timers,state};
}
test('the carousel rotates in order every interval and wraps around',()=>{
 const {carousel,tick,changes,timers}=carouselFixture();carousel.reset(3);assert.deepEqual(changes,[0]);
 tick(8999);assert.equal(carousel.index,0);tick(1);assert.equal(carousel.index,1);tick(9000);tick(9000);
 assert.deepEqual(changes,[0,1,2,0]);assert.equal(timers.size,1);
});
test('a pause never rotates and resuming waits the quiet period plus an interval',()=>{
 const {carousel,tick,changes,timers}=carouselFixture();carousel.reset(4);tick(5000);
 carousel.pause();assert.equal(timers.size,0);for(let key=0;key<30;key++){carousel.pause();tick(125);}tick(60000);assert.deepEqual(changes,[0]);
 carousel.resume();carousel.resume();assert.equal(timers.size,1);tick(10999);assert.deepEqual(changes,[0]);tick(1);assert.deepEqual(changes,[0,1]);
});
test('a slide whose art is still loading is skipped and retried on the next tick',()=>{
 const {carousel,tick,changes,state}=carouselFixture();carousel.reset(3);state.ready=()=>false;
 tick(9000);assert.equal(carousel.index,0);state.ready=index=>index===1;tick(9000);assert.deepEqual(changes,[0,1]);
});
test('a manual change selects at once and restarts the interval, even while paused',()=>{
 const {carousel,tick,changes,timers}=carouselFixture();carousel.reset(3);tick(8000);
 carousel.step(-1);assert.equal(carousel.index,2);tick(8999);assert.equal(carousel.index,2);tick(1);assert.equal(carousel.index,0);
 carousel.pause();carousel.go(1);assert.equal(carousel.index,1);assert.equal(timers.size,0);assert.deepEqual(changes,[0,2,0,1]);
});
test('one slide or an emptied list never schedules, and reset keeps a valid index',()=>{
 const {carousel,timers}=carouselFixture();carousel.reset(1);assert.equal(timers.size,0);carousel.reset(5,4);assert.equal(carousel.index,4);carousel.reset(2,4);assert.equal(carousel.index,1);carousel.reset(0);assert.equal(carousel.index,0);assert.equal(timers.size,0);carousel.go(3);assert.equal(carousel.index,0);
});
test('banner keys: carousel changes slide and presses OK; actions alternate buttons and Back exits',()=>{
 const carousel=key=>bannerKeyAction({key,mode:'carousel'}),actions=key=>bannerKeyAction({key,mode:'actions'});
 assert.equal(carousel('ArrowLeft'),'previous');assert.equal(carousel('ArrowRight'),'next');assert.equal(carousel('Enter'),'press');
 for(const key of ['ArrowUp','ArrowDown','Escape','Tab'])assert.equal(carousel(key),null,`${key} is left to the page navigation`);
 assert.equal(actions('ArrowLeft'),'toggle');assert.equal(actions('ArrowRight'),'toggle');assert.equal(actions('Escape'),'exit');
 for(const key of ['ArrowUp','ArrowDown','Enter'])assert.equal(actions(key),null,`${key} keeps its native/page behaviour`);
});
test('carousel go wraps at both ends and re-arms the full interval',()=>{
 const timers=[];const carousel=createBannerCarousel({schedule:(fn,ms)=>{timers.push(ms);return timers.length;},cancel:()=>{}});
 carousel.reset(3);carousel.step(-1);assert.equal(carousel.index,2);carousel.step(1);assert.equal(carousel.index,0);
 assert.equal(timers.at(-1),9000);
});
