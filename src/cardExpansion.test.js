import test from 'node:test';
import assert from 'node:assert/strict';
import {expandedCardPlacement,createCardPress} from './cardExpansion.js';
test('expanded cards grow horizontally without exceeding the visible catalogue or header',()=>{
 const viewport={left:0,top:500,width:1920,height:580};
 for(const left of [0,200,900,1720])for(const top of [490,550,850,1050]){
  const anchor={left,top,width:210,height:380,bottom:top+380},result=expandedCardPlacement(anchor,viewport,{tv:true});
  assert.ok(result.width/anchor.width>result.height/anchor.height);
  assert.ok(result.left>=16&&result.left+result.width<=1904);
  assert.ok(result.top>=516&&result.top+result.height<=1064);
  assert.ok(result.originX>=0&&result.originX<=100);
 }
});
test('small screens clamp the complete panel and invisible cards never mount it',()=>{
 const viewport={left:0,top:100,width:400,height:420},anchor={left:0,top:160,width:130,height:300,bottom:460},panel=expandedCardPlacement(anchor,viewport,{tv:true});
 assert.ok(panel.width<=368&&panel.height<=388);assert.equal(expandedCardPlacement({...anchor,top:-400,bottom:-100},viewport),null);
 assert.equal(expandedCardPlacement(anchor,{...viewport,height:220}),null);
 const live=expandedCardPlacement({...anchor,width:340,height:240}, {...viewport,width:1920,height:900},{tv:true,live:true});assert.ok(live.height<300);
});
test('short OK plays on release; held OK opens actions once and never also plays',()=>{
 const jobs=new Map();let next=0,plays=0,actions=0;
 const gesture=createCardPress({short:()=>plays++,long:()=>actions++,schedule:fn=>{jobs.set(++next,fn);return next;},cancel:id=>jobs.delete(id)});
 gesture.down();gesture.up();assert.equal(plays,1);assert.equal(jobs.size,0);
 gesture.down();gesture.down();assert.equal(jobs.size,1);[...jobs.values()][0]();gesture.up();assert.equal(actions,1);assert.equal(plays,1);
 gesture.down();gesture.cancel();assert.equal(gesture.up(),false);assert.equal(plays,1);
 gesture.down();gesture.up();assert.equal(plays,2);
});
