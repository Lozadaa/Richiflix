import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleGames,reconcileMLBEvent,mlbEventDate} from './mlbSchedule.js';
const item={kind:'iptv',title:'19:00 New York Yankees vs. Tampa Bay Rays · MLB',eventStartsAt:Date.parse('2026-10-06T00:00:00Z')};
const game={gamePk:123,officialDate:'2026-10-05',gameDate:'2026-10-06T00:30:00Z',teams:{away:{team:{id:147}},home:{team:{id:139}}},status:{detailedState:'Scheduled'}};
const data=game=>({dates:[{date:'2026-10-05',games:[game]}]});
test('official MLB UTC start replaces provider clock for the same teams and baseball date',()=>{
 assert.equal(mlbEventDate(item),'2026-10-05');
 const result=reconcileMLBEvent(item,scheduleGames(data(game)));
 assert.equal(result.eventStartsAt,Date.parse(game.gameDate));assert.equal(result.eventScheduleSource,'MLB');
 assert.equal(reconcileMLBEvent(item,scheduleGames(data({...game,officialDate:'2026-10-06'}))),item);
 assert.equal(reconcileMLBEvent({...item,title:'MLB Network'},scheduleGames(data(game))).eventScheduleSource,undefined);
});
test('unknown teams, TBD hours and ambiguous doubleheaders never produce invented times',()=>{
 assert.deepEqual(scheduleGames(data({...game,startTimeTBD:true})),[]);
 assert.deepEqual(scheduleGames(data({...game,teams:{...game.teams,home:{team:{id:0}}}})),[]);
 const matches=scheduleGames({dates:[{date:'2026-10-05',games:[{...game,gameDate:'2026-10-05T23:30:00Z'},game]}]});
 assert.equal(reconcileMLBEvent(item,matches),item);
 assert.equal(reconcileMLBEvent({...item,eventStartsAt:Date.parse('2026-10-05T23:25:00Z')},matches).eventStartsAt,Date.parse('2026-10-05T23:30:00Z'));
});
test('postponed games stop their countdown rather than claiming a new start',()=>{
 const result=reconcileMLBEvent(item,scheduleGames(data({...game,status:{detailedState:'Postponed'}})));
 assert.equal(result.eventStartsAt,null);assert.equal(result.eventScheduleState,'postponed');
});
