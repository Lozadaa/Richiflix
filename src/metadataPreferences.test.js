import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetadataPreferences} from './metadataPreferences.js';
const preset='a'.repeat(32),custom='b'.repeat(32);
function setup(initial=null){let stored=initial,writes=0,checks=0,fail=false;const options={preset,readToken:async()=>stored,writeToken:async value=>{writes++;stored=value;},checkToken:async()=>{checks++;if(fail)throw Error('TMDB no disponible');}};return {create:()=>createMetadataPreferences(options),stored:()=>stored,writes:()=>writes,checks:()=>checks,offline:()=>{fail=true;}};}
test('fresh metadata settings seed the preset once offline and never expose its value in status',async()=>{
 const state=setup(),metadata=state.create();state.offline();const [status,token]=await Promise.all([metadata.status(),metadata.token()]);assert.deepEqual(status,{configured:true,isDefault:true});assert.equal(token,preset);assert.equal(state.writes(),1);assert.equal(state.checks(),0);assert.ok(!JSON.stringify(status).includes(preset));
});
test('saved replacement and explicit disconnection survive reload; restoring the preset works',async()=>{
 const state=setup(custom),metadata=state.create();assert.deepEqual(await metadata.status(),{configured:true,isDefault:false});assert.equal(state.writes(),0);await metadata.save('');assert.equal(state.stored(),'');assert.deepEqual(await state.create().status(),{configured:false,isDefault:false});await metadata.save(preset);assert.deepEqual(await state.create().status(),{configured:true,isDefault:true});await metadata.save(custom);assert.equal(await state.create().token(),custom);
});
test('a rejected replacement keeps the saved token and an empty test preset remains disabled',async()=>{
 const state=setup(custom),metadata=state.create();await metadata.status();state.offline();await assert.rejects(metadata.save(preset),/no disponible/);assert.equal(await metadata.token(),custom);assert.equal(state.writes(),0);const disabled=createMetadataPreferences({preset:'',readToken:async()=>null,writeToken:async()=>{},checkToken:async()=>{}});assert.deepEqual(await disabled.status(),{configured:false,isDefault:false});
});
