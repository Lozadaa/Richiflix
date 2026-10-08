import test from 'node:test';
import assert from 'node:assert/strict';
import {episodeState,seasonProgress,nextToWatch,continueWatchingEntries,WATCHED_FRACTION} from './watchProgress.js';

const episodes=[{id:'a',season:'1',episodeNumber:1,durationSeconds:3000},{id:'b',season:'1',episodeNumber:2,durationSeconds:3000},{id:'c',season:'2',episodeNumber:1},{id:'d',season:'2',episodeNumber:2}];
test('episodeState: 92 % counts as watched without the flag, an explicit «no visto» wins, started gives minutes left',()=>{
 assert.equal(WATCHED_FRACTION,.9);
 assert.deepEqual(episodeState({episodeId:'a',history:{a:2760},watched:{},durations:{}},3000),{state:'watched',remainingMinutes:0,fraction:1});
 assert.equal(episodeState({episodeId:'a',history:{a:2760},watched:{a:false},durations:{}},3000).state,'started');
 assert.deepEqual(episodeState({episodeId:'c',history:{c:600},watched:{},durations:{c:1320}}),{state:'started',remainingMinutes:12,fraction:600/1320});
 assert.deepEqual(episodeState({episodeId:'d',history:{},watched:{d:true},durations:{}}),{state:'watched',remainingMinutes:0,fraction:1});
 assert.deepEqual(episodeState({episodeId:'b',history:{},watched:{},durations:{}},3000),{state:'unwatched',remainingMinutes:0,fraction:0});
 assert.deepEqual(episodeState({episodeId:'b',history:{b:30},watched:{},durations:{}}),{state:'started',remainingMinutes:0,fraction:0});
});
test('seasonProgress counts watched episodes of a season',()=>{
 const library={history:{a:2900},watched:{c:true,b:false},durations:{}};
 assert.deepEqual(seasonProgress(episodes.slice(0,2),library),{watched:1,total:2});
 assert.deepEqual(seasonProgress(episodes.slice(2),library),{watched:1,total:2});
 assert.deepEqual(seasonProgress([],library),{watched:0,total:0});
});
test('nextToWatch: the recent episode while unfinished, then the one after the last watched, else the first',()=>{
 const empty={history:{},watched:{},durations:{}};
 assert.equal(nextToWatch(episodes,empty).id,'a');
 assert.equal(nextToWatch(episodes,{...empty,watched:{a:true,b:true}}).id,'c');
 assert.equal(nextToWatch(episodes,{...empty,history:{d:100},watched:{a:true},recentId:'d'}).id,'d');
 assert.equal(nextToWatch(episodes,{...empty,watched:{a:true,c:true},recentId:'c'}).id,'d');
 assert.equal(nextToWatch(episodes,{...empty,watched:{a:true,b:true,c:true,d:true}}).id,'a');
 assert.equal(nextToWatch([],empty),null);
 const withSpecials=[{id:'s0',season:'0',episodeNumber:1},...episodes];
 assert.equal(nextToWatch(withSpecials,empty).id,'a');
 assert.equal(nextToWatch(withSpecials,{...empty,history:{s0:20},recentId:'s0'}).id,'s0');
});
test('continueWatchingEntries: a series appears once with its latest episode; finished series and watched movies leave',()=>{
 const all=[{id:'movie',mediaType:'movie',durationSeconds:6000},{id:'done-movie',mediaType:'movie'},{id:'show',mediaType:'series'},{id:'show2',mediaType:'series'},{id:'show3',mediaType:'series'},{id:'idle',mediaType:'series'}];
 const history={movie:600,'ep-1':1200,'ep-2':300},durations={'ep-2':1500},watched={'s3e9':true,'s2e4':true};
 const recent={show:{episodeId:'ep-2',season:'2',episodeNumber:5,next:{id:'ep-3',season:'2',episodeNumber:6},at:20},show2:{episodeId:'s2e4',season:'1',episodeNumber:4,next:{id:'s2e5',season:'1',episodeNumber:5},at:10},show3:{episodeId:'s3e9',season:'1',episodeNumber:9,next:null,at:5}};
 const entries=continueWatchingEntries(all,history,watched,durations,recent);
 assert.deepEqual(entries.map(entry=>entry.id),['movie','show','show2']);
 assert.equal(entries.filter(entry=>entry.id==='show').length,1);
 assert.equal(entries[1].resumeLabel,'T2 · E5 · Quedan 20 min');assert.equal(entries[1].resumeFraction,.2);assert.equal(entries[1].resumeEpisodeId,'ep-2');
 assert.equal(entries[2].resumeLabel,'Siguiente: T1 · E5');assert.equal(entries[2].resumeEpisodeId,'s2e5');
 assert.equal(entries[0].resumeLabel,undefined);
});
