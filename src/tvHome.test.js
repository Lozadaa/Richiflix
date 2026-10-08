import test from 'node:test';
import assert from 'node:assert/strict';
import {homeRowsForTV,backTarget,recentlyAdded,isNew} from './tvHome.js';
import {normaliseItem} from './xtream.js';
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
const NOW=Date.UTC(2026,9,8,12),day=864e5;
test('recentlyAdded keeps the last 7 days, newest first, up to the limit; isNew needs addedAt',()=>{
 const items=[{id:'old',addedAt:NOW-8*day},{id:'a',addedAt:NOW-2*day},{id:'none'},{id:'b',addedAt:NOW-1*day},{id:'nan',addedAt:NaN},{id:'c',addedAt:NOW-6.9*day}];
 assert.deepEqual(recentlyAdded(items,NOW).map(item=>item.id),['b','a','c']);
 assert.deepEqual(recentlyAdded(items,NOW,7,2).map(item=>item.id),['b','a']);
 assert.deepEqual(recentlyAdded([{id:'none'}],NOW),[]);
 assert.equal(isNew({addedAt:NOW-day},NOW),true);assert.equal(isNew({addedAt:NOW-8*day},NOW),false);assert.equal(isNew({},NOW),false);
});
test('normaliseItem turns provider added seconds into addedAt, and drops absent or invalid values',()=>{
 const account={host:'http://example.test',username:'u',password:'p',name:'Fuente'},movie=raw=>normaliseItem({stream_id:1,name:'X',...raw},'movie',new Map(),account);
 assert.equal(movie({added:'1780000000'}).addedAt,1780000000000);
 for(const added of [undefined,'','abc',0,-5])assert.equal('addedAt' in movie({added}),false,String(added));
});
