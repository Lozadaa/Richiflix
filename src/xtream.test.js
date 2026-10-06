import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAccount,authenticate,loadXtreamCatalogue,loadXtreamEpisodes,loadXtreamVideoDetails,playbackURL,requestXtream} from './xtream.js';
import {canShowForKids} from './content.js';
const account=validateAccount({name:'eterboxtv',host:'http://example.test:8080/',username:'test user',password:'test/p@ss'});
const fetcher=async address=>{
 const url=new URL(address),action=url.searchParams.get('action');
 assert.equal(url.searchParams.get('username'),account.username);assert.equal(url.searchParams.get('password'),account.password);
 let data={user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8','ts']}};
 if(action?.endsWith('_categories'))data=[{category_id:'1',category_name:'Kids'}];
 else if(action==='get_live_streams')data=[{stream_id:12,name:'MLB Live',category_id:1}];
 else if(action==='get_vod_streams')data=[{stream_id:23,name:'Movie',category_id:1,container_extension:'mkv',stream_icon:'https://example.test/poster.jpg'},{stream_id:'../bad',name:'Invalid'}];
 else if(action==='get_series')data=[{series_id:34,name:'Show',category_id:1}];
 else if(action==='get_series_info')data={episodes:{'2':[{id:90,title:'Later',episode_num:2}],'1':[{id:89,title:'Second',episode_num:2},{id:88,title:'First',episode_num:1}]}};
 return new Response(JSON.stringify(data));
};
test('login validates host and rejects userinfo, query and missing credentials',()=>{
 assert.equal(account.host,'http://example.test:8080');
 for(const change of [{host:'file:///tmp/a'},{host:'https://user:pass@example.test'},{host:'https://example.test?password=x'},{username:''},{password:''}])assert.throws(()=>validateAccount({...account,...change}));
});
test('auth rejects inactive and bad login; returned connection excludes secrets',async()=>{
 const result=await authenticate(account,fetcher);assert.equal(result.status,'Active');assert.equal(result.password,undefined);assert.equal(result.username,undefined);
 await assert.rejects(authenticate(account,async()=>new Response('{"user_info":{"auth":0}}')),/no válidos/);
 await assert.rejects(authenticate(account,async()=>new Response('{"user_info":{"auth":1,"status":"Expired"}}')),/no está activa/);
});
test('all catalogue types load with stable opaque URLs and no implied Kids rating',async()=>{
 const data=await loadXtreamCatalogue(account,fetcher);
 assert.deepEqual([data.channels.length,data.movies.length,data.shows.length],[1,1,1]);
 assert.equal(data.movies[0].extension,'mkv');assert.equal(data.movies[0].genre,'Kids');
 assert.equal(canShowForKids(data.movies[0]),false);
 const serialised=JSON.stringify(data);assert.ok(!serialised.includes(account.username)&&!serialised.includes(account.password));
 assert.ok(data.movies[0].url.startsWith('xtream://'));assert.equal(data.movies[0].id,(await loadXtreamCatalogue(account,fetcher)).movies[0].id);
});
test('seasons and episodes sorted; episode uses series playback path',async()=>{
 const groups=await loadXtreamEpisodes(account,'34',fetcher);assert.deepEqual(groups.map(group=>group.season),['1','2']);
 assert.deepEqual(groups[0].episodes.map(item=>item.episodeNumber),[1,2]);
 assert.equal(playbackURL(account,groups[0].episodes[0]),'http://example.test:8080/series/test%20user/test%2Fp%40ss/88.mp4');
 await assert.rejects(loadXtreamEpisodes(account,'../bad',fetcher));
});
test('live formats and containers match provider; invalid IDs and series roots rejected',()=>{
 assert.match(playbackURL(account,{streamId:12,mediaType:'live'},['ts']),/\/12.ts$/);
 assert.match(playbackURL(account,{streamId:23,mediaType:'movie',extension:'MKV'}),/\/23.mkv$/);
 for(const item of [{streamId:'../escape',mediaType:'live'},{streamId:34,mediaType:'series'}])assert.throws(()=>playbackURL(account,item));
});
test('network and malformed response errors never echo credential URL',async()=>{
 await assert.rejects(requestXtream(account,null,{},async url=>{throw Error(url);}),error=>!error.message.includes(account.password)&&!error.message.includes('password='));
 await assert.rejects(requestXtream(account,null,{},async()=>new Response('bad json')),/catálogo Xtream válido/);
});
test('missing or invalid detail fields preserve usable catalogue metadata when merged',async()=>{
 const base={trailerId:'TY1lWh20VSw',backdropImage:'https://images.test/catalogue.jpg',durationSeconds:7200,year:'2025',cast:'Catalogue cast',director:'Catalogue director',description:'Catalogue synopsis'};
 for(const info of [{},{youtube_trailer:'bad',backdrop_path:'javascript:bad',duration_secs:0,cast:'',director:'',plot:''}]){
  const details=await loadXtreamVideoDetails(account,'23',async()=>new Response(JSON.stringify({info})));
  assert.deepEqual(details,{});assert.deepEqual({...base,...details},base);
 }
});
test('valid provider detail fields still replace catalogue metadata',async()=>{
 const info={youtube_trailer:'https://youtu.be/TY1lWh20VSw',backdrop_path:['https://images.test/detail.jpg'],duration_secs:'5400',releasedate:'2026-10-05',plot:'Provider synopsis',genre:'Drama',actors:'Provider cast',director:'Provider director'};
 const details=await loadXtreamVideoDetails(account,'23',async()=>new Response(JSON.stringify({info})));
 assert.deepEqual(details,{description:'Provider synopsis',contentGenre:'Drama',backdropImage:'https://images.test/detail.jpg',trailerId:'TY1lWh20VSw',durationSeconds:5400,year:'2026',cast:'Provider cast',director:'Provider director'});
});
test('stalled preview metadata stops at ten seconds and frees its queue slot',async context=>{
 context.mock.timers.enable({apis:['setTimeout']});let aborted=false;
 const details=loadXtreamVideoDetails(account,'23',(_url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));})));
 const rejected=assert.rejects(details,/No se pudo conectar/);context.mock.timers.tick(9999);assert.equal(aborted,false);context.mock.timers.tick(1);await rejected;assert.equal(aborted,true);
});
