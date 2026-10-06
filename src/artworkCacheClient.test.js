import test from 'node:test';
import assert from 'node:assert/strict';
import {createArtworkCacheClient} from './artworkCacheClient.js';
const src='https://image.tmdb.org/t/p/w780/test.jpg';
function fixture(){const listeners={},messages=[],created=[],revoked=[];const cache=createArtworkCacheClient({createWorker:()=>({addEventListener:(name,fn)=>listeners[name]=fn,postMessage:message=>messages.push(message),terminate(){}}),urls:{createObjectURL:()=>{const value='blob:fixture-'+created.length;created.push(value);return value;},revokeObjectURL:value=>revoked.push(value)}});return {cache,messages,created,revoked,respond:(id,value)=>listeners.message({data:{id,value}})};}
test('simultaneous image consumers share one blob URL and revoke it after the last DOM consumer leaves',async()=>{
 const {cache,messages,created,revoked,respond}=fixture(),a=cache.acquire(src),b=cache.acquire(src);assert.equal(messages.length,1);respond(messages[0].id,new Blob(['image']));assert.equal(await a.ready,await b.ready);assert.equal(created.length,1);a.release();a.release();assert.equal(revoked.length,0);b.release();assert.deepEqual(revoked,created);assert.equal(cache.diagnostics().activeImages,0);cache.dispose();
});
test('late storage replies never allocate a blob URL after a component unmounts or falls back to network',async()=>{
 const {cache,messages,created,respond}=fixture(),image=cache.acquire(src);image.release();respond(messages[0].id,new Blob(['image']));assert.equal(await image.ready,null);assert.equal(created.length,0);cache.dispose();
});
test('missing worker support resolves to ordinary loading and does not retain image handles',async()=>{
 const cache=createArtworkCacheClient({createWorker:()=>{throw Error('Unsupported');}}),image=cache.acquire(src);assert.equal(await image.ready,null);image.release();assert.equal(cache.diagnostics().activeImages,0);assert.equal(cache.diagnostics().disabled,true);cache.dispose();
});
