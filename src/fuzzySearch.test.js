import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuery,scoreMatch,fuzzyMatches,suggestNames} from './fuzzySearch.js';

test('normalizeQuery strips accents, case and punctuation',()=>{assert.equal(normalizeQuery('¿Qué Pasó Ayer?'),'que paso ayer');assert.equal(normalizeQuery('Los Simpson 1x03'),'los simpson 1x03');assert.equal(normalizeQuery('  Ocean\'s  (Eleven)!'),'ocean s eleven');});
test('fuzzyMatches finds misspelt and partial titles',()=>{
 const records=[{id:1,title:'Breaking Bad'},{id:2,title:'Better Call Saul'},{id:3,title:'Los Simpson'}];
 assert.deepEqual(fuzzyMatches('brekin bad',records).map(r=>r.id),[1]);
 assert.equal(fuzzyMatches('simson',records)[0].id,3);
 assert.deepEqual(fuzzyMatches('zzzz',records),[]);
});
test('suggestNames returns distinct best titles',()=>{assert.deepEqual(suggestNames('bad',[{id:1,title:'Breaking Bad'},{id:4,title:'Breaking Bad'},{id:2,title:'Bad Boys'}]),['Breaking Bad','Bad Boys']);});
test('scoreMatch ranks exact, prefix, all words and typos; punctuation is never an error',()=>{
 assert.equal(scoreMatch('¿Qué pasó ayer?','Qué Pasó Ayer'),1);assert.equal(scoreMatch('los sim','Los Simpson'),0.8);assert.equal(scoreMatch('simpson los','Los Simpson'),0.7);
 const typo=scoreMatch('los simsons','Los Simpson');assert.ok(typo>=0.45&&typo<=0.6,String(typo));assert.equal(scoreMatch('Los Simpson 1x03','Los Simpson'),1);assert.equal(scoreMatch('Matrix HD (LAT)','Matrix'),1);assert.equal(scoreMatch('',''),0);assert.equal(scoreMatch('?','Los Simpson'),0);
});
test('fuzzyMatches prefers the clean name, keeps the limit and sorts by score',()=>{
 const records=Array.from({length:60},(_,id)=>({id,title:`HD ◘ Matrix ${id}`,clean:`Matrix ${id}`}));records.push({id:'exact',title:'Matrix',clean:'Matrix'});
 const found=fuzzyMatches('matrix',records);assert.equal(found.length,40);assert.equal(found[0].id,'exact');assert.ok(found.every((r,i)=>!i||found[i-1].score>=r.score));
});
