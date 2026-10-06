import test from 'node:test';
import assert from 'node:assert/strict';
import {tmdbAgeClassification} from './ageClassification.js';
import {spanishMetadata} from './metadata.js';
import {createPersistentMetadataCache,previewMetadataCacheOptions} from './persistentMetadataCache.js';

test('movie certificates prefer Chile and theatrical release, without interpreting labels as ages',()=>{
 const data={release_dates:{results:[{iso_3166_1:'US',release_dates:[{certification:'PG-13',type:3}]},{iso_3166_1:'CL',release_dates:[{certification:'18',type:1},{certification:'14',type:3}]}]}};
 assert.deepEqual(tmdbAgeClassification(data,'movie',42),{label:'14',country:'CL',source:'TMDB',tmdbId:'42'});
 data.release_dates.results.pop();assert.equal(tmdbAgeClassification(data,'movie',42).label,'PG-13');
});
test('TV regional ratings use exact labels and unknown or unrated classifications stay absent',()=>{
 assert.equal(tmdbAgeClassification({content_ratings:{results:[{iso_3166_1:'US',rating:'TV-14'},{iso_3166_1:'ES',rating:'12'}]}},'series',42).country,'ES');
 for(const data of [{},{content_ratings:{results:{}}},{content_ratings:{results:[{iso_3166_1:'CL',rating:''},{iso_3166_1:'US',rating:'NR'}]}}])assert.equal(tmdbAgeClassification(data,'series',42),null);
});
test('certifications share the metadata request and survive a persistent cache restart including confirmed absence',async()=>{
 let requests=0,saved;const load=async(id,type)=>spanishMetadata(id,type,'x'.repeat(30),async address=>{
  requests++;assert.equal(new URL(address).searchParams.get('append_to_response'),`videos,${type==='series'?'content_ratings':'release_dates'}`);
  return new Response(JSON.stringify({name:'Una serie',overview:'Sinopsis española',content_ratings:{results:[{iso_3166_1:'CL',rating:'18'}]}}));
 });
 const options={...previewMetadataCacheOptions,read:async()=>saved,write:async value=>{saved=structuredClone(value);}};
 const cache=createPersistentMetadataCache(options);await cache.put('series',await load(42,'series'));await cache.put('movie',await load(43,'movie'));await cache.flush();
 const resumed=createPersistentMetadataCache(options);
 assert.equal((await resumed.get('series')).ageClassification.label,'18');assert.equal((await resumed.get('movie')).ageClassification,null);assert.equal(requests,2);
});
