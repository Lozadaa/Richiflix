import test from 'node:test';
import assert from 'node:assert/strict';
import {homeRowsForTV,backTarget} from './tvHome.js';
import {TMDB_BEST,TMDB_RECENT} from './tmdbSelections.js';

const groups=[TMDB_BEST,TMDB_RECENT].flatMap(name=>['movie','series'].map(type=>({name,type,items:[1]})));
const ids=rows=>rows.map(group=>`${group.name===TMDB_BEST?'best':'recent'}:${group.type}`);
test('TV home shows two TMDB rows that alternate by day',()=>{
 assert.deepEqual(ids(homeRowsForTV(groups,20000)),['best:movie','best:series']);
 assert.deepEqual(ids(homeRowsForTV(groups,20001)),['recent:movie','recent:series']);
 assert.deepEqual(ids(homeRowsForTV(groups.filter(group=>!(group.name===TMDB_BEST&&group.type==='series')),20000)),['best:movie','recent:movie']);
 assert.deepEqual(homeRowsForTV([],20000),[]);
});
test('Back climbs from content to header, search, Inicio and profiles',()=>{
 assert.equal(backTarget({region:'content',query:'x',page:'Series'}),'header');
 assert.equal(backTarget({region:'live-rows',query:'',page:'TV en vivo'}),'chips');assert.equal(backTarget({region:'content',query:'',page:'MLB'}),'header');
 assert.equal(backTarget({region:'header',query:'x',page:'Series'}),'clear-search');
 assert.equal(backTarget({region:'header',query:'',page:'Series'}),'home');
 assert.equal(backTarget({region:'header',query:'',page:'Inicio',collectionView:{title:'Continuar viendo'}}),'home');
 assert.equal(backTarget({region:'header',query:'',page:'Inicio',collectionView:null}),'profiles');
});
