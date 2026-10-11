import test from 'node:test';
import assert from 'node:assert/strict';
import {footballMatchup,footballLeague,footballTeams} from './footballArtwork.js';
import {footballEventDate,scoreboardRequests,scoreboardGames,footballScoreLabel,reconcileFootballEvent} from './footballSchedule.js';
import {matchupFor,scoreLabelFor,officialGameId} from './matchup.js';
import {eventKey,groupLiveEvents,eventPhase,liveHubRows,FOOTBALL_HUB_CHIPS} from './liveEvents.js';
import {teamLabel,eventTeams} from './followedTeams.js';

const H=3600000,names=item=>footballMatchup(item)?.teams.map(team=>team.teamName)||null;
const live=(title,extra={})=>({kind:'iptv',title,...extra});
const kickOff=Date.parse('2026-10-18T19:00:00Z');
const espn=(id,home,away,state='pre',scores=[],extra={})=>({id,date:'2026-10-18T19:00Z',competitions:[{status:{displayClock:"67'",period:2,type:{state,name:state==='post'?'STATUS_FULL_TIME':'STATUS_SCHEDULED',shortDetail:state==='in'?"67'":state==='post'?'FT':'',description:''},...extra},competitors:[{homeAway:'home',team:{id:home},score:scores[0]},{homeAway:'away',team:{id:away},score:scores[1]}]}]});

