import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {parseM3U} from './catalog.js';
import {ageEvidence,canShowForKids,forProfile,mergeContent} from './content.js';
import {retainedSources,bundledPlaylistInputs} from './sourceSelection.js';

const film={id:'verified',url:'https://example.com/movie.mp4',kind:'vod'};
const proof={id:film.id,url:film.url,minAge:10,label:'10+',source:'https://example.com/rating',checkedAt:'2026-10-05'};
test('Kids está vacío sin evidencia; el género y las etiquetas no habilitan títulos',()=>{
 assert.deepEqual(ageEvidence,[]);
 assert.equal(canShowForKids(film),false);
 assert.equal(canShowForKids({...film,genre:'Infantil',ageRating:'TV-G',minAge:0,kids:true}),false);
 assert.equal(canShowForKids(film,[proof]),true);
});
test('el límite incluye 10 años; evidencia incompleta o superior se oculta',()=>{
 for(const change of [{minAge:11},{minAge:null},{minAge:'7'},{minAge:-1},{source:null},{checkedAt:null},{url:'https://example.com/other.mp4'},{id:'other'}])assert.equal(canShowForKids(film,[{...proof,...change}]),false);
});
test('una etiqueta M3U y un ID suplantado no permiten entrar a Kids',()=>{
 const [channel]=parseM3U('#EXTM3U\n#EXTINF:-1 group-title="Kids" tvg-rating="TV-G",Infantil\nhttps://example.com/live.m3u8');
 assert.equal(canShowForKids(channel,[proof]),false);
 assert.equal(canShowForKids({...film,kind:'iptv'},[proof]),false);
 assert.equal(canShowForKids({...film,url:'https://example.com/evil.mp4'},[proof]),false);
 assert.equal(canShowForKids({...film,isNsfw:true},[proof]),false);
});
test('Adulto conserva todo; Kids oculta lo que no tiene evidencia vigente',()=>{
 const all=[film,{id:'other',url:'https://example.com/other',kind:'provider'}];
 assert.equal(forProfile(all,{kind:'adult'}),all);
 assert.deepEqual(forProfile(all,{kind:'kids'}),[]);
});
test('solo eterboxtv y ningun catalogo publico incluido',async()=>{
 assert.deepEqual(retainedSources.map(source=>source.id),['eterboxtv']);
 assert.deepEqual(bundledPlaylistInputs,[]);
 const data=JSON.parse((await readFile(new URL('./data/channels.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
 assert.deepEqual(data.items,[]);assert.deepEqual(data.sources,[]);
 const {providerDestinations}=createRequire(import.meta.url)('../electron/sources.cjs');assert.deepEqual(providerDestinations,{});
});
test('combina fuentes sin duplicar emisiones ni borrar alternativas distintas',()=>{
 const a={id:'a',url:'https://example.com/one'},b={id:'b',url:'https://example.com/two'};
 assert.deepEqual(mergeContent([a],[a,b]),[a,b]);
});
