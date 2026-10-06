import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDiscoveryCollections,rotateDiscovery,releaseYear} from './discoveryCollections.js';
const now=Date.UTC(2026,9,6),movie=(id,extra={})=>({id,title:'Título '+id,mediaType:'movie',genre:'Acción',year:'2026',...extra});
test('discovery uses supplied genres, duration and known dates, with separate movie/series pools',async()=>{
 const movies=[movie('a'),movie('b'),movie('c'),movie('unknown',{year:''}),movie('future',{year:'2027'}),movie('short-a',{durationSeconds:5400,genre:'Comedia'}),movie('short-b',{durationSeconds:6000,genre:'Comedy'}),movie('short-c',{durationSeconds:3000,genre:'Comedia'})];
 const shows=Array.from({length:3},(_,index)=>({...movie('show-'+index),mediaType:'series',genre:'Mystery',year:'1995'}));const groups=await buildDiscoveryCollections({movies,shows},{},now);
 const newMovies=groups.find(group=>group.key==='discovery:movie:new');assert.ok(newMovies.ids.includes('a'));assert.ok(!newMovies.ids.includes('unknown'));assert.ok(!newMovies.ids.includes('future'));
 assert.deepEqual(groups.find(group=>group.key==='discovery:movie:short').ids,['short-a','short-b','short-c']);assert.equal(groups.find(group=>group.key==='discovery:series:short'),undefined);assert.deepEqual(groups.find(group=>group.key==='discovery:series:mystery').ids,shows.map(item=>item.id));
 assert.ok(groups.every(group=>group.ids.length>=3));assert.equal(groups.some(group=>group.key==='discovery:movie:fright'),false);
});
test('quality variants share an exact metadata identity, collection payloads stay bounded and classification is never invented',async()=>{
 const movies=Array.from({length:4000},(_,index)=>movie('m'+index));movies.push(movie('alternate',{tmdbId:'1'}));movies[0].tmdbId='1';const groups=await buildDiscoveryCollections({movies},{},now);assert.ok(groups.every(group=>group.ids.length<=80));assert.ok(!groups.some(group=>group.ids.includes('alternate')));assert.equal(movies[0].ageRating,undefined);
});
test('rotation is deterministic, changes on a new selection, keeps its pool immutable and ignores rankings',()=>{
 const groups=Array.from({length:12},(_,index)=>({key:'mood-'+index,kind:'discovery',ids:['a','b','c']})),snapshot=structuredClone(groups);groups.push({key:'top',kind:'ranking'});const first=rotateDiscovery(groups,'profile:2026-10-06'),again=rotateDiscovery(groups,'profile:2026-10-06'),second=rotateDiscovery(groups,'profile:2026-10-06',1);assert.deepEqual(first,again);assert.equal(first.length,4);assert.equal(second.length,4);assert.ok(first.every(group=>!second.includes(group)));assert.deepEqual(groups.slice(0,12),snapshot);assert.deepEqual(rotateDiscovery([],'empty'),[]);
});
test('release year rejects unknown, future or malformed values and accepts a supplied title year',()=>{
 assert.equal(releaseYear(movie('a',{year:'oops'}),{},2026),null);assert.equal(releaseYear(movie('a',{year:'2027'}),{},2026),null);assert.equal(releaseYear(movie('a',{year:'',title:'Película (1997)'}),{},2026),1997);assert.equal(releaseYear(movie('a'),{year:'2025'},2026),2025);
});
