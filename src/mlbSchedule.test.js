import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleGames,reconcileMLBEvent,mlbEventDate,scoreLabel} from './mlbSchedule.js';
import {groupLiveEvents} from './liveEvents.js';
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
const line=(inningState,status='Live',detail='In Progress')=>({...game,status:{detailedState:detail,abstractGameState:status},linescore:{currentInning:7,currentInningOrdinal:'7th',inningState,teams:{away:{runs:3},home:{runs:2}}}});
test('Fase L5: linescore becomes a score with Spanish inning labels; no linescore, no score',()=>{
 const [live]=scheduleGames(data(line('Top')));
 assert.deepEqual(live.score,{away:3,home:2,inning:7,inningState:'Top',ordinal:'7th',state:'Live',teams:[147,139]});
 assert.deepEqual(['Top','Bottom','Middle','End'].map(state=>scoreLabel(scheduleGames(data(line(state)))[0].score).inning),['7.ª ▲','7.ª ▼','Med. 7.ª','Fin 7.ª']);
 assert.equal(scoreLabel(live.score).text,'7.ª ▲ · 3 – 2');assert.equal(scoreLabel(live.score,139).runs,'2 – 3','runs follow the crest on the left');
 assert.equal(scoreLabel(scheduleGames(data(line('End','Final','Final')))[0].score).text,'Final · 3 – 2');
 assert.equal(scheduleGames(data(game))[0].score,undefined);
 assert.equal(scheduleGames(data({...game,linescore:{teams:{home:{},away:{}}}}))[0].score,undefined,'a Preview linescore without runs is not a 0 – 0');
 assert.equal(scoreLabel({...live.score,state:'Preview'}),null);assert.equal(scoreLabel(null),null);
});
test('Fase L5: reconcile copies the score to the event, which keeps it',()=>{
 const result=reconcileMLBEvent(item,scheduleGames(data(line('Bottom'))));
 assert.equal(result.eventScore.inningState,'Bottom');assert.equal(result.eventDetail,'In Progress');
 assert.equal(reconcileMLBEvent(item,scheduleGames(data(game))).eventScore,null);
 assert.equal(groupLiveEvents([result]).events[0].eventScore,result.eventScore);
});
