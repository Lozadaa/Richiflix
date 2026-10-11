import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStandings,parseLeaders,parseFixtures,recentForm,fixtureDays,fixtureMonths,dayLabel,leagueSlug} from './leagueStats.js';
import {parseSummary,phaseLabel} from './matchDetail.js';
import {upcomingAlerts} from './followedTeams.js';
import {groupLiveEvents} from './liveEvents.js';
import {reconcileFootballEvent,scoreboardGames} from './footballSchedule.js';

const entry=(id,rank,points,note)=>({team:{id,displayName:'Club '+id,shortDisplayName:'C'+id,abbreviation:'C'+id},note,stats:[['rank',rank],['gamesPlayed','6'],['wins','5'],['ties','1'],['losses','0'],['pointsFor','18'],['pointsAgainst','8'],['pointDifferential','+10'],['points',points]].map(([name,displayValue])=>({name,displayValue}))});
test('standings: sorted by rank, local crests for known clubs, zones translated',()=>{
 const table=parseStandings({children:[{name:'2026-2027 Italian Serie A',standings:{seasonDisplayName:'2026-27 Italian Serie A',entries:[entry('999',2,'13',{color:'#81D6AC',description:'Relegation'}),entry('110',1,'16',{color:'#81D6AC',description:'Champions League'})]}}]});
 assert.equal(table.season,'2026-27');assert.equal(table.groups.length,1);assert.equal(table.groups[0].name,null);
 assert.deepEqual(table.rows.map(row=>row.rank),[1,2]);
 assert.equal(table.rows[0].name,'Inter Milan');assert.equal(table.rows[0].logo,'artwork/futbol/110.png');assert.equal(table.rows[0].difference,10);assert.equal(table.rows[0].points,16);
 assert.equal(table.rows[1].name,'C999','unknown clubs keep ESPN names, without a crest');assert.equal(table.rows[1].logo,null);
 assert.deepEqual(table.zones.map(zone=>zone.label),['Champions League','Descenso']);
 assert.equal(parseStandings({children:[]}),null);assert.equal(parseStandings(null),null);
});
test('groups, zones and conferences keep a Spanish name; split seasons keep their tournament',()=>{
 const groups=parseStandings({children:[{name:'Group A',standings:{entries:[entry('5',1,'9')]}},{name:'Eastern Conference',standings:{entries:[entry('16',1,'7')]}}]});
 assert.deepEqual(groups.groups.map(group=>group.name),['Grupo A','Conferencia Este']);
 assert.equal(parseStandings({children:[{name:'2026 Torneo Apertura',standings:{entries:[entry('227',1,'30')]}}]}).tournament,'Apertura');
});
test('leaders: top ten goals and assists with club and appearances',()=>{
 const leader=(id,value)=>({value,athlete:{id,displayName:'Player '+id,team:{id:'104',shortDisplayName:'Roma'},statistics:[{name:'appearances',value:5}]}});
 const data={stats:[{name:'goalsLeaders',leaders:Array.from({length:12},(_,index)=>leader(String(index),12-index))},{name:'assistsLeaders',leaders:[leader('a',4),{value:3,athlete:null}]}]};
 const {goals,assists}=parseLeaders(data);
 assert.equal(goals.length,10);assert.equal(goals[0].value,12);assert.equal(goals[0].club.name,'AS Roma');assert.equal(goals[0].matches,5);
 assert.deepEqual(assists.map(player=>player.name),['Player a']);
 assert.deepEqual(parseLeaders({}),{goals:[],assists:[]});
 assert.equal(leagueSlug('Serie A'),'ita.1');assert.equal(leagueSlug('Chile'),'chi.1');assert.equal(leagueSlug('Selecciones'),'selecciones');assert.equal(leagueSlug('Eventos hoy'),null);
});
const NOW=Date.parse('2026-10-11T15:00:00Z');
const event=(id,date,home,away,state,scores=[],extra={})=>({id,date,competitions:[{status:{displayClock:"67'",type:{state,name:state==='post'?'STATUS_FULL_TIME':'STATUS_SCHEDULED',shortDetail:state==='post'?'FT':state==='in'?"67'":'',description:''}},competitors:[{homeAway:'home',team:{id:home},score:scores[0]},{homeAway:'away',team:{id:away},score:scores[1]}],...extra}]});
test('fixtures: states, legs and knockout rounds in Spanish; form from finished matches',()=>{
 const fixtures=parseFixtures({events:[
  event('1','2026-10-04T18:00Z','2688','4139','post',['2','1']),event('2','2026-10-07T18:00Z','4139','885','post',['0','0']),
  event('3','2026-10-11T14:00Z','2688','885','in',['1','0']),event('4','2026-10-15T23:00Z','2029','3445','pre',[],{notes:[{headline:'1st Leg'}],series:{title:'Semifinals'}}),
  event('5','2026-10-12T20:00Z','885','4139','post',[],{status:{type:{state:'post',name:'STATUS_POSTPONED'}}}),
 ]},'chi.1');
 assert.deepEqual(fixtures.map(match=>match.state),['final','final','live','postponed','pre']);
 assert.equal(fixtures[4].round,'Semifinal');assert.equal(fixtures[4].leg,'Ida');assert.equal(fixtures[0].home.name,'Colo Colo');
 const form=recentForm(fixtures);
 assert.deepEqual(form.get('futbol:2688'),['G']);assert.deepEqual(form.get('futbol:4139'),['P','E']);
 assert.equal(phaseLabel(fixtures[2],()=>'x'),"67'");assert.equal(phaseLabel(fixtures[0],()=>'x'),'Final');assert.equal(phaseLabel(fixtures[3],()=>'x'),'Aplazado');
 const days=fixtureDays(fixtures,NOW);
 assert.deepEqual(days.map(day=>day.label),['Hoy','Mañana','jue 15 oct'],'three days back, eight ahead');
 assert.equal(dayLabel(Date.parse('2026-10-10T20:00Z'),NOW),'Ayer');
 assert.deepEqual(fixtureMonths(NOW),['202609','202610']);assert.deepEqual(fixtureMonths(Date.parse('2026-10-25T12:00Z')),['202609','202610','202611']);
});
test('match summary: goals by side with assists, cards, substitutions, stats and line-ups',()=>{
 const data={header:{competitions:[{id:'9',date:'2026-10-11T14:00Z',status:{displayClock:"67'",type:{state:'in',shortDetail:"67'"}},competitors:[{homeAway:'home',team:{id:'2688'},score:'1'},{homeAway:'away',team:{id:'4139'},score:'0'}]}]},
  keyEvents:[{id:'1',type:{text:'Kickoff'}},{id:'2',type:{text:'Goal'},clock:{displayValue:"12'"},team:{id:'2688'},participants:[{athlete:{displayName:'A'}},{athlete:{displayName:'B'}}]},
   {id:'3',type:{text:'Yellow Card'},clock:{displayValue:"30'"},team:{id:'4139'},participants:[{athlete:{displayName:'C'}}]},{id:'4',type:{text:'Substitution'},clock:{displayValue:"46'"},team:{id:'4139'},participants:[{athlete:{displayName:'D'}},{athlete:{displayName:'E'}}]},
   {id:'5',type:{text:'Penalty - Missed'},clock:{displayValue:"50'"},team:{id:'2688'},participants:[{athlete:{displayName:'F'}}]}],
  boxscore:{teams:[{team:{id:'2688'},statistics:[{name:'possessionPct',displayValue:'58.2'},{name:'totalShots',displayValue:'9'},{name:'passPct',displayValue:'0.84'}]},{team:{id:'4139'},statistics:[{name:'possessionPct',displayValue:'41.8'},{name:'totalShots',displayValue:'4'},{name:'passPct',displayValue:'0.77'}]}]},
  rosters:[{homeAway:'home',formation:'4-3-3',roster:[{starter:true,jersey:'1',athlete:{displayName:'Keeper'},position:{abbreviation:'G'}},{starter:false,subbedIn:true,jersey:'20',athlete:{displayName:'Sub'}}]}],
  gameInfo:{venue:{fullName:'Estadio Monumental',address:{city:'Santiago'}}}};
 const match=parseSummary(data);
 assert.equal(match.state,'live');assert.equal(match.home.name,'Colo Colo');assert.equal(match.home.score,1);assert.equal(match.venue,'Estadio Monumental · Santiago');
 assert.deepEqual(match.events.map(entry=>[entry.kind,entry.side,entry.player,entry.other]),[['goal','home','A','B'],['yellow','away','C',null],['sub','away','D','E']]);
 assert.deepEqual(match.stats.map(stat=>[stat.label,stat.home,stat.away]),[['Posesión',58.2,41.8],['Tiros',9,4],['Precisión de pases',84,77]]);
 assert.equal(match.lineups.home.formation,'4-3-3');assert.deepEqual(match.lineups.home.bench.map(player=>player.name),['Sub']);assert.equal(match.lineups.away,null);
 assert.equal(parseSummary({}),null);
});
test('followed football teams: a goal alerts once; the first score seen only sets the baseline',()=>{
 const kickOff=Date.parse('2026-10-11T14:00:00Z'),game=score=>scoreboardGames({events:[event('77','2026-10-11T14:00Z','2688','4139','in',score)]},'chi.1');
 const live=score=>groupLiveEvents([reconcileFootballEvent({kind:'iptv',id:'a',title:'Colo Colo vs La U',eventStartsAt:kickOff},game(score))]).events;
 let state=upcomingAlerts({events:live(['0','0']),teams:['futbol:2688'],now:kickOff+20*60000});
 assert.deepEqual(state.alerts.map(alert=>alert.stage),['live']);
 state=upcomingAlerts({events:live(['0','0']),teams:['futbol:2688'],now:kickOff+21*60000,notified:state.notified});assert.equal(state.alerts.length,0);
 state=upcomingAlerts({events:live(['1','0']),teams:['futbol:2688'],now:kickOff+30*60000,notified:state.notified});
 assert.equal(state.alerts.length,1);assert.equal(state.alerts[0].stage,'goal');assert.match(state.alerts[0].text,/^Gol de Colo Colo · Colo Colo 1 – 0 U de Chile/);
 state=upcomingAlerts({events:live(['1','0']),teams:['futbol:2688'],now:kickOff+31*60000,notified:state.notified});assert.equal(state.alerts.length,0,'once per goal');
});
test('one list with repeated positions becomes one table per group, in ESPN order',()=>{
 const table=parseStandings({children:[{name:'First Stage',standings:{entries:[entry('17086',1,'74'),entry('17176',1,'39'),entry('9283',2,'51'),entry('4812',2,'37'),entry('4816',3,'46')]}}]});
 assert.deepEqual(table.groups.map(group=>[group.name,group.rows.map(row=>row.name)]),[['Grupo 1',['Ind. del Valle','U. Católica','LDU']],['Grupo 2',['Mushuc Runa','Cuenca']]]);
});
