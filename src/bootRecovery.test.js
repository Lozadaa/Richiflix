import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverBootProfiles} from './bootRecovery.js';
test('a slow profile backup cannot open profile creation at the four-second resource deadline',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});let finished=false;const saved=[{id:'original',name:'Adulto',kind:'adult'}];
 const work=recoverBootProfiles({local:()=>null,read:()=>new Promise(resolve=>setTimeout(()=>resolve(saved),5000))});work.then(()=>{finished=true;});await Promise.resolve();context.mock.timers.tick(4000);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(finished,false);context.mock.timers.tick(1000);assert.deepEqual(await work,saved);context.mock.timers.reset();
});
test('existing local profiles still wait for the canonical backup before opening the gate',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});const local=[{id:'a',name:'Adulto',kind:'adult'}],canonical=[...local,{id:'b',name:'Kids',kind:'kids'}];let finished=false;
 const work=recoverBootProfiles({local:()=>local,read:()=>new Promise(resolve=>setTimeout(()=>resolve(canonical),5000))});work.then(()=>{finished=true;});await Promise.resolve();context.mock.timers.tick(4000);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(finished,false);context.mock.timers.tick(1000);assert.deepEqual(await work,canonical);context.mock.timers.reset();
});
test('a failed backup with no local list reaches retry handling instead of becoming an empty installation',async()=>{
 await assert.rejects(recoverBootProfiles({local:()=>null,read:async()=>{throw Error('recovery-failed');}}),/recovery-failed/);
});
test('a failed backup with existing local profiles also keeps creation closed for retry',async()=>{
 await assert.rejects(recoverBootProfiles({local:()=>[{id:'a',name:'Adulto',kind:'adult'}],read:async()=>{throw Error('recovery-failed');}}),/recovery-failed/);
});
