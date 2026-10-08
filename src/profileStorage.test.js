import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileStorage} from './profileStorage.js';
import {recoverBootProfiles} from './bootRecovery.js';
const person={id:'saved-person',name:'Adulto',kind:'adult',avatar:'adult-raccoon.png'};
function setup(initial=[],saved=[]){const values=new Map(initial),backups=new Map(saved);return {values,backups,options:{local:()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}),backup:async(key,value)=>{if(value===undefined)return structuredClone(backups.get(key));backups.set(key,structuredClone(value));},now:()=>100}};}
test('profiles migrate without changing IDs and recover when local storage is gone',async()=>{
 const state=setup([['rf-profiles',JSON.stringify([person])]]),store=createProfileStorage(state.options);assert.deepEqual(await store.loadProfiles(),[person]);assert.equal(state.backups.get('rf-profiles-v2').version,2);
 state.values.clear();assert.deepEqual(await createProfileStorage(state.options).loadProfiles(),[person]);
});
test('legacy profile backup is recovered even when the local list is empty',async()=>{
 const state=setup([['rf-profiles','[]']],[['rf-profiles',[person]]]);assert.deepEqual(await createProfileStorage(state.options).loadProfiles(),[person]);
});
test('a recovery copy remains discoverable when the primary profile envelope is absent',async()=>{
 const state=setup([],[['rf-profiles-v2:recovery-v2',{version:2,updatedAt:50,profiles:[person]}]]);assert.deepEqual(await createProfileStorage(state.options).loadProfiles(),[person]);
});
test('a save during delayed recovery preserves the newly created profile',async()=>{
 const state=setup();let release;const delayed=new Promise(resolve=>{release=resolve;});state.options.backup=async(_key,value)=>value===undefined?delayed:value;
 const store=createProfileStorage(state.options),load=store.loadProfiles(),newProfile={...person,id:'new-person'};const saving=store.saveProfiles([newProfile]);release({version:2,updatedAt:50,profiles:[person]});await saving;assert.deepEqual(await load,[newProfile]);assert.deepEqual(store.localProfiles(),[newProfile]);
});
test('unknown future profile envelopes survive migration and explicit saves',async()=>{
 const future={version:12,updatedAt:200,profiles:[{id:'future',newSchema:true}]},state=setup([['rf-profiles-v2',JSON.stringify(future)]],[['rf-profiles-v2',future]]),store=createProfileStorage(state.options);
 await assert.rejects(store.loadProfiles(),/versión más reciente/);await store.saveProfiles([person]);assert.deepEqual(JSON.parse(state.values.get('rf-profiles-v2')),future);assert.deepEqual(state.backups.get('rf-profiles-v2'),future);assert.deepEqual(state.backups.get('rf-profiles-v2:recovery-v2').profiles,[person]);
});
test('failed recovery can be retried and never fabricates an empty installation',async()=>{
 const state=setup();let fail=true;state.options.backup=async(_key,value)=>{if(value!==undefined)return value;if(fail)throw Error('blocked');return {version:2,updatedAt:50,profiles:[person]};};const store=createProfileStorage(state.options);await assert.rejects(store.loadProfiles(),/recuperar/);fail=false;assert.deepEqual(await store.loadProfiles(),[person]);
});
test('failure of both stores rejects a profile save instead of claiming persistence',async()=>{
 const store=createProfileStorage({local:()=>({getItem:()=>null,setItem:()=>{throw Error('quota');}}),backup:async()=>{throw Error('blocked');}});await assert.rejects(store.saveProfiles([person]),/guardar el perfil/);
});
test('a late canonical backup is recovered before adding a profile, preserving all three IDs',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});
 const a=person,b={...person,id:'backup-only',name:'Kids',kind:'kids'},c={...person,id:'new-profile',name:'Nuevo'},state=setup([['rf-profiles',JSON.stringify([a])]],[['rf-profiles-v2',{version:2,updatedAt:200,profiles:[a,b]}]]),original=state.options.backup;
 state.options.backup=async(key,value)=>{if(value===undefined&&key==='rf-profiles-v2')await new Promise(resolve=>setTimeout(resolve,5000));return original(key,value);};
 const store=createProfileStorage(state.options);let gateOpen=false;
 const loading=recoverBootProfiles({read:store.loadProfiles});loading.then(()=>{gateOpen=true;});await Promise.resolve();context.mock.timers.tick(4000);for(let i=0;i<8;i++)await Promise.resolve();assert.equal(gateOpen,false);
 context.mock.timers.tick(1000);const canonical=await loading;assert.deepEqual(canonical.map(profile=>profile.id),[a.id,b.id]);await store.saveProfiles([...canonical,c]);assert.deepEqual(state.backups.get('rf-profiles-v2').profiles.map(profile=>profile.id),[a.id,b.id,c.id]);context.mock.timers.reset();
});
test('a failed canonical read does not silently fall back to an editable local list',async()=>{
 const state=setup([['rf-profiles',JSON.stringify([person])]]);state.options.backup=async()=>{throw Error('blocked');};await assert.rejects(createProfileStorage(state.options).loadProfiles(),/recuperar/);assert.deepEqual(JSON.parse(state.values.get('rf-profiles')),[person]);
});
