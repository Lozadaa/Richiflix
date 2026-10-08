import test from 'node:test';
import assert from 'node:assert/strict';
import {cardFacts} from './cardFacts.js';

test('cardFacts joins year, first genre and duration with what exists',()=>{
 assert.equal(cardFacts({year:'2026',tmdbGenres:['Drama','Crimen'],contentGenre:'Acción',durationSeconds:6540}),'2026 · Drama · 1 h 49 min');
 assert.equal(cardFacts({year:'2026',contentGenre:'Comedia, Familia',durationSeconds:2940}),'2026 · Comedia · 49 min');
 assert.equal(cardFacts({contentGenre:'Terror',durationSeconds:7200}),'Terror · 2 h');
 assert.equal(cardFacts({year:'2001'}),'2001');
});
test('cardFacts is empty without year, genre and duration (no loose separators)',()=>{
 assert.equal(cardFacts({}),'');
 assert.equal(cardFacts({year:'',contentGenre:'',durationSeconds:0,tmdbGenres:[]}),'');
 assert.equal(cardFacts({year:'20xx',durationSeconds:NaN}),'');
 assert.equal(cardFacts(undefined),'');
});
