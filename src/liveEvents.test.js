import test from 'node:test';
import assert from 'node:assert/strict';
import {eventKey,groupLiveEvents,eventPhase,eventPhaseLabel,splitLiveEvents,homeLiveEvents,liveNowCount,eventCaption,rememberFeed,preferredFeed,feedLanguage,liveHubRows,liveChipItems} from './liveEvents.js';
import {createCatalogueIndex} from './catalogueIndex.js';
import {reconcileMLBEvent} from './mlbSchedule.js';
import {prepareChannels} from './channelPreparation.js';
import {displayTitle} from './artwork.js';
import {loadXtreamEpisodes} from './xtream.js';

test('F2 prepared language wins and search indexes original and clean names locally and in worker',async()=>{
 const channels=await prepareChannels({channels:[{id:'espn',title:'US: ESPN HD [ENG]',kind:'iptv'},{id:'hbo',title:'H_B_O',kind:'iptv'}]});
 assert.equal(channels[0].displayTitle,'ESPN');assert.equal(channels[0].language,'en');assert.equal(channels[0].quality,'HD');assert.equal(channels[0].country,'US');assert.equal(channels[0].title,'US: ESPN HD [ENG]');assert.equal(displayTitle(channels[0]),'ESPN');
 const signals=[channel('clean-en','Yankees vs. Rays',{language:'en'}),channel('clean-es','Yankees vs. Rays',{language:'es'})];
 assert.equal(feedLanguage(signals[1]),'es');assert.equal(groupLiveEvents(signals).events[0].preferredFeedId,'clean-es');
 const {createCatalogueWorkerClient}=await import('./catalogueWorkerClient.js'),{createCatalogueWorkerService}=await import('./catalogueWorker.js');
 const service=createCatalogueWorkerService(),client=createCatalogueWorkerClient({createWorker:()=>{throw Error('Headless');},fallbackFactory:()=>service});
 try{for(const workerClient of [undefined,client]){const index=createCatalogueIndex(channels,{workerClient});assert.deepEqual(await index.search(channels,'espn hd'),[channels[0]]);assert.deepEqual(await index.search(channels,'h b o'),[channels[1]]);}}finally{client.dispose();}
});
test('F2 episode receipt keeps provider numbers and cleans the visible title once',async()=>{
 const account={host:'https://fixture.invalid',username:'fixture',password:'fixture',name:'Fixture'};
 const fetcher=async()=>new Response(JSON.stringify({info:{name:'Breaking Bad'},episodes:{2:[{id:1,title:'Breaking Bad - S02E01 - Piloto [ENG] HD',episode_num:13}]}}));
 const [group]=await loadXtreamEpisodes(account,'1',fetcher),[episode]=group.episodes;
 assert.equal(episode.title,'Piloto');assert.equal(episode.displayTitle,'Piloto');assert.equal(episode.originalTitle,'Breaking Bad - S02E01 - Piloto [ENG] HD');assert.equal(episode.episodeNumber,13);assert.equal(episode.season,'2');assert.equal(episode.language,'en');
});

const start=Date.parse('2026-10-07T00:00:00Z'),H=3600000,M=60000; // 21:00 Santiago, 6 Oct
const channel=(id,title,extra={})=>({id,kind:'iptv',mediaType:'live',title,genre:'MLB EVENTS',source:'eterbox',eventStartsAt:start,...extra});
const feeds=[
 channel('a','19:00 New York Yankees vs. Tampa Bay Rays · MLB · English',{source:'MLB Events',image:'https://x.test/a.png'}),
 channel('b','19:00 New York Yankees vs. Tampa Bay Rays · MLB · Spanish',{source:'MLB Events',image:'generic.png',imageGeneric:true}),
 channel('c','19:00 ◘ New York Yankees vs. Tampa Bay Rays ◘ MLB ◘ ENG',{genre:'EVENTOS DIARIOS'}),
 channel('d','19:00 ◘ Yankees vs. Rays ◘ MLB ◘ Spanish',{genre:'EVENTOS DIARIOS',image:'https://x.test/d.png'}),
];
const network=channel('net','MLB Network',{eventStartsAt:null});

test('four ES/EN signals from two sources become one event that prefers Spanish with real art',()=>{
 const {events,channels}=groupLiveEvents([...feeds,network]);
 assert.equal(events.length,1);assert.deepEqual(channels,[network]);
 const [event]=events;
 assert.equal(event.feeds.length,4);assert.equal(event.preferredFeedId,'d');assert.deepEqual(event.feeds.map(feed=>feed.id),['d','b','a','c']);
 assert.deepEqual(event.feeds.map(feed=>feed.label),['ES · eterbox','ES · MLB Events','EN · MLB Events','EN · eterbox']);
 assert.equal(event.id,'event:mlb:139-147:2026-10-06');assert.equal(event.isEvent,true);assert.equal(event.kind,'iptv');assert.equal(event.mediaType,'live');
 assert.equal(event.title,'◘ Yankees vs. Rays ◘ MLB ◘ Spanish');assert.equal(event.image,'https://x.test/d.png');
 assert.equal(eventCaption(event),'4 señales · ES · EN');
 assert.equal(preferredFeed(event).id,'d');rememberFeed(event,'a');assert.equal(preferredFeed(event).id,'a');
});

