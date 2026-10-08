import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileLibrary} from './libraryStorage.js';
const local=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const backup=values=>async(key,value)=>{if(value===undefined)return structuredClone(values.get(key));values.set(key,structuredClone(value));};
test('library migration keeps IDs and both favorite and playback data',async()=>{
 const storage=local(),values=new Map();storage.setItem('rf-favorites-person','["movie-a","movie-a","movie-b"]');storage.setItem('rf-history-person','{"movie-a":127,"bad":-1}');
 const library=createProfileLibrary('person',{local:storage,backup:backup(values),now:()=>100});await library.load();await library.flush();
 assert.deepEqual(library.get(),{favorites:['movie-a','movie-b'],history:{'movie-a':127},teams:[]});
 assert.equal(values.get('rf-library-v1:person').version,1);
 const restored=createProfileLibrary('person',{local:local(),backup:backup(values)});await restored.load();assert.deepEqual(restored.get(),library.get());
});
test('a delayed backup cannot replace a recent favorite click',async()=>{
 const storage=local();let release;
 const delayed=new Promise(resolve=>{release=resolve;});const writes=[];
 const library=createProfileLibrary('person',{local:storage,backup:async(_key,value)=>value===undefined?delayed:writes.push(value),now:()=>100});
 const load=library.load();library.setFavorites(previous=>[...previous,'recent']);release({version:1,updatedAt:99,data:{favorites:['old'],history:{}}});await load;await library.flush();
 assert.deepEqual(library.get().favorites,['recent']);assert.deepEqual(writes.at(-1).data.favorites,['recent']);
});
test('library commits serialize and keep edits made while a backup is writing',async()=>{
 let release,block=true;const writes=[];const storage=local();
 const library=createProfileLibrary('person',{local:storage,backup:async(_key,value)=>{if(value===undefined)return null;if(block){block=false;await new Promise(resolve=>{release=resolve;});}writes.push(structuredClone(value));},now:()=>100});
 library.setHistory({a:10});const first=library.flush();for(let i=0;i<10;i++)await Promise.resolve();library.setHistory(previous=>({...previous,b:20}));library.setFavorites(['b']);const latest=library.flush();release();await Promise.all([first,latest]);
 assert.deepEqual(writes.at(-1).data,{favorites:['b'],history:{a:10,b:20},teams:[]});assert.equal(writes.at(-1).updatedAt,102);
});
test('an unknown future library is preserved and recovery uses a separate key',async()=>{
 const storage=local(),future={version:9,updatedAt:200,data:{newFeature:true}},values=new Map([['rf-library-v1:person',future]]);storage.setItem('rf-library-v1:person',JSON.stringify(future));
 const library=createProfileLibrary('person',{local:storage,backup:backup(values),now:()=>300});await library.load();library.setFavorites(['safe']);await library.flush();
 assert.deepEqual(JSON.parse(storage.getItem('rf-library-v1:person')),future);assert.deepEqual(values.get('rf-library-v1:person'),future);assert.deepEqual(values.get('rf-library-v1:person:recovery-v1').data.favorites,['safe']);
});
test('a recovery backup remains discoverable when the primary envelope is absent',async()=>{
 const values=new Map([['rf-library-v1:person:recovery-v1',{version:1,updatedAt:200,data:{favorites:['safe'],history:{safe:80},teams:[]}}]]),library=createProfileLibrary('person',{local:local(),backup:backup(values),now:()=>300});await library.load();assert.deepEqual(library.get(),{favorites:['safe'],history:{safe:80},teams:[]});
});
test('L7: followed teams persist in the versioned backup; old envelopes load as []',async()=>{
 const values=new Map([['rf-library-v1:person',{version:1,updatedAt:50,data:{favorites:['a'],history:{}}}]]);
 const old=createProfileLibrary('person',{local:local(),backup:backup(values),now:()=>100});await old.load();assert.deepEqual(old.get().teams,[]);assert.deepEqual(old.get().favorites,['a']);
 old.setTeams([147,147,'139',139.5,...Array.from({length:12},(_,i)=>108+i)]);assert.deepEqual(old.get().teams,[147,108,109,110,111,112,113,114,115,116]);
 old.setTeams(previous=>previous.filter(id=>id!==147));await old.flush();assert.deepEqual(values.get('rf-library-v1:person').data.teams,[108,109,110,111,112,113,114,115,116]);
 const restored=createProfileLibrary('person',{local:local(),backup:backup(values)});await restored.load();assert.deepEqual(restored.get(),old.get());
});
