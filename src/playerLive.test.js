import test from 'node:test';
import assert from 'node:assert/strict';
import {nextFeed,siblingChannel,feedsOf} from './liveEvents.js';

test('nextFeed walks signals in both directions, wraps and skips tried ones',()=>{
 const event={feeds:['a','b','c','d'].map(id=>({id}))};
 assert.equal(nextFeed(event,'a').id,'b');assert.equal(nextFeed(event,'d').id,'a');assert.equal(nextFeed(event,'a',-1).id,'d');
 assert.equal(nextFeed(event,'a',1,['b','c']).id,'d');assert.equal(nextFeed(event,'a',1,['b','c','d']),null);
 assert.equal(nextFeed({feeds:[{id:'a'}]},'a'),null);assert.deepEqual(feedsOf(null),[]);
});
test('siblingChannel stays in the category, skips events and wraps',()=>{
 const ch=(id,genre,extra)=>({id,genre,kind:'iptv',...extra}),list=[ch(1,'News'),ch(2,'Sport'),ch(3,'News',{isEvent:true}),ch(4,'News'),ch(5,'Sport')];
 assert.equal(siblingChannel(list,list[0]).id,4);assert.equal(siblingChannel(list,list[3]).id,1);assert.equal(siblingChannel(list,list[0],-1).id,4);
 assert.equal(siblingChannel(list,list[1],-1).id,5);assert.equal(siblingChannel(list,ch(9,'News')),null);assert.equal(siblingChannel([list[0]],list[0]),null);
});