test('official MLB ids, doubleheaders, 24 h channels and title keys',()=>{
 assert.equal(eventKey(network),null);assert.equal(eventKey(channel('n','Noticias 24 h',{eventStartsAt:null,genre:'Noticias'})),null);
 assert.equal(eventKey({...feeds[0],eventOfficialId:776}),'mlb:776');
 const late=start-4*H,second=feeds.map(item=>({...item,id:item.id+'2',eventStartsAt:late}));
 assert.equal(groupLiveEvents([...feeds,...second]).events.length,2,'without official ids the clocks split a doubleheader');
 const games=[{id:1,date:'2026-10-06',startsAt:start,teams:[147,139],detail:'In Progress'},{id:2,date:'2026-10-06',startsAt:late,teams:[147,139],detail:'Scheduled'}];
 const reconciled=[...feeds,...second].map(item=>reconcileMLBEvent(item,games));
 assert.equal(reconciled[0].eventDetail,'In Progress');
 const {events}=groupLiveEvents(reconciled);assert.deepEqual(events.map(event=>event.id),['event:mlb:1','event:mlb:2']);assert.equal(eventPhase(events[0],start-H),'live','MLB detail wins');
 const soccer=['10/05 Soccer 6:15pm Cerro Porteño vs 2 de Mayo (ES) HD','Cerro Porteno vs. 2 de Mayo EN'].map((title,index)=>({...channel('s'+index,title,{genre:'Fútbol'}),eventDisplayTitle:title.replace(/^10\/05 Soccer 6:15pm /,'')}));
 assert.equal(groupLiveEvents(soccer).events.length,1);
 assert.equal(feedLanguage({title:'Fútbol en vivo',genre:'EVENTOS EN VIVO'}),null);
});

test('phases at their limits, with MLB detail overriding the estimate',()=>{
 const event=groupLiveEvents(feeds).events[0];
 assert.equal(eventPhase(event,start-31*M),'upcoming');assert.equal(eventPhase(event,start-30*M),'soon');assert.equal(eventPhase(event,start-29*M),'soon');
 assert.equal(eventPhase(event,start),'live');assert.equal(eventPhase(event,start+3*H+29*M),'live');assert.equal(eventPhase(event,start+3*H+31*M),'ended');
 assert.equal(eventPhase(event,start+5*H+29*M),'ended');assert.equal(eventPhase(event,start+5*H+31*M),null);
 const football={kind:'iptv',title:'Francia vs. Bélgica',genre:'Fútbol',eventStartsAt:start};assert.equal(eventPhase(football,start+2*H+14*M),'live');assert.equal(eventPhase(football,start+2*H+16*M),'ended');
 assert.equal(eventPhase({kind:'iptv',title:'WWE RAW',eventStartsAt:start},start+2*H+59*M),'live');
 assert.equal(eventPhase({...event,eventDetail:'Final'},start+H),'ended');assert.equal(eventPhase({...event,eventDetail:'Game Over'},start+6*H),null);
 assert.equal(eventPhase({...event,eventDetail:'Postponed'},start),'postponed');assert.equal(eventPhase({...event,eventStartsAt:null,eventScheduleState:'postponed'}),'postponed');
 assert.equal(eventPhase({...event,eventDetail:'Delayed Start: Rain'},start+10*M),'soon');assert.equal(eventPhaseLabel({...event,eventDetail:'Delayed Start: Rain'},start+10*M).label,'Retrasado');
 assert.equal(eventPhase({...event,eventDetail:'In Progress'},start+4*H),'live');
 // Fase L5: a fresh linescore state decides; a stale one falls back to detail and clock.
 assert.equal(eventPhase({...event,eventScore:{state:'Live'}},start+4*H),'live');assert.equal(eventPhase({...event,eventScore:{state:'Final'}},start+H),'ended');
 assert.equal(eventPhase({...event,eventScore:{state:'Live',stale:true}},start+4*H),'ended');
});

test('short labels: today, tomorrow, weekday, countdown and states, without Santiago',()=>{
 const event=groupLiveEvents(feeds).events[0];
 assert.deepEqual(eventPhaseLabel(event,start-5*H),{phase:'upcoming',label:'Hoy 21:00',time:'21:00'});
 assert.equal(eventPhaseLabel(event,start-25*H).label,'Mañana 21:00');
 assert.equal(eventPhaseLabel(event,start-73*H).label,'Mar 21:00');
 assert.equal(eventPhaseLabel(event,start-12*M).label,'Empieza en 12 min');assert.equal(eventPhaseLabel(event,start-45000).label,'Empieza en 45 s');
 assert.equal(eventPhaseLabel(event,start+H).label,'En juego');assert.equal(eventPhaseLabel(event,start+4*H).label,'Terminado');
 assert.equal(eventPhaseLabel(network),null);
});

