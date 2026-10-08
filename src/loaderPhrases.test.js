import test from 'node:test';
import assert from 'node:assert/strict';
import {LOADER_PHRASES,loaderPhrase} from './loaderPhrases.js';

test('hay al menos 12 frases distintas, en español y sin puntos suspensivos duplicados',()=>{
 assert.ok(LOADER_PHRASES.length>=12);
 assert.equal(new Set(LOADER_PHRASES).size,LOADER_PHRASES.length);
 for(const phrase of LOADER_PHRASES){assert.match(phrase,/…$/);assert.ok(phrase.length<=44,phrase);}
});
test('loaderPhrase cicla y nunca devuelve vacío',()=>{
 assert.equal(loaderPhrase(0),LOADER_PHRASES[0]);
 assert.equal(loaderPhrase(LOADER_PHRASES.length),LOADER_PHRASES[0]);
 assert.equal(loaderPhrase(-1),LOADER_PHRASES[0]);
 assert.equal(loaderPhrase(3.7),LOADER_PHRASES[3]);
});
