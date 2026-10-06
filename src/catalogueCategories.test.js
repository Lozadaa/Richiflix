import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogueCategories} from './catalogueCategories.js';
import {prepareCatalogueGroups} from './channelPreparation.js';
import {createCatalogueIndex,primeCatalogueGroups} from './catalogueIndex.js';
test('category groups include supplied genres in Spanish without losing provider groups or hostile names',()=>{
 assert.deepEqual(catalogueCategories({genre:'Estrenos',contentGenre:'Action, Adventure / Comedy | Drama; Action'}),['Estrenos','Acción','Aventura','Comedia','Drama']);
 assert.deepEqual(catalogueCategories({genre:'__proto__',genres:['__proto__','constructor']}),['__proto__','constructor']);
 assert.deepEqual(catalogueCategories({genre:'Películas'}),['Películas']);
});
test('movie and series category positions stay separate, and scoped search cannot include another media type',async()=>{
 const movies=[{id:'m1',title:'Azul',genre:'Estrenos',contentGenre:'Action,Drama'},{id:'m2',title:'Rojo',genre:'Clásicos',contentGenre:'Comedy'}],shows=[{id:'s1',title:'Azul',genre:'Series',contentGenre:'Comedy'}];
 const data={movies,shows,channels:[],preparedChannels:[]};data.preparedGroups=await prepareCatalogueGroups(data,[]);primeCatalogueGroups(data);
 const index=createCatalogueIndex([...movies,...shows]);assert.deepEqual(index.categories(movies),['Acción','Clásicos','Comedia','Drama','Estrenos']);
 assert.deepEqual(index.filter(movies,'','Acción'),[movies[0]]);assert.deepEqual(index.filter(shows,'','Comedia'),shows);
 assert.deepEqual(await index.search(movies,'azul',{category:'Drama'}),[movies[0]]);assert.deepEqual(await index.search(shows,'azul',{category:'Drama'}),[]);
});
