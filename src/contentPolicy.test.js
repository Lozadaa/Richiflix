import test from 'node:test';
import assert from 'node:assert/strict';
import {isPornographic,isPornographicCategory,filterCatalogue} from './contentPolicy.js';
import {forProfile,canShowForKids} from './content.js';
import {parseM3U} from './catalog.js';
import {loadXtreamCatalogue,loadXtreamEpisodes,playbackURL,accountKey} from './xtream.js';
import {spanishMetadata} from './metadata.js';
import {createSourceRegistry} from './sourceRegistry.js';
import {fixtureResponse} from '../scripts/xtream-fixture.mjs';
const account={name:'Fixture',host:'https://example.test',username:'fixture',password:'fixture',sourceId:'eterboxtv'};
test('global policy blocks provider flags and decorated erotic categories in every profile',()=>{
 for(const name of ['ES | XXX','ADULTOS +18','Adult Only','Erótico','ＰＯＲＮＯ','X X X','Sexy Hot','Playboy HD'])assert.equal(isPornographicCategory(name),true,name);
 for(const value of [true,1,'1','true','yes'])assert.equal(isPornographic({title:'Neutral',is_adult:value}),true);
 for(const value of [false,0,'0','false','no',undefined])assert.equal(isPornographic({title:'Neutral',adult:value}),false);
 const items=[{id:'normal',title:'Película',kind:'vod'},{id:'blocked',title:'Canal',category:'XXX',kind:'vod'}];
 assert.deepEqual(forProfile(items,{kind:'adult'}).map(item=>item.id),['normal']);
 assert.equal(canShowForKids(items[1],[{id:'blocked',minAge:0,source:'https://rating.test',checkedAt:'2026-10-06'}]),false);
});
test('normal mature cinema, suggestive ordinary series names and sports remain available',()=>{
 for(const title of ['xXx','xXx: Return of Xander Cage','Sex Education','Sexo en Nueva York','Masters of Sex','Adultos','MLB Yankees vs Rays'])assert.equal(isPornographic({title,mediaType:'movie',category:'Drama',ageRating:'18+',adult:false}),false,title);
 assert.equal(isPornographic({title:'Venus',mediaType:'movie',category:'Ciencia ficción'}),false);
 assert.equal(isPornographic({title:'Venus HD',mediaType:'live'}),true);
});
test('manual M3U imports discard blocked channels before constructing the catalogue',()=>{
 const items=parseM3U('#EXTM3U\n#EXTINF:-1 group-title="XXX",Neutral\nhttps://stream.test/one\n#EXTINF:-1 group-title="Deportes",MLB\nhttps://stream.test/two\n#EXTINF:-1,Brazzers HD\nhttps://stream.test/three');
 assert.deepEqual(items.map(item=>item.title),['MLB']);
});
test('Xtream filters category flags, secondary category IDs and raw flags before normalization',async()=>{
 const data=await loadXtreamCatalogue(account,async address=>{const url=new URL(address),action=url.searchParams.get('action');let response=fixtureResponse(address);
  if(action?.endsWith('_categories'))response=[{category_id:'1',category_name:'Cine'},{category_id:'2',category_name:'Neutral',is_adult:'1'},{category_id:'3',category_name:'XXX'}];
  if(['get_live_streams','get_vod_streams','get_series'].includes(action))response=[{stream_id:1,series_id:1,name:'Normal',category_id:1},{stream_id:2,series_id:2,name:'Neutral',category_id:2},{stream_id:3,series_id:3,name:'Other',category_id:1,category_ids:[1,3]},{stream_id:4,series_id:4,name:'Neutral',category_id:1,is_adult:'1'}];
  return new Response(JSON.stringify(response));});
 for(const type of ['channels','movies','shows'])assert.deepEqual(data[type].map(item=>item.streamId),['1']);
});
test('legacy caches are filtered offline and prepared indices are discarded if positions change',async()=>{
 const normal={id:'safe',title:'Normal',mediaType:'movie',streamId:'23',genre:'Drama'},blocked={id:'bad',title:'Neutral',mediaType:'movie',streamId:'24',category:'XXX'};
 const cached={connection:{key:accountKey(account),formats:['m3u8']},channels:[],movies:[blocked,normal],shows:[],updatedAt:new Date().toISOString(),preparedGroups:{movies:{categoryPositions:{Drama:[1]}}}};
 const clean=await filterCatalogue(cached);assert.deepEqual(clean.movies,[normal]);assert.equal(clean.preparedGroups,undefined);
 const manager=createSourceRegistry({preset:account,readAccounts:async()=>[account],writeAccounts:async()=>{},readCache:async()=>cached,writeCache:async()=>{},fetcher:()=>assert.fail('Offline cache must not fetch')});
 assert.deepEqual((await manager.catalogue()).movies.map(item=>item.id),['safe']);
});
test('series parent flags and blocked episode flags prevent erotic episode navigation',async()=>{
 assert.deepEqual(await loadXtreamEpisodes(account,'34',async()=>new Response(JSON.stringify({info:{adult:1},episodes:{1:[{id:88,title:'Neutral'}]}}))),[]);
 const groups=await loadXtreamEpisodes(account,'34',async()=>new Response(JSON.stringify({episodes:{1:[{id:88,title:'Normal'},{id:89,title:'Neutral',info:{is_adult:'1'}}]}})));
 assert.deepEqual(groups[0].episodes.map(item=>item.streamId),['88']);
 assert.throws(()=>playbackURL(account,{mediaType:'movie',streamId:89,adult:true}),/bloqueado/);
});
test('playback cannot revive a blocked cached title by forging harmless metadata',async()=>{
 const url=`xtream://${accountKey(account)}/movie/24.mp4`,cached={connection:{key:accountKey(account),formats:['m3u8']},channels:[],movies:[{url,streamId:'24',mediaType:'movie',title:'Neutral',category:'XXX'}],shows:[],updatedAt:new Date().toISOString()};
 const manager=createSourceRegistry({preset:account,readAccounts:async()=>[account],writeAccounts:async()=>{},readCache:async()=>cached,writeCache:async()=>{}});
 await assert.rejects(manager.playback({url,sourceId:'eterboxtv',streamId:'24',mediaType:'movie',title:'Normal'}),/catálogo permitido/);
});
test('TMDB adult metadata exposes only the block marker and persists exclusion across reload and refresh',async()=>{
 const metadata={adult:true,title:'Neutral',overview:'Hidden',poster_path:'/hidden.jpg',backdrop_path:'/hidden.jpg',videos:{results:[{site:'YouTube',type:'Trailer',key:'TY1lWh20VSw'}]}};
 assert.deepEqual(await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify(metadata))),{isPornographic:true});
 let saved;const details=new Map(),options={preset:account,readAccounts:async()=>[account],writeAccounts:async()=>{},readCache:async()=>saved,writeCache:async(_account,data)=>{saved=data;},metadataToken:async()=>'x'.repeat(30),readDetails:async key=>details.get(key),writeDetails:async(key,data)=>{details.set(key,data);},fetcher:async address=>{const url=new URL(address),data=url.hostname==='api.themoviedb.org'?metadata:fixtureResponse(address);if(url.searchParams.get('action')==='get_vod_info')data.info.tmdb_id=123;return new Response(JSON.stringify(data));}};
 const manager=createSourceRegistry(options),before=await manager.catalogue();assert.equal(before.movies.length,1);
 assert.deepEqual(await manager.details('23'),{isPornographic:true});assert.equal((await manager.catalogue()).movies.length,0);
 assert.equal((await createSourceRegistry(options).catalogue()).movies.length,0);
 assert.equal((await createSourceRegistry(options).catalogue(true)).movies.length,0);
 await assert.rejects(manager.playback(before.movies[0]),/catálogo permitido/);
 const uncached={...options,readCache:async()=>null,writeCache:async()=>{},readDetails:async()=>null},direct=createSourceRegistry(uncached),first=(await direct.catalogue()).movies[0];
 await assert.rejects(direct.playback(first),/bloqueado/);assert.equal((await direct.catalogue()).movies.length,0);
});
