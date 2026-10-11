import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStandings,parseLeaders,leagueSlug} from './leagueStats.js';

const entry=(id,rank,points,note)=>({team:{id,displayName:'Club '+id,shortDisplayName:'C'+id,abbreviation:'C'+id},note,stats:[['rank',rank],['gamesPlayed','6'],['wins','5'],['ties','1'],['losses','0'],['pointsFor','18'],['pointsAgainst','8'],['pointDifferential','+10'],['points',points]].map(([name,displayValue])=>({name,displayValue}))});
test('standings: sorted by rank, local crests for known clubs, zones translated',()=>{
 const table=parseStandings({children:[{name:'2026-2027 Italian Serie A',standings:{seasonDisplayName:'2026-27 Italian Serie A',entries:[entry('999',2,'13',{color:'#81D6AC',description:'Relegation'}),entry('110',1,'16',{color:'#81D6AC',description:'Champions League'})]}}]});
 assert.equal(table.season,'2026-27');assert.equal(table.phase,null);
 assert.deepEqual(table.rows.map(row=>row.rank),[1,2]);
 assert.equal(table.rows[0].name,'Inter Milan');assert.equal(table.rows[0].logo,'artwork/futbol/110.png');assert.equal(table.rows[0].difference,10);assert.equal(table.rows[0].points,16);
 assert.equal(table.rows[1].name,'C999','unknown clubs keep ESPN names, without a crest');assert.equal(table.rows[1].logo,null);
 assert.deepEqual(table.zones.map(zone=>zone.label),['Champions League','Descenso']);
 assert.equal(parseStandings({children:[]}),null);assert.equal(parseStandings(null),null);
});
test('leaders: top ten goals and assists with club and appearances',()=>{
 const leader=(id,value)=>({value,athlete:{id,displayName:'Player '+id,team:{id:'104',shortDisplayName:'Roma'},statistics:[{name:'appearances',value:5}]}});
 const data={stats:[{name:'goalsLeaders',leaders:Array.from({length:12},(_,index)=>leader(String(index),12-index))},{name:'assistsLeaders',leaders:[leader('a',4),{value:3,athlete:null}]}]};
 const {goals,assists}=parseLeaders(data);
 assert.equal(goals.length,10);assert.equal(goals[0].value,12);assert.equal(goals[0].club.name,'AS Roma');assert.equal(goals[0].matches,5);
 assert.deepEqual(assists.map(player=>player.name),['Player a']);
 assert.deepEqual(parseLeaders({}),{goals:[],assists:[]});
 assert.equal(leagueSlug('Serie A'),'ita.1');assert.equal(leagueSlug('Eventos hoy'),null);
});
