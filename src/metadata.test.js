import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeID,spanishMetadata,checkMetadataToken,validateMetadataToken} from './metadata.js';
import {loadXtreamVideoDetails} from './xtream.js';
import {composeChannels} from './channelArtwork.js';
import {artworkURL,displayTitle} from './artwork.js';
import {artworkCategory} from './categoryArtwork.js';
test('category artwork follows metadata without adding classifications or changing content',()=>{
 assert.equal(artworkCategory({kind:'iptv',title:'MLB 04',genre:'Deportes'}).key,'baseball');
 assert.equal(artworkCategory({mediaType:'movie',title:'A film',contentGenre:'Animation, Family'}).key,'animation');
 assert.equal(artworkCategory({mediaType:'series',title:'Unknown series'}).key,'series');
 assert.equal(artworkCategory({mediaType:'movie',title:'Unknown film'}).key,'cinema');
});
test('trailers accept actual YouTube IDs and links, reject arbitrary URLs and invalid IDs',()=>{
 for(const url of ['TY1lWh20VSw','https://youtu.be/TY1lWh20VSw','https://www.youtube.com/watch?v=TY1lWh20VSw','https://www.youtube.com/embed/TY1lWh20VSw'])assert.equal(youtubeID(url),'TY1lWh20VSw');
 for(const value of ['short','javascript:alert(1)','https://evil.test/watch?v=TY1lWh20VSw','https://youtube.com.evil.test/embed/TY1lWh20VSw'])assert.equal(youtubeID(value),undefined);
});
test('Spanish metadata uses exact provider TMDB ID, es-ES and official Spanish trailer',async()=>{
 const fetcher=async(address,options)=>{const url=new URL(address);assert.equal(url.pathname,'/3/movie/123');assert.equal(url.searchParams.get('language'),'es-ES');assert.equal(url.searchParams.get('append_to_response'),'videos');assert.equal(url.searchParams.get('include_video_language'),'es,en,null');assert.equal(options.headers.Authorization,'Bearer '+ 'x'.repeat(30));return new Response(JSON.stringify({title:'Título español',overview:'Una aventura en español.',videos:{results:[{site:'YouTube',type:'Trailer',key:'TY1lWh20VSw',official:true,iso_639_1:'es'}]}}));};
 const details=await spanishMetadata('123','movie','x'.repeat(30),fetcher);assert.equal(details.descriptionLanguage,'es');assert.equal(details.localizedTitle,'Título español');assert.equal(details.trailerId,'TY1lWh20VSw');
 assert.deepEqual(await spanishMetadata('../bad','movie','x'.repeat(30),()=>assert.fail()),{});
});
test('Spanish trailers take priority over English, with official videos preferred within each language',async()=>{
 const videos=[
  {site:'YouTube',type:'Trailer',key:'ENtrailer01',official:true,iso_639_1:'en'},
  {site:'YouTube',type:'Trailer',key:'EStrailer01',official:false,iso_639_1:'es'},
  {site:'YouTube',type:'Trailer',key:'EStrailer02',official:true,iso_639_1:'es'},
 ];
 const details=await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({videos:{results:videos}})));
 assert.equal(details.trailerId,'EStrailer02');
 const withoutOfficial=await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({videos:{results:videos.slice(0,2)}})));
 assert.equal(withoutOfficial.trailerId,'EStrailer01');
});
test('English TV trailers are selected in one request while title and synopsis remain Spanish',async()=>{
 let requests=0;
 const details=await spanishMetadata(456,'series','x'.repeat(30),async address=>{
  requests++;const url=new URL(address);assert.equal(url.pathname,'/3/tv/456');assert.equal(url.searchParams.get('language'),'es-ES');assert.equal(url.searchParams.get('include_video_language'),'es,en,null');
  return new Response(JSON.stringify({name:'Serie en español',overview:'La sinopsis española.',videos:{results:[
   {site:'YouTube',type:'Trailer',key:'ENtrailer01',official:false,iso_639_1:'en'},
   {site:'YouTube',type:'Trailer',key:'ENtrailer02',official:true,iso_639_1:'en'},
  ]}}));
 });
 assert.equal(requests,1);assert.equal(details.localizedTitle,'Serie en español');assert.equal(details.description,'La sinopsis española.');assert.equal(details.descriptionLanguage,'es');assert.equal(details.trailerId,'ENtrailer02');
});
test('invalid Spanish candidates do not prevent English fallback or invent an absent trailer',async()=>{
 const videos=[null,{site:'YouTube',type:'Trailer',key:'invalid',iso_639_1:'es'},
  {site:'Vimeo',type:'Trailer',key:'EStrailer01',iso_639_1:'es'},
  {site:'YouTube',type:'Teaser',key:'EStrailer01',iso_639_1:'es'},
  {site:'YouTube',type:'Trailer',key:'FRtrailer01',iso_639_1:'fr'},
  {site:'YouTube',type:'Trailer',key:'ENtrailer01',iso_639_1:'en'},
 ];
 const details=await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({videos:{results:videos}})));
 assert.equal(details.trailerId,'ENtrailer01');
 const missing=await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({title:'Título',videos:{results:{}}})));
 assert.equal(Object.hasOwn(missing,'trailerId'),false);assert.equal(missing.localizedTitle,'Título');
});
test('trailers without language tags remain a final fallback',async()=>{
 const details=await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({videos:{results:[
  {site:'YouTube',type:'Trailer',key:'XXtrailer01',official:false,iso_639_1:null},
  {site:'YouTube',type:'Trailer',key:'XXtrailer02',official:true},
 ]}})));
 assert.equal(details.trailerId,'XXtrailer02');
});
test('missing Spanish summaries and network failures never erase provider descriptions',async()=>{
 const base={host:'https://fixture.test',username:'fixture',password:'fixture-password'};
 const fetcher=async address=>new Response(JSON.stringify(address.includes('player_api')?{info:{plot:'Original synopsis',tmdb_id:123,youtube_trailer:'TY1lWh20VSw'}}:{title:'Título',overview:''}));
 const details=await loadXtreamVideoDetails(base,'12',fetcher,'movie','x'.repeat(30));assert.equal(details.description,'Original synopsis');assert.equal(details.descriptionLanguage,undefined);assert.equal(details.trailerId,'TY1lWh20VSw');
 assert.deepEqual(await spanishMetadata('123','movie','x'.repeat(30),async()=>{throw Error('private token');}),{});
 await assert.rejects(checkMetadataToken('x'.repeat(30),async()=>{throw Error('private token');}),error=>!error.message.includes('private token'));
 assert.equal(validateMetadataToken('Bearer '+ 'x'.repeat(30)),'x'.repeat(30));
});
test('shared provider watermarks get channel identities; actual channel variants keep their logos',()=>{
 const items=Array.from({length:9},(_,i)=>({title:'Channel '+i,image:'watermark.png'}));assert.ok(composeChannels(items).every(item=>item.imageGeneric));
 assert.ok(composeChannels([{title:'ESPN HD',image:'espn.svg'},{title:'ESPN SD',image:'espn.svg'}]).every(item=>!item.imageGeneric));
});
test('full posters use high resolution and cleaned display names without changing source identity',()=>{
 assert.equal(artworkURL('https://image.tmdb.org/t/p/w342/poster.jpg'),'https://image.tmdb.org/t/p/w780/poster.jpg');assert.equal(artworkURL('https://image.tmdb.org/t/p/w1280/back.jpg',true),'https://image.tmdb.org/t/p/original/back.jpg');
 const item={title:'A Movie (LAT/ENG) (2025)'};assert.equal(displayTitle(item),'A Movie');assert.equal(item.title,'A Movie (LAT/ENG) (2025)');assert.equal(displayTitle({...item,localizedTitle:'Película'}),'Película');
});
