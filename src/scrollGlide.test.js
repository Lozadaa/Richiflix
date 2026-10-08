import test from 'node:test';
import assert from 'node:assert/strict';
import {createScrollGlide} from './scrollGlide.js';
function fixture(){let position=0,time=0,id=0;const frames=new Map(),writes=[];const glide=createScrollGlide({read:()=>position,write:value=>{position=value;writes.push(value);},request:callback=>{frames.set(++id,callback);return id;},cancel:id=>frames.delete(id),now:()=>time});return {glide,writes,frames,get position(){return position;},tick(ms){time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(time));},external(value){position=value;}};}
test('one viewport glide retargets held keys and settles within 220 ms without queueing animations',()=>{
 const f=fixture();f.glide.to(400);assert.equal(f.position,0);f.tick(40);assert.ok(f.position>0&&f.position<400);
 f.glide.to(800);f.glide.to(1200);assert.equal(f.frames.size,1);f.tick(60);assert.ok(f.position>400);f.tick(160);assert.equal(f.position,1200);assert.equal(f.glide.moving,false);
});
test('an unchanged destination does not restart movement; manual scrolling and disposal cancel pending work',()=>{
 const f=fixture();f.glide.to(600);f.tick(60);f.glide.to(600);f.tick(80);assert.equal(f.position,600);assert.equal(f.glide.moving,false);
 f.glide.to(1200);f.external(30);f.tick(20);assert.equal(f.position,30);assert.equal(f.frames.size,0);
 f.glide.to(600);f.glide.stop();assert.equal(f.frames.size,0);f.glide.to(50,false);assert.equal(f.position,50);
});
test('TV bounds shorten the glide to 150 ms at most',()=>{
 let position=0,time=0;const frames=[];const glide=createScrollGlide({read:()=>position,write:value=>{position=value;},request:callback=>frames.push(callback),cancel(){},now:()=>time,min:90,max:150});
 glide.to(2000);time=150;frames.splice(0).forEach(callback=>callback(time));assert.equal(position,2000);assert.equal(glide.moving,false);
});
