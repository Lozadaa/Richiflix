import test from 'node:test';
import assert from 'node:assert/strict';
import {eventTeams,followedEventIds,teamLabel,upcomingAlerts} from './followedTeams.js';

const M=60000,start=Date.parse('2026-10-06T22:00:00Z');
const game=(id,title,extra={})=>({id,kind:'iptv',isEvent:true,title,genre:'MLB EVENTS',eventStartsAt:new Date(start).toISOString(),...extra});
const nyy=game('event:a','New York Yankees vs. Tampa Bay Rays'),bos=game('event:b','Boston Red Sox vs. Toronto Blue Jays'),news={id:'news',kind:'iptv',title:'CNN'};
test('eventTeams, followedEventIds and teamLabel',()=>{
 assert.deepEqual(eventTeams(nyy),[147,139]);assert.deepEqual(eventTeams(news),[]);
 assert.equal(teamLabel(147),'Yankees');assert.equal(teamLabel(1),'');
 assert.deepEqual([...followedEventIds([nyy,bos,news],[139])],['event:a']);assert.equal(followedEventIds([nyy],[]).size,0);
});
test('upcomingAlerts: ≤10 min, then live, once per event and stage',()=>{
 const events=[nyy,bos],teams=[147];
 assert.equal(upcomingAlerts({events,teams,now:start-11*M}).alerts.length,0);
 const soon=upcomingAlerts({events,teams,now:start-8*M+5000});
 assert.deepEqual(soon.alerts.map(alert=>[alert.event.id,alert.stage,alert.text]),[['event:a','soon','Yankees vs. Rays empieza en 8 min · OK para ver']]);
 assert.equal(upcomingAlerts({events,teams,now:start-2*M,notified:soon.notified}).alerts.length,0);
 const live=upcomingAlerts({events,teams,now:start+M,notified:soon.notified});
 assert.equal(live.alerts[0].text,'Yankees vs. Rays está en juego · OK para ver');
 assert.equal(upcomingAlerts({events,teams,now:start+2*M,notified:live.notified}).alerts.length,0);
 // Already live when first seen: one 'live' alert and no late 'soon'.
 const first=upcomingAlerts({events,teams,now:start+5*M});assert.deepEqual(first.alerts.map(alert=>alert.stage),['live']);assert.ok(first.notified.has('event:a:soon'));
 assert.equal(upcomingAlerts({events,teams:[],now:start}).alerts.length,0);
});
