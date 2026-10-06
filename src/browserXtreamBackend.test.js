import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createBrowserXtreamBackend} from './browserXtreamBackend.js';
import {accountKey} from './xtream.js';

const account={name:'Fixture',host:'http://provider.example.test',username:'fixture-user',password:'fixture-password'};
function fixture(){const saved=new Map();return {saved,storage:async(key,value)=>{if(value===undefined)return saved.get(key);saved.set(key,value);return value;}};}
async function decrypt(value){return new TextDecoder().decode(await webcrypto.subtle.decrypt({name:'AES-GCM',iv:value.iv},value.key,value.data));}
async function encrypted(value){const key=await webcrypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),iv=webcrypto.getRandomValues(new Uint8Array(12)),data=await webcrypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value));return {key,iv,data};}

test('worker backend preserves encrypted source and metadata envelopes and preset behavior',async()=>{
 const {storage,saved}=fixture(),backend=createBrowserXtreamBackend({storage,cryptography:webcrypto,registryOptions:{preset:account},metadataOptions:{preset:''},fetcher:()=>{throw Error('Unexpected network');}});
 const status=await backend.status();assert.equal(status.configured,true);assert.equal(status.sources[0].id,'eterboxtv');assert.equal(status.sources[0].key,accountKey(account));
 const sources=JSON.parse(await decrypt(saved.get('sources')));assert.deepEqual(sources,[{...account,sourceId:'eterboxtv'}]);assert.equal(saved.get('sources').key.extractable,false);
 assert.deepEqual(await backend.metadataStatus(),{configured:false,isDefault:false});assert.equal(await decrypt(saved.get('metadata-token')),'');assert.equal(saved.get('metadata-token').iv.length,12);
});
test('legacy account migration and legacy catalogue cache remain readable without network',async()=>{
 const {storage,saved}=fixture();saved.set('account',await encrypted(JSON.stringify(account)));const key=accountKey(account),cache={connection:{key,formats:['m3u8']},channels:[{id:'live-1',kind:'iptv',title:'Canal',genre:'Deportes',eventStartsAt:Date.UTC(2026,9,5,20)}],movies:[{id:'movie-1',genre:'Drama'}],shows:[],updatedAt:new Date().toISOString()};saved.set('catalogue-'+key,cache);
 const backend=createBrowserXtreamBackend({storage,cryptography:webcrypto,registryOptions:{preset:null},metadataOptions:{preset:''},fetcher:()=>{throw Error('Unexpected network');}}),data=await backend.catalogue(false);
 assert.equal(data.channels[0].sourceId,'eterboxtv');assert.equal(data.preparedChannels[0].eventStartsAt,cache.channels[0].eventStartsAt);assert.deepEqual(data.preparedGroups.movies.categoryPositions.Drama,[0]);assert.equal(data.preparedGroups.channels.categories[0],'Deportes');assert.equal(JSON.parse(await decrypt(saved.get('sources')))[0].sourceId,'eterboxtv');
});
test('fresh worker catalogue performs parsing and preparation before returning render data',async()=>{
 const {storage,saved}=fixture(),calls=[];const fetcher=async address=>{const action=new URL(address).searchParams.get('action');calls.push(action);return new Response(JSON.stringify(!action?{user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8']}}:action.endsWith('_categories')?[{category_id:'1',category_name:'Drama'}]:action==='get_live_streams'?[{stream_id:11,name:'Canal',category_id:'1'}]:action==='get_vod_streams'?[{stream_id:21,name:'Película',category_id:'1'}]:action==='get_series'?[{series_id:31,name:'Serie',category_id:'1'}]:[]));};
 const backend=createBrowserXtreamBackend({storage,cryptography:webcrypto,fetcher,registryOptions:{preset:account},metadataOptions:{preset:''}}),data=await backend.catalogue(true);
 assert.equal(await backend.catalogue(false),data,'Repeated catalogue access reuses prepared worker data');assert.equal(calls.length,7);assert.equal(data.movies.length,1);assert.equal(data.shows.length,1);assert.equal(data.preparedChannels.length,1);assert.deepEqual(data.preparedGroups.movies.categoryPositions.Drama,[0]);assert.ok(saved.has('catalogue-eterboxtv'));assert.equal(saved.get('catalogue-eterboxtv').preparedGroups,undefined,'persistent catalogue format remains unchanged');
});
