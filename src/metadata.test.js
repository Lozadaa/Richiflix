import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeID,pickLogo,spanishMetadata,checkMetadataToken,validateMetadataToken,tmdbSeason,tmdbSearch} from './metadata.js';
import {loadXtreamVideoDetails} from './xtream.js';
import {composeChannels} from './channelArtwork.js';
import {artworkURL,displayTitle,logoURL} from './artwork.js';
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
 const fetcher=async(address,options)=>{const url=new URL(address);assert.equal(url.pathname,'/3/movie/123');assert.equal(url.searchParams.get('language'),'es-ES');assert.equal(url.searchParams.get('append_to_response'),'videos,images,release_dates');assert.equal(url.searchParams.get('include_image_language'),'es,null');assert.equal(url.searchParams.get('include_video_language'),'es,en,null');assert.equal(options.headers.Authorization,'Bearer '+ 'x'.repeat(30));return new Response(JSON.stringify({title:'Título español',overview:'Una aventura en español.',videos:{results:[{site:'YouTube',type:'Trailer',key:'TY1lWh20VSw',official:true,iso_639_1:'es'}]}}));};
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
test('tmdbSeason asks es-MX only for gaps, English only as last resort, and caches 30 days per season',async()=>{
 const calls=[],responses={'es-ES':{episodes:[{episode_number:1,season_number:2,name:'Piloto',overview:'Sinopsis ES',air_date:'2010-01-01',runtime:45,still_path:'/a.jpg',crew:[{}]},{episode_number:2,season_number:2,name:'',overview:''},{episode_number:3,season_number:2,name:'Tres',overview:''}]},'es-MX':{episodes:[{episode_number:2,name:'Dos MX',overview:'Sinopsis MX'},{episode_number:3,name:'Tres MX',overview:''}]},'en-US':{episodes:[{episode_number:3,name:'Three',overview:'English synopsis'}]}};
 const fetcher=async address=>{const url=new URL(address);assert.equal(url.pathname,'/3/tv/1396/season/2');calls.push(url.searchParams.get('language'));return new Response(JSON.stringify(responses[url.searchParams.get('language')]));};
 const store=new Map(),cache={get:async key=>store.get(key)??null,put:async(key,value)=>{store.set(key,value);}};
 const episodes=await tmdbSeason('1396',2,'x'.repeat(30),fetcher,cache);
 assert.deepEqual(calls,['es-ES','es-MX','en-US']);
 assert.deepEqual(episodes,[{episode_number:1,season_number:2,name:'Piloto',overview:'Sinopsis ES',air_date:'2010-01-01',runtime:45,still_path:'/a.jpg'},{episode_number:2,season_number:2,name:'Dos MX',overview:'Sinopsis MX'},{episode_number:3,season_number:2,name:'Tres',overview:'English synopsis',overviewLanguage:'en'}]);
 assert.deepEqual(store.get('season:1396:2'),{seasonEpisodes:episodes});
 assert.deepEqual(await tmdbSeason('1396','2','x'.repeat(30),()=>assert.fail(),cache),episodes);
 calls.length=0;responses['es-ES']={episodes:[{episode_number:1,name:'Uno',overview:'Completo'}]};
 assert.equal((await tmdbSeason('1396',2,'x'.repeat(30),fetcher))[0].name,'Uno');assert.deepEqual(calls,['es-ES']);
 assert.deepEqual(await tmdbSeason('../x',2,'x'.repeat(30),()=>assert.fail()),[]);
 assert.deepEqual(await tmdbSeason('1396',2,'',()=>assert.fail()),[]);
 assert.deepEqual(await tmdbSeason('1396',2,'x'.repeat(30),async()=>new Response('',{status:404}),{get:async()=>null,put:()=>assert.fail()}),[]);
});
test('tmdbSearch uses search/multi in es-ES, keeps movies and series with genre names, and never throws',async()=>{
 const calls=[],answers={'search/multi':{results:[{id:1396,media_type:'tv',name:'Breaking Bad',original_name:'Breaking Bad',first_air_date:'2008-01-20',genre_ids:[18,80],poster_path:'/bb.jpg'},{id:7,media_type:'person',name:'Bryan Cranston'},{id:9,media_type:'movie',title:'Adulto',adult:true},{id:603,media_type:'movie',title:'Matrix',release_date:'1999-03-30',genre_ids:[878]}]},'genre/movie/list':{genres:[{id:878,name:'Ciencia ficción'}]},'genre/tv/list':{genres:[{id:18,name:'Drama'},{id:80,name:'Crimen'}]}};
 const fetcher=async url=>{const parsed=new URL(url);calls.push(parsed);const path=parsed.pathname.replace('/3/','');return {ok:true,json:async()=>answers[path]};};
 const found=await tmdbSearch('  Breaking Bad ','a'.repeat(32),fetcher);
 assert.deepEqual(found,[{tmdbId:'1396',type:'series',title:'Breaking Bad',originalTitle:'Breaking Bad',year:'2008',genreIds:[18,80],genres:['Drama','Crimen'],poster:'https://image.tmdb.org/t/p/w342/bb.jpg'},{tmdbId:'603',type:'movie',title:'Matrix',originalTitle:'',year:'1999',genreIds:[878],genres:['Ciencia ficción'],poster:undefined}]);
 const search=calls.find(url=>url.pathname.endsWith('search/multi'));assert.equal(search.searchParams.get('query'),'Breaking Bad');assert.equal(search.searchParams.get('language'),'es-ES');assert.equal(search.searchParams.get('include_adult'),'false');
 await tmdbSearch('Matrix','a'.repeat(32),fetcher);assert.equal(calls.filter(url=>url.pathname.includes('genre/')).length,2,'Genre lists are fetched once per token.');
 assert.deepEqual(await tmdbSearch('x','a'.repeat(32),fetcher),[]);assert.deepEqual(await tmdbSearch('Matrix','',fetcher),[]);
 assert.deepEqual(await tmdbSearch('Matrix','b'.repeat(32),async()=>({ok:false})),[]);
});
test('title logo: Spanish before no-language, PNG before SVG within a language, SVG alone accepted',async()=>{
 const logo=(iso_639_1,file_path)=>({iso_639_1,file_path});
 assert.equal(pickLogo({logos:[logo(null,'/neutral.png'),logo('en','/english.png'),logo('es','/spanish.svg'),logo('es','/spanish.png')]}),'/spanish.png');
 assert.equal(pickLogo({logos:[logo('en','/english.png'),logo(null,'/neutral.svg'),logo(null,'/neutral.png')]}),'/neutral.png');
 assert.equal(pickLogo({logos:[logo('es','/only.svg')]}),'/only.svg');
 for(const images of [undefined,{},{logos:[]},{logos:[logo('en','/english.png')]},{logos:[logo('es','../bad.png')]}])assert.equal(pickLogo(images),undefined);
 const details=await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({title:'T',images:{logos:[logo('es','/logo.png')]}})));
 assert.equal(details.logoImage,'/logo.png');assert.equal(logoURL(details.logoImage),'https://image.tmdb.org/t/p/w300/logo.png');assert.equal(logoURL(undefined),'');
 assert.equal('logoImage' in await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({title:'T'}))),false);
});
