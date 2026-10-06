import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mlbMatchup,mlbTeams} from './mlbArtwork.js';

test('all 30 teams have official local vector logos and match their full IPTV name',()=>{
 assert.equal(mlbTeams.length,30);
 for(const team of mlbTeams){
  assert.equal(mlbMatchup({kind:'iptv',title:team.name,genre:'TEAMS MLB'}).teams[0].id,team.id);
  assert.match(readFileSync(new URL(`../public/artwork/mlb/${team.id}.svg`,import.meta.url),'utf8'),/^<svg/);
 }
});
test('provider event titles compose exact pairs without altering playback identity',()=>{
 const item={id:'opaque-stream',kind:'iptv',title:'19:00 ◘ New York Yankees vs. Tampa Bay Rays ◘ MLB ◘◘ Spanish'};
 assert.deepEqual(mlbMatchup(item).teams.map(team=>team.id),[147,139]);assert.equal(item.id,'opaque-stream');
 assert.deepEqual(mlbMatchup({kind:'iptv',title:'CWS @ CLE | MLB'}).teams.map(team=>team.id),[145,114]);
 assert.deepEqual(mlbMatchup({kind:'iptv',title:'Mets contra Yankees'}).teams.map(team=>team.id),[121,147]);
 assert.deepEqual(mlbMatchup({kind:'iptv',title:'Yankees SD vs. Rays HD | MLB'}).teams.map(team=>team.id),[147,139]);
});
test('historical names and provider typos resolve, ambiguous and unknown games keep category art',()=>{
 for(const [title,id] of [['Oakland Athletics',133],['St Louis Cardinals',138],['Philiadelphia Phillies',143],['Cleveland Indians',114]])assert.equal(mlbMatchup({kind:'iptv',title,genre:'MLB'}).teams[0].id,id);
 for(const title of ['MLB Network','MLB Network SD','New York vs. Chicago','Yankees vs. Unknown','Yankees vs. Yankees','Yankees vs. Rays vs. Mets'])assert.equal(mlbMatchup({kind:'iptv',title,genre:'MLB'}),null);
 assert.equal(mlbMatchup({kind:'xtream',title:'Pirates',mediaType:'movie'}),null);
 assert.equal(mlbMatchup({kind:'iptv',title:'Texas Rangers',genre:'News'}),null);
});
