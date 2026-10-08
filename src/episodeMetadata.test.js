import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSeasonEpisodes} from './episodeMetadata.js';

test('mergeSeasonEpisodes matches by episode number and falls back by order for absolute numbering',()=>{
 const tmdb=[{episode_number:1,name:'Piloto',overview:'Walter…'},{episode_number:2,name:'El gato está en la bolsa',overview:'…'}];
 const byNumber=mergeSeasonEpisodes([{id:'a',episodeNumber:2,title:'Breaking Bad S01E02'}],tmdb,{season:1});
 assert.equal(byNumber[0].title,'El gato está en la bolsa');
 const absolute=mergeSeasonEpisodes([{id:'x',episodeNumber:13,title:'Ep 13'},{id:'y',episodeNumber:14,title:'Ep 14'}],tmdb,{season:2});
 assert.deepEqual(absolute.map(e=>e.title),['Piloto','El gato está en la bolsa']);
});
test('mergeSeasonEpisodes never mixes specials and keeps provider title when TMDB is generic',()=>{
 const out=mergeSeasonEpisodes([{id:'s',episodeNumber:1,title:'Detrás de cámaras'}],[{episode_number:1,name:'Episodio 1',overview:''}],{season:0});
 assert.equal(out[0].title,'Detrás de cámaras');
 const regular=mergeSeasonEpisodes([{id:'s',episodeNumber:1,title:'Detrás de cámaras'}],[{episode_number:1,season_number:1,name:'Piloto',overview:'x'}],{season:0});
 assert.equal(regular[0].title,'Detrás de cámaras');assert.equal(regular[0].description,undefined);
});
test('mergeSeasonEpisodes keeps TMDB fields, provider gaps and marks English synopses',()=>{
 const tmdb=[{episode_number:1,name:'Piloto',overview:'',air_date:'2008-01-20',runtime:58,still_path:'/a.jpg'},{episode_number:2,name:'Dos',overview:'Synopsis',overviewLanguage:'en'},{episode_number:3,name:'Tres',overview:'Sinopsis'}];
 const out=mergeSeasonEpisodes([{id:'a',episodeNumber:1,title:'S01E01',description:'Del proveedor'},{id:'b',episodeNumber:2,title:'E2'},{id:'c',episodeNumber:3,title:'E3',description:'Provider'},{id:'d',episodeNumber:9,title:'Nueve'}],tmdb,{season:'1'});
 assert.deepEqual(out[0],{id:'a',episodeNumber:1,title:'Piloto',description:'Del proveedor',airDate:'2008-01-20',runtime:58,stillPath:'/a.jpg'});
 assert.equal(out[1].description,'Synopsis');assert.equal(out[1].descriptionLanguage,'en');
 assert.equal(out[2].description,'Sinopsis');assert.equal(out[2].descriptionLanguage,'es');
 assert.deepEqual(out[3],{id:'d',episodeNumber:9,title:'Nueve'});
 // Partial seasons numbered normally stay matched by number.
 assert.equal(mergeSeasonEpisodes([{id:'e',episodeNumber:3,title:'E3'}],tmdb,{season:1})[0].title,'Tres');
 assert.equal(mergeSeasonEpisodes([{id:'a',episodeNumber:1,title:'E1'}],[],{season:1})[0].title,'E1');
});
