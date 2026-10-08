import test from 'node:test';
import assert from 'node:assert/strict';
import {createTmdbSelectionCache,matchTmdbSelections,TMDB_BEST,TMDB_RECENT} from './tmdbSelections.js';
import {spanishMetadata,tmdbRating} from './metadata.js';
const ranked=(id,title,rank,genres=[18],year='2000')=>({id:String(id),title,originalTitle:title,year,rank,genreIds:genres,tmdbScore:8.7,tmdbVotes:1500});
const movie=(id,title,year='2000',extra={})=>({id,kind:'vod',mediaType:'movie',title,year,...extra});
test('scores use official vote average and count; missing, zero and malformed votes never create a rating',async()=>{
 assert.deepEqual(tmdbRating({vote_average:8.723,vote_count:1200}),{tmdbScore:8.723,tmdbVotes:1200});
 for(const data of [{},{vote_average:0,vote_count:5},{vote_average:11,vote_count:5},{vote_average:8,vote_count:0},{vote_average:'garbage',vote_count:20}])assert.deepEqual(tmdbRating(data),{});
 const value=await spanishMetadata(123,'movie','x'.repeat(30),async()=>new Response(JSON.stringify({vote_average:8.4,vote_count:300,genres:[{id:18,name:'Drama'}]})));assert.equal(value.tmdbScore,8.4);assert.equal(value.tmdbVotes,300);assert.equal(value.tmdbId,'123');assert.deepEqual(value.tmdbGenres,['Drama']);
});
test('rankings match actual media, exact IDs or clean title/year, exclude ambiguous remakes and deduplicate variants',async()=>{
 const catalogue={movies:[movie('a','Cadena perpetua (LAT/ENG) (2000)'),movie('a-hd','Cadena perpetua (2000)'),movie('b','Original (2000)'),movie('wrong','Original','2020'),movie('unknown','Desconocida'),movie('by-id','Renamed','1999',{tmdbId:'3'}),movie('bad-id','Original','2000',{tmdbId:'999'}),movie('ambiguous','Igual','',{})],shows:[{id:'series',kind:'series',mediaType:'series',title:'Original',year:'2000'}]};
 const data={status:'ready',movies:[ranked(1,'Cadena perpetua',1),ranked(2,'Original',2),ranked(3,'Known',3),ranked(4,'Igual',4,[],'2000'),ranked(5,'Igual',5,[],'2010')],shows:[ranked(9,'Original',1)],genres:{movies:[{id:18,name:'Drama'}],shows:[{id:18,name:'Drama'}]}};
 const found=await matchTmdbSelections(catalogue,data);assert.deepEqual(found.collections.find(group=>group.name===TMDB_BEST&&group.type==='movie').ids,['a','b','by-id']);assert.ok(found.metadata['a-hd']);
 for(const id of ['wrong','unknown','bad-id','ambiguous'])assert.equal(found.metadata[id],undefined);
 assert.equal(found.metadata.series.tmdbId,'9');assert.equal(found.metadata.a.tmdbRank,1);assert.deepEqual(found.collections.find(group=>group.name==='Lo mejor de Drama · TMDB').ids,['a','b','by-id']);
 assert.equal(Object.hasOwn(found.metadata.a,'ageRating'),false,'Recommendations cannot invent Kids classifications');
});
test('rank download bounds concurrency, uses official lists and Spanish genres, and reuses its daily cache',async()=>{
 let saved,active=0,max=0,calls=0,time=100000;
 const cache=createTmdbSelectionCache({pages:2,now:()=>time,read:async()=>saved,write:async data=>saved=data,fetcher:async address=>{
  const url=new URL(address);assert.equal(url.origin,'https://api.themoviedb.org');assert.equal(url.searchParams.get('language'),'es-ES');active++;max=Math.max(max,active);calls++;await new Promise(resolve=>setImmediate(resolve));active--;
  return new Response(JSON.stringify(url.pathname.includes('/genre/')?{genres:[{id:18,name:'Drama'}]}:{results:[{id:Number(url.searchParams.get('page')),title:'Title',vote_average:8.5,vote_count:1200,genre_ids:[18],release_date:'2000-01-01'}]}));
 }});
 const [first,second]=await Promise.all([cache.get('x'.repeat(30),'token-key'),cache.get('x'.repeat(30),'token-key')]);assert.equal(first,second);assert.equal(calls,10);assert.equal(max,2);assert.equal(first.movies[1].rank,21);
 await cache.get('x'.repeat(30),'token-key');assert.equal(calls,10);time+=86400001;await cache.get('x'.repeat(30),'token-key');assert.equal(calls,20);
});
test('recent rankings use release bounds and a minimum vote sample, omit future titles and cache their new schema',async()=>{
 const date=Date.UTC(2026,9,6),requests=[],cache=createTmdbSelectionCache({now:()=>date,pages:0,recentPages:1,fetcher:async address=>{const url=new URL(address);requests.push(url);if(url.pathname.includes('/genre/'))return new Response(JSON.stringify({genres:[]}));const tv=url.pathname.endsWith('/tv');assert.equal(url.searchParams.get(tv?'first_air_date.gte':'primary_release_date.gte'),'2025-10-06');assert.equal(url.searchParams.get('sort_by'),'vote_average.desc');assert.equal(url.searchParams.get('vote_count.gte'),tv?'100':'200');return new Response(JSON.stringify({results:[{id:1,title:'Recent',name:'Recent',vote_average:8.5,vote_count:500,release_date:'2026-07-01',first_air_date:'2026-07-01'},{id:2,title:'Future',vote_average:9,vote_count:500,release_date:'2027-01-01',first_air_date:'2027-01-01'},{id:3,title:'One vote',vote_average:10,vote_count:1,release_date:'2026-01-01',first_air_date:'2026-01-01'}]}));}});
 const rankings=await cache.get('x'.repeat(30),'key');assert.deepEqual(rankings.recentMovies.map(item=>item.id),['1']);assert.deepEqual(rankings.recentShows.map(item=>item.id),['1']);assert.equal(rankings.version,2);assert.equal(requests.length,4);
 const found=await matchTmdbSelections({movies:[movie('recent','Recent','2026',{tmdbId:'1'})],shows:[]},rankings);assert.deepEqual(found.collections.find(group=>group.name===TMDB_RECENT).ids,['recent']);assert.equal(found.metadata.recent.tmdbRank,undefined);assert.equal(found.collections.some(group=>group.name===TMDB_BEST),false);assert.equal(found.metadata.recent.tmdbScore,8.5);
});
test('offline ranking keeps a valid stale snapshot without overwriting it or retaining token material',async()=>{
 const saved={tokenKey:'old',updatedAt:1,movies:[ranked(1,'Title',1)],shows:[],genres:{movies:[],shows:[]}},writes=[];
 const cache=createTmdbSelectionCache({now:()=>86400002,read:async()=>saved,write:async data=>writes.push(data),fetcher:async()=>{throw Error('private credential');}});
 const result=await cache.get('x'.repeat(30),'old');assert.equal(result.stale,true);assert.equal(result.status,'ready');assert.deepEqual(writes,[]);assert.equal(JSON.stringify(result).includes('private credential'),false);
 const different=await cache.get('y'.repeat(30),'new');assert.equal(different.status,'unavailable');assert.deepEqual(different.movies,[]);
});
