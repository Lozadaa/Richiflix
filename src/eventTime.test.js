import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledEventTime,eventCountdown,eventInstant,zonedEventTime,EVENTS_TIME_ZONE,eventStartLabel,eventDisplayTitle} from './eventTime.js';
import {normaliseItem} from './xtream.js';
const item={kind:'iptv',title:'19:00 New York Yankees vs. Tampa Bay Rays · MLB',genre:'EVENTOS DIARIOS'};
test('an explicitly supplied source timezone uses its catalogue date and seasonal offsets',()=>{
 assert.equal(EVENTS_TIME_ZONE,'America/Santiago');
 assert.equal(scheduledEventTime(item,{updatedAt:'2026-10-05T15:00:00Z',timeZone:EVENTS_TIME_ZONE}),Date.parse('2026-10-05T22:00:00Z'));
 assert.equal(scheduledEventTime(item,{updatedAt:'2026-05-05T15:00:00Z',timeZone:EVENTS_TIME_ZONE}),Date.parse('2026-05-05T23:00:00Z'));
});
test('eterboxtv MLB central clocks agree with the official UTC schedule, then display Santiago time',()=>{
 const context={host:'http://provider.example.test:8080',updatedAt:'2026-10-05T19:27:14Z'};
 const startsAt=scheduledEventTime(item,context);
 assert.equal(startsAt,Date.parse('2026-10-06T00:00:00Z'));
 assert.match(eventStartLabel({...item,eventStartsAt:startsAt}),/05.*10.*21:00.*Santiago/);
 assert.equal(scheduledEventTime({...item,title:'16:00 Chicago White Sox vs. Cleveland Guardians · MLB'},context),Date.parse('2026-10-05T21:00:00Z'));
 assert.equal(scheduledEventTime(item,{...context,updatedAt:'2026-05-05T19:27:14Z'}),Date.parse('2026-05-06T00:00:00Z'));
 assert.match(eventStartLabel({...item,eventStartsAt:Date.parse('2026-05-06T00:00:00Z')}),/20:00/);
 assert.equal(scheduledEventTime(item,{...context,host:'https://another-provider.test'}),null);
});
test('eterboxtv soccer dates are month/day and their AM/PM clock is Eastern US',()=>{
 const context={host:'http://provider.example.test:8080',updatedAt:'2026-10-05T19:27:14Z'};
 const soccer=title=>({...item,title,genre:'EVENTOS DIARIOS'});
 const cerro=soccer('10/05 Soccer 6:15pm Cerro Porteño vs 2 de Mayo');
 const startsAt=scheduledEventTime(cerro,context);
 assert.equal(startsAt,Date.parse('2026-10-05T22:15:00Z'));
 assert.match(eventStartLabel({...cerro,eventStartsAt:startsAt}),/19:15/);
 assert.equal(eventDisplayTitle({...cerro,eventStartsAt:startsAt}),'Cerro Porteño vs 2 de Mayo');
 assert.equal(scheduledEventTime(soccer('10/05 Soccer 4:00pm Sportivo Trinidense vs Sportivo Luqueño'),context),Date.parse('2026-10-05T20:00:00Z'));
 assert.equal(scheduledEventTime(soccer('10/05 Soccer 2:45pm France vs Belgium'),context),Date.parse('2026-10-05T18:45:00Z'));
 assert.equal(scheduledEventTime(soccer('10/05 Soccer 12:00am A vs B'),context),Date.parse('2026-10-05T04:00:00Z'));
 assert.equal(scheduledEventTime(soccer('10/05 Soccer 12:00pm A vs B'),context),Date.parse('2026-10-05T16:00:00Z'));
 assert.equal(scheduledEventTime(soccer('10/05 Soccer 11:30pm A vs B'),context),Date.parse('2026-10-06T03:30:00Z'));
 assert.match(eventStartLabel({eventStartsAt:Date.parse('2026-10-06T03:30:00Z')}),/06.*10.*00:30/);
 for(const title of ['10/05 Soccer 0:30pm A vs B','10/05 Soccer 13:30pm A vs B','02/31 Soccer 6:00pm A vs B'])assert.equal(scheduledEventTime(soccer(title),context),null);
 assert.equal(scheduledEventTime(soccer('01/01 Soccer 6:00pm A vs B'),{...context,updatedAt:'2026-12-31T20:00:00Z'}),Date.parse('2027-01-01T23:00:00Z'));
});
test('the decorated 24-hour event feed is Central for football, NBA, NFL and PPV, not just MLB',()=>{
 const context={host:'http://provider.example.test:8080',updatedAt:'2026-10-05T19:27:14Z'};
 for(const [title,expected] of [
  ['13:45 ◘ Francia vs. Bélgica ◘ UEFA Nations League ◘','2026-10-05T18:45:00Z'],
  ['19:15 ◘ Atlanta Falcons vs. New Orleans Saints ◘ NFL ◘','2026-10-06T00:15:00Z'],
  ['19:00 ◘ Minnesota Timberwolves vs. Milwaukee Bucks ◘ NBA ◘','2026-10-06T00:00:00Z'],
  ['19:00 ◘ WWE RAW ◘ PPV ◘','2026-10-06T00:00:00Z']
 ])assert.equal(scheduledEventTime({...item,title},context),Date.parse(expected));
 // A 24/7 channel is a channel name, not a month/day event.
 assert.equal(scheduledEventTime({...item,title:'24/7 Castle Rock'},context),null);
});
test('explicit starts override inferred daily hours; creation timestamps are never event starts',()=>{
 const time='2026-10-06T19:00:00-03:00';
 assert.equal(scheduledEventTime({...item,eventStartsAt:time},{updatedAt:'2026-10-05T15:00:00Z',timeZone:EVENTS_TIME_ZONE}),Date.parse(time));
 const account={host:'https://fixture.test',username:'fixture',password:'fixture-password'};
 const raw={stream_id:123,name:'MLB Network',added:1791324000};
 assert.equal(normaliseItem(raw,'live',new Map(),account).eventStartsAt,null);
 assert.equal(normaliseItem({...raw,start_timestamp:Date.parse(time)/1000},'live',new Map(),account).eventStartsAt,Date.parse(time));
});
test('dated titles work, ambiguous or invalid dates and missing scheduling evidence do not get counters',()=>{
 const context={updatedAt:'2026-10-05T15:00:00Z',timeZone:EVENTS_TIME_ZONE};
 assert.equal(scheduledEventTime({...item,title:'19:00 Yankees vs. Rays 2026-10-06'},context),Date.parse('2026-10-06T22:00:00Z'));
 for(const title of ['24:00 MLB','19:99 MLB','19:00 MLB 2026-02-31','19:00 News','MLB Network'])assert.equal(scheduledEventTime({...item,title,genre:'TV en vivo'},context),null);
 assert.equal(scheduledEventTime(item,{timeZone:EVENTS_TIME_ZONE}),null);
 assert.equal(scheduledEventTime(item,{...context,timeZone:'invalid/zone'}),null);
 assert.equal(scheduledEventTime({...item,kind:'vod'},context),null);
 assert.equal(eventInstant('2026-02-31T19:00:00Z'),null);
 assert.equal(eventInstant('2026-10-05 19:00:00'),null);
});
test('DST gaps and repeated wall-clock times are rejected without an explicit offset',()=>{
 assert.equal(zonedEventTime({year:2026,month:3,day:8},2,30,'America/New_York'),null);
 assert.equal(zonedEventTime({year:2026,month:11,day:1},1,30,'America/New_York'),null);
});
test('counters tick through minutes and seconds, stop at zero and never roll stale events into tomorrow',()=>{
 const event={...item,eventStartsAt:Date.parse('2026-10-05T22:00:00Z')};
 assert.equal(eventCountdown(event,Date.parse('2026-10-05T19:45:00Z')).label,'Empieza en 2 h 15 min');
 assert.equal(eventCountdown(event,event.eventStartsAt-59000).label,'Empieza en 59 s');
 assert.equal(eventCountdown(event,event.eventStartsAt).state,'scheduled');
 assert.equal(eventCountdown(event,event.eventStartsAt+86400000).state,'scheduled');
 assert.equal(eventCountdown({}),null);
});
