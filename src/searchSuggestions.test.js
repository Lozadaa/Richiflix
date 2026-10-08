import test from 'node:test';
import assert from 'node:assert/strict';
import {genreAlternatives} from './searchSuggestions.js';

const items=(prefix,count)=>Array.from({length:count},(_,i)=>({id:`${prefix}${i}`}));
test('genreAlternatives mixes the matching genre collections without duplicates and within the limit',()=>{
 const drama=items('d',10),crime=[{id:'c0'},drama[0],...items('c',8).slice(1)];
 const found=genreAlternatives({tmdbResult:{genreIds:[18,80],genres:['Drama','Crimen']},collections:[{name:'Comedia',items:items('x',5)},{name:'Lo mejor de Drama · TMDB',items:drama},{name:'Crimen',items:crime}]});
 assert.equal(found.length,12);assert.equal(new Set(found.map(item=>item.id)).size,12);assert.ok(found.some(item=>item.id.startsWith('c')));assert.ok(found.some(item=>item.id.startsWith('d')));assert.ok(!found.some(item=>item.id.startsWith('x')));
 assert.deepEqual(genreAlternatives({tmdbResult:{genreIds:[10764],genres:['Reality']},collections:[{name:'Drama',items:drama}]}),[]);
 assert.deepEqual(genreAlternatives({tmdbResult:{genreIds:[18]},collections:[{name:'Drama',items:drama}]}),[]);
 assert.deepEqual(genreAlternatives({tmdbResult:{genres:['Action & Adventure']},collections:[{name:'Adventure',items:drama.slice(0,2)}],limit:12}).map(item=>item.id),['d0','d1']);
 assert.deepEqual(genreAlternatives({tmdbResult:null,collections:[]}),[]);
});
test('genreAlternatives only resolves the item lists of matching genres',()=>{
 let asked=0;const lazy=(name,items)=>({name,items:()=>{asked++;return items;}});
 assert.deepEqual(genreAlternatives({tmdbResult:{genres:['Drama']},collections:[lazy('Drama',[{id:1}]),lazy('Comedia',[{id:2}])]}),[{id:1}]);assert.equal(asked,1);
});
