import test from 'node:test';
import assert from 'node:assert/strict';
import {searchWithFuzzy} from './useCatalogueSearch.js';

test('approximate matches are only computed when the exact search found nothing',async()=>{
 let asked=0;const index={search:async(_items,query)=>query==='uno'?[{id:1}]:[],fuzzy:async()=>{asked++;return {items:[{id:2}],suggestions:['Dos']};}};
 assert.deepEqual(await searchWithFuzzy(index,[],'uno',{}),{items:[{id:1}],fuzzy:[],suggestions:[]});assert.equal(asked,0);
 assert.deepEqual(await searchWithFuzzy(index,[],'nada',{}),{items:[],fuzzy:[{id:2}],suggestions:['Dos']});assert.equal(asked,1);
});