test('ended events hide later and give their signals back; home shows live first and four of today',()=>{
 const grouped=groupLiveEvents([...feeds,network]);
 assert.deepEqual(splitLiveEvents(grouped,start+H).events.map(event=>event.isEvent),[true]);
 const after=splitLiveEvents(grouped,start+6*H);assert.equal(after.events.length,0);assert.deepEqual(after.channels.map(item=>item.id),['a','b','c','d','net']);
 const games=Array.from({length:7},(_,index)=>channel('g'+index,`Partido ${index} vs Rival ${index}`,{genre:'Fútbol',eventStartsAt:start-4*H+index*30*M+15*M}));
 const {events}=splitLiveEvents(groupLiveEvents(games),start-3*H);
 assert.deepEqual(events.map(event=>eventPhase(event,start-3*H)),['live','live','soon','upcoming','upcoming','upcoming','upcoming']);
 assert.equal(homeLiveEvents(events,start-3*H).length,6);
 // H2-T4: «Ahora en vivo · 2 en juego»; channels and soon/upcoming events never count, none → 0 (no suffix).
 assert.equal(liveNowCount([...homeLiveEvents(events,start-3*H),network],start-3*H),2);
 assert.equal(liveNowCount([network],start-3*H),0);assert.equal(liveNowCount([],start),0);
});

test('search finds an event by any signal and returns it once',async()=>{
 const grouped=groupLiveEvents([...feeds,network]),items=[...grouped.events,...grouped.channels],index=createCatalogueIndex(items,{workerClient:null});
 assert.deepEqual(index.filter(items,'spanish').map(item=>item.id),[grouped.events[0].id]);
 assert.deepEqual(index.filter(items,'english').map(item=>item.id),[grouped.events[0].id]);
 assert.deepEqual((await index.search(items,'tampa bay',{workerClient:null})).map(item=>item.id),[grouped.events[0].id]);
 assert.equal(index.byId.get('a'),grouped.events[0]);assert.equal(index.byId.get(grouped.events[0].id),grouped.events[0]);
});

test('live hub rows: live, today, tomorrow and ended; chips, provider categories and favourites first',()=>{
 const now=start; // 21:00 Santiago
 const game=(id,title,at,extra={})=>channel(id,`${title} · MLB`,{eventStartsAt:at,...extra});
 const {events,channels}=groupLiveEvents([
  game('late','Chicago Cubs vs. St. Louis Cardinals',now-30*M),game('early','New York Yankees vs. Tampa Bay Rays',now-2*H),
  game('soon','Los Angeles Dodgers vs. San Diego Padres',now+20*M),game('night','Boston Red Sox vs. Toronto Blue Jays',now+2*H),
  game('tomorrow','Houston Astros vs. Seattle Mariners',now+22*H),game('over','Atlanta Braves vs. New York Mets',now-5*H),
  channel('news','CNN 24 h',{eventStartsAt:null,genre:'NEWS | Internacional'}),channel('kids','Cartoon Network',{eventStartsAt:null,genre:'Infantiles'}),
  channel('docu','Discovery',{eventStartsAt:null,genre:'Documentales HD'}),network]);
 assert.deepEqual(liveHubRows({events:[],channels,now}),{rows:[],channels,today:0});
 const ids=rows=>rows.map(row=>[row.title,row.items.map(event=>event.feeds[0].id)]);
 const all=liveHubRows({events,channels,now});
 assert.deepEqual(ids(all.rows),[['En juego ahora',['early','late']],['Próximos de hoy',['soon','night']],['Mañana',['tomorrow']],['Terminados',['over']]]);
 assert.equal(all.rows.at(-1).ended,true);assert.equal(all.today,5);assert.equal(all.channels.length,4);
 const today=liveHubRows({events,channels,category:'Eventos hoy',now});
 assert.deepEqual(today.rows.map(row=>row.title),['En juego ahora','Próximos de hoy','Terminados']);assert.deepEqual(today.channels,[]);
 assert.deepEqual(liveHubRows({events,channels,category:'Noticias',now}),{rows:[],channels:[channels[0]],today:5});
 assert.deepEqual(liveHubRows({events,channels,category:'Infantil',now}).channels.map(item=>item.id),['kids']);
 const sports=liveHubRows({events,channels,category:'Deportes',now});assert.equal(sports.rows.length,4);assert.deepEqual(sports.channels.map(item=>item.id),['net']);
 const provider=liveHubRows({events,channels,category:'MLB EVENTS',now});assert.equal(provider.rows.length,4);assert.deepEqual(provider.channels.map(item=>item.id),['net']);
 assert.deepEqual(liveHubRows({events,channels,category:'Documentales HD',now}).channels.map(item=>item.id),['docu']);
 const night=events.find(event=>event.feeds[0].id==='night');
 assert.deepEqual(ids(liveHubRows({events,channels,favorites:[night.id],now}).rows)[1],['Próximos de hoy',['night','soon']]);
 assert.equal(liveChipItems([...events,...channels],'Todas'),null);assert.equal(liveChipItems([...events,...channels],'Eventos hoy').length,6);
});