test('every crest has a local logo, a readable colour and a league line',()=>{
 assert.ok(footballTeams.length>=120);
 for(const team of footballTeams){assert.match(team.id,/^futbol:\d+$/);assert.match(team.color,/^#[0-9a-f]{6}$/);assert.ok(team.logo&&team.location,team.name);}
});
test('provider titles in Spanish and English identify both clubs',()=>{
 assert.deepEqual(names(live('10/07 Soccer 7:30pm Barcelona vs Real Madrid')),['Barcelona','Real Madrid']);
 assert.deepEqual(names(live('ES| Bayern Múnich vs Borussia Dortmund HD')),['Bayern','Dortmund']);
 assert.deepEqual(names(live('Atlético de Madrid - Real Betis')),['Atlético','Betis']);
 assert.deepEqual(names(live('PSG vs Olympique de Marsella')),['PSG','Marseille']);
 assert.deepEqual(names(live('Man Utd x Liverpool')),['Man United','Liverpool']);
 assert.deepEqual(names(live('Roma vs Lazio')),['AS Roma','Lazio']);
});
test('a name inside a longer name is the same club: «Inter Milan» is not AC Milan',()=>{
 assert.deepEqual(names(live('Inter de Milán vs. AC Milan')),['Inter Milan','Milan']);
 assert.deepEqual(names(live('Inter vs Milan')),['Inter Milan','Milan']);
});
test('unknown or ambiguous sides never invent a duel',()=>{
 for(const title of ['Real Madrid vs Unknown FC','Racing vs Independiente','Francia vs. Bélgica','Real Madrid vs Real Madrid','Barcelona vs Real Madrid vs Sevilla'])assert.equal(footballMatchup(live(title)),null,title);
 assert.equal(footballMatchup({kind:'xtream',mediaType:'movie',title:'Como agua para chocolate'}),null);
 assert.equal(footballMatchup(live('Como ver la tele')),null,'common words match only a whole side');
 assert.deepEqual(names(live('Premier League - Arsenal')),['Arsenal'],'one club needs football context');
 assert.equal(footballMatchup(live('Arsenal')),null);
});
test('MLB keeps priority and its own crests',()=>{
 assert.equal(matchupFor(live('19:00 Yankees vs. Rays · MLB')).teams[0].id,147);
 assert.equal(matchupFor(live('Barcelona vs Real Madrid')).sport,'futbol');
});
test('the league comes from ESPN, the title or the league both clubs share',()=>{
 assert.equal(footballLeague(live('Barcelona vs Real Madrid')),'LaLiga');
 assert.equal(footballLeague(live('UEFA Champions League: Barcelona vs Inter')),'Champions League');
 assert.equal(footballLeague(live('Barcelona vs Inter')),'Champions League','the only competition both play');
 assert.equal(footballLeague({...live('Barcelona vs Real Madrid'),eventLeague:'Champions League'}),'Champions League');
 assert.equal(footballLeague(live('Benfica vs Porto')),null);
});
test('scoreboards are asked per league and US Eastern day, only where both clubs play',()=>{
 const item=live('Barcelona vs Inter',{eventStartsAt:kickOff});
 assert.equal(footballEventDate(item),'20261018');
 assert.deepEqual(scoreboardRequests([item,live('Barcelona vs Real Madrid',{eventStartsAt:kickOff}),live('ESPN'),live('Real Madrid vs Getafe')]),['esp.1|20261018','uefa.champions|20261018']);
 assert.deepEqual(scoreboardRequests([item,live('Barcelona vs Real Madrid',{eventStartsAt:kickOff})],1),['esp.1|20261018'],'capped');
});
test('ESPN scoreboard: unknown clubs are dropped, scores only once the match has started',()=>{
 const games=scoreboardGames({events:[espn('7001','83','86'),espn('7002','83','99999'),espn('7003','110','103','in',['2','1']),espn('7004','359','363','post',['0','3']),espn('x','83','86')]},'esp.1');
 assert.deepEqual(games.map(game=>game.id),['futbol:7001','futbol:7003','futbol:7004']);
 assert.equal(games[0].score,undefined);assert.equal(games[0].detail,'Scheduled');
 assert.deepEqual(games[1].teams,['futbol:103','futbol:110']);assert.equal(games[1].detail,'In Progress');
 assert.equal(footballScoreLabel(games[1].score).text,"67' · 1 – 2",'away – home by default');
 assert.equal(footballScoreLabel(games[1].score,'futbol:110').text,"67' · 2 – 1",'goals follow the crest on the left');
 assert.equal(scoreLabelFor(games[2].score,'futbol:359').text,'Final · 0 – 3','home side lost at home');
 assert.equal(footballScoreLabel({...games[1].score,short:'HT'}).inning,'Descanso');
 assert.equal(footballScoreLabel(null),null);
 assert.equal(scoreboardGames({events:[espn('7005','83','86','post',[],{type:{state:'post',name:'STATUS_POSTPONED'}})]},'esp.1')[0].detail,'Postponed');
});
test('reconciled matches take ESPN time, id, league and score; one card for every signal',()=>{
 const games=scoreboardGames({events:[espn('7003','110','83','in',['1','1'])]},'uefa.champions');
 const feeds=[live('20:00 Barcelona vs Inter ES',{id:'a',eventStartsAt:kickOff+H}),live('Barcelona vs Inter de Milán EN',{id:'b',eventStartsAt:kickOff-30*60000})].map(item=>reconcileFootballEvent(item,games));
 assert.equal(feeds[0].eventStartsAt,kickOff);assert.equal(feeds[0].eventOfficialId,'futbol:7003');assert.equal(feeds[0].eventLeague,'Champions League');assert.equal(feeds[0].eventScheduleSource,'ESPN');
 assert.equal(eventKey(feeds[0]),'futbol:7003');
 const {events}=groupLiveEvents(feeds);assert.equal(events.length,1);assert.equal(events[0].id,'event:futbol:7003');assert.equal(events[0].feeds.length,2);
 assert.equal(eventPhase(events[0],kickOff+30*60000),'live');assert.equal(officialGameId(events[0].id),'futbol:7003');assert.equal(officialGameId('event:mlb:776'),776);
 const far=live('Barcelona vs Inter',{eventStartsAt:kickOff+2*86400000});assert.equal(reconcileFootballEvent(far,games),far,'another day is another match');
});
test('unreconciled signals of one match still share a card, with football duration',()=>{
 const items=[live('Barcelona vs Real Madrid ES',{id:'a',eventStartsAt:kickOff}),live('FC Barcelona vs Real Madrid CF EN',{id:'b',eventStartsAt:kickOff})];
 assert.equal(eventKey(items[0]),eventKey(items[1]));assert.match(eventKey(items[0]),/^futbol:83-86:/);
 const {events}=groupLiveEvents(items);assert.equal(events.length,1);assert.equal(events[0].eventDuration,2.25*H);
});
test('league chips filter the football hub; followed clubs have names',()=>{
 const items=[live('Barcelona vs Real Madrid',{id:'a',eventStartsAt:kickOff}),live('Arsenal vs Chelsea',{id:'b',eventStartsAt:kickOff})];
 const {events,channels}=groupLiveEvents(items),rows=category=>liveHubRows({events,channels,category,now:kickOff-H}).rows.flatMap(row=>row.items.map(item=>item.title));
 assert.ok(FOOTBALL_HUB_CHIPS.includes('LaLiga'));
 assert.equal(rows('LaLiga').length,1);assert.match(rows('LaLiga')[0],/Barcelona/);
 assert.equal(rows('Premier League').length,1);assert.equal(rows('Serie A').length,0);assert.equal(rows('Todas').length,2);
 assert.deepEqual(eventTeams(events[0]),['futbol:83','futbol:86']);assert.equal(teamLabel('futbol:86'),'Real Madrid');assert.equal(teamLabel(147),'Yankees');
});
