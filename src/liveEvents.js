import {eventInstant,eventDisplayTitle,eventTimeShort,eventDay,eventCountdown} from './eventTime.js';
import {catalogueCategories} from './catalogueCategories.js';
import {mlbMatchup} from './mlbArtwork.js';
import {displayText} from './displayText.js';

// Fase L1: one card per match. Provider signals (ES/EN, several sources) become
// feeds of an event; 24 h channels stay channels. Pure, runs once per catalogue.
const H=3600000,MIN=60000,BASEBALL=/\bmlb\b|baseball|b[eé]isbol/i,SOCCER=/soccer|f[uú]tbol|futbol|liga|premier|champions|copa/i;
const ORDER={live:0,soon:1,upcoming:2,ended:3,postponed:4},WEEKDAYS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const words=item=>`${displayText(item.title)} ${item.genre||''} ${item.category||''}`;
const normal=value=>String(value||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(?:sd|hd|fhd|4k|es|en|spanish|english|espanol|lat|eng)\b/g,' ').replace(/\s+/g,' ').trim();
// Short tokens are case-sensitive and title-only: «en vivo» or «es» in Spanish copy is not a language tag.
export function feedLanguage(item){
 if(item.language)return item.language;
 const title=displayText(item.title),all=words(item);
 return /spanish|espa[nñ]ol/i.test(all)||/\b(?:ES|LAT)\b/.test(title)?'es':/english|ingl[eé]s/i.test(all)||/\b(?:EN|ENG)\b/.test(title)?'en':null;
}
const duration=item=>BASEBALL.test(words(item))||mlbMatchup(item)?3.5*H:SOCCER.test(words(item))?2.25*H:3*H;

export function eventKey(item){
 if(item?.kind!=='iptv')return null;
 if(item.eventOfficialId)return `mlb:${item.eventOfficialId}`;
 const time=eventInstant(item.eventStartsAt);
 if(time===null&&!/\bvs\b/i.test(displayText(item.title)))return null;
 const day=time===null?'':eventDay(time).key,matchup=mlbMatchup(item);
 if(matchup?.teams.length===2)return `mlb:${matchup.teams.map(team=>team.id).sort((a,b)=>a-b).join('-')}:${day}`;
 const name=normal(item.eventDisplayTitle||eventDisplayTitle(item));return name?`${name}:${day}`:null;
}

function createEvent(key,items){
 const labels=new Map(),feeds=items.map((item,index)=>({id:item.id,item,language:feedLanguage(item),source:displayText(item.source||''),index,art:item.image&&!item.imageGeneric?0:1}))
  .sort((a,b)=>(a.language==='es'?0:1)-(b.language==='es'?0:1)||a.art-b.art||a.index-b.index)
  .map(({index,art,...feed})=>{let label=[feed.language?.toUpperCase(),feed.source].filter(Boolean).join(' · ')||'Señal';const used=(labels.get(label)||0)+1;labels.set(label,used);if(used>1)label+=` ${used}`;return {...feed,label};});
 const preferred=feeds[0].item,official=items.find(item=>item.eventOfficialId)||preferred;
 // The event keeps every field of its preferred signal so Card, ExpandedCard, FocusStage and policies work unchanged.
 return {...preferred,id:`event:${key}`,isEvent:true,key,title:preferred.eventDisplayTitle||eventDisplayTitle(preferred),eventStartsAt:official.eventStartsAt,eventScheduleState:official.eventScheduleState||null,eventOfficialId:official.eventOfficialId||null,eventDetail:official.eventDetail||null,eventScore:official.eventScore||null,eventDuration:duration(preferred),feeds,preferredFeedId:feeds[0].id,searchText:[...new Set(items.map(item=>displayText(item.title)))].join(' ')};
}

export function groupLiveEvents(channels){
 const groups=new Map(),rest=[],order=new Map();
 for(const item of channels){order.set(item,order.size);
  const key=eventKey(item);if(!key){rest.push(item);continue;}
  const time=eventInstant(item.eventStartsAt),list=groups.get(key)||[];
  // A doubleheader without official ids shares teams and day; start times keep the games apart.
  let group=list.find(group=>group.time===null||time===null||Math.abs(group.time-time)<2*H);
  if(!group){group={key:list.length?`${key}:${list.length+1}`:key,time,items:[]};list.push(group);groups.set(key,list);}
  group.time??=time;group.items.push(item);
 }
 const events=[];for(const list of groups.values())for(const group of list)events.push(createEvent(group.key,group.items));
 return {events,channels:rest,order};
}

export function eventPhase(event,now=Date.now()){
 if(event?.kind!=='iptv')return null;
 const detail=event.eventDetail||'',start=eventInstant(event.eventStartsAt);
 if(event.eventScheduleState==='postponed'||/postponed|cancel|suspended/i.test(detail))return 'postponed';
 const end=start===null?null:start+(event.eventDuration??duration(event)),state=event.eventScore&&!event.eventScore.stale?event.eventScore.state:'';
 // Fase L5: a fresh linescore's abstractGameState (Live/Final) also decides; a stale one falls back to detail and clock.
 if(state==='Live'||/in progress|live/i.test(detail))return 'live';
 if(state==='Final'||/final|game over|completed/i.test(detail))return end!==null&&now>=end+2*H?null:'ended';
 if(/delayed/i.test(detail))return 'soon';
 if(start===null)return null;
 return now<start-30*MIN?'upcoming':now<start?'soon':now<end?'live':now<end+2*H?'ended':null;
}

export function eventPhaseLabel(event,now=Date.now()){
 const phase=eventPhase(event,now);if(!phase)return null;
 const time=eventTimeShort(event),start=eventInstant(event.eventStartsAt);let label={live:'En juego',ended:'Terminado',postponed:'Aplazado'}[phase];
 if(phase==='upcoming'){const target=eventDay(start),gap=target.day-eventDay(now).day;label=`${gap===0?'Hoy':gap===1?'Mañana':WEEKDAYS[target.weekday]} ${time}`;}
 if(phase==='soon')label=/delayed/i.test(event.eventDetail||'')||start===null||start<=now?'Retrasado':eventCountdown(event,now).label;
 return {phase,label,time};
}

// Ended (and untimed) events disappear; their signals return as plain channels, in catalogue order.
export function splitLiveEvents({events,channels,order},now=Date.now()){
 const visible=[],hidden=[];
 for(const event of events){const phase=eventPhase(event,now);if(phase)visible.push({event,phase,start:eventInstant(event.eventStartsAt)??Infinity});else for(const feed of event.feeds)hidden.push(feed.item);}
 visible.sort((a,b)=>ORDER[a.phase]-ORDER[b.phase]||a.start-b.start);
 return {events:visible.map(entry=>entry.event),channels:hidden.length?[...channels,...hidden].sort((a,b)=>order.get(a)-order.get(b)):channels};
}
export function homeLiveEvents(events,now=Date.now()){
 const today=eventDay(now).day,live=events.filter(event=>eventPhase(event,now)==='live');
 return [...live,...events.filter(event=>{const start=eventInstant(event.eventStartsAt);return start!==null&&['soon','upcoming'].includes(eventPhase(event,now))&&eventDay(start).day===today;}).slice(0,4)];
}
// H2-T4: «Ahora en vivo · N en juego» on Inicio: events in the live phase (24 h channels never count).
export function liveNowCount(items,now=Date.now()){let count=0;for(const item of items)if(item.isEvent&&eventPhase(item,now)==='live')count++;return count;}
// «En juego · desde 19:00», «Hoy 21:00 · Empieza en 2 h»: expanded card and banner.
export const eventPhaseLine=(event,phase)=>!phase?'':phase.phase==='live'?`En juego · desde ${phase.time}`:phase.phase==='upcoming'?`${phase.label} · ${eventCountdown(event).label}`:[phase.label,phase.phase==='postponed'?'':phase.time].filter(Boolean).join(' · ');
export function eventCaption(event){
 const sources=new Set(event.feeds.map(feed=>feed.source)).size,languages=new Set(event.feeds.map(feed=>feed.language));
 const base=sources>1?`${event.feeds.length} señales`:[eventTimeShort(event),displayText(event.genre||'')].filter(Boolean).join(' · ');
 return base+(languages.has('es')?languages.has('en')?' · ES · EN':' · ES':'');
}

// The signal chosen in the expanded card is remembered per event for the session.
const chosen=new Map();
export function rememberFeed(event,feedId){chosen.set(event.id,feedId);}
export function preferredFeed(event){const id=chosen.get(event.id)??event.preferredFeedId;return event.feeds?.find(feed=>feed.id===id)||event.feeds?.[0]||null;}

// Fase L3: «TV en vivo» and «MLB» as rows. Fixed chips map provider category names by regex;
// any other value is a provider category. Pure; App memoizes it per catalogue, chip and phase/day change.
const LIVE_CHIP_RULES=[['Deportes',/sport|deport|futbol|fútbol|mlb|nba|nfl|ufc|box/i],['Noticias',/news|notici/i],['Cine',/cine|movie|pel[ií]cul/i],['Infantil',/kids|infantil|cartoon|niñ/i],['Música',/music|m[uú]sica/i],['Documentales',/docu/i]];
export const LIVE_HUB_CHIPS=['Eventos hoy',...LIVE_CHIP_RULES.map(([name])=>name)];
const itemCategories=item=>item.isEvent?item.feeds.flatMap(feed=>catalogueCategories(feed.item)):catalogueCategories(item);
// null for «Todas»: no filter. A function for a fixed chip or provider category.
function liveCategoryTest(category){
 if(!category||category==='Todas')return null;
 if(category==='Eventos hoy')return item=>Boolean(item.isEvent);
 const rule=LIVE_CHIP_RULES.find(([name])=>name===category)?.[1];
 return rule?item=>itemCategories(item).some(name=>rule.test(name)):item=>itemCategories(item).includes(category);
}
export const isLiveChip=category=>category==='Eventos hoy'||LIVE_CHIP_RULES.some(([name])=>name===category);
export function liveChipItems(items,category){const test=isLiveChip(category)&&liveCategoryTest(category);return test?items.filter(test):null;}
export function liveHubRows({events,channels,category='Todas',favorites=[],now=Date.now()}){
 const test=liveCategoryTest(category),saved=new Set(favorites),today=eventDay(now).day,buckets={live:[],today:[],tomorrow:[],later:[],ended:[]};let count=0;
 for(const event of events){
  const phase=eventPhase(event,now);if(!phase)continue;const start=eventInstant(event.eventStartsAt),day=start===null?today:eventDay(start).day;
  if(day===today)count++;if(test&&!test(event))continue;
  const bucket=phase==='live'?'live':phase==='ended'?'ended':day<=today?'today':day===today+1?'tomorrow':'later';
  if(category==='Eventos hoy'&&(bucket==='tomorrow'||bucket==='later'))continue;
  buckets[bucket].push({event,start:start??Infinity,saved:saved.has(event.id)?0:1});
 }
 const sorted=list=>list.sort((a,b)=>a.saved-b.saved||a.start-b.start).map(entry=>entry.event);
 const rows=[['live','En juego ahora'],['today','Próximos de hoy'],['tomorrow','Mañana'],['later','Más adelante'],['ended','Terminados']].map(([key,title])=>({key,title,items:sorted(buckets[key]),ended:key==='ended'})).filter(row=>row.items.length);
 return {rows,channels:category==='Eventos hoy'?[]:test?channels.filter(test):channels,today:count};
}

// Fase L6: the player switches signal (events) or channel (24 h) without closing. Both wrap around.
export const feedsOf=event=>event?.feeds||[];
const around=(list,start,direction,accept)=>{for(let step=1;step<list.length;step++){const entry=list[((start+direction*step)%list.length+list.length)%list.length];if(accept(entry))return entry;}return null;};
export function nextFeed(event,feedId,direction=1,skip=[]){const feeds=feedsOf(event);return around(feeds,feeds.findIndex(feed=>feed.id===feedId),direction,feed=>feed.id!==feedId&&!skip.includes(feed.id));}
// Same provider category inside the list the user was browsing; events are skipped.
export function siblingChannel(channels,item,direction=1){const start=(channels||[]).findIndex(entry=>entry.id===item.id);return start<0?null:around(channels,start,direction,entry=>entry.kind==='iptv'&&!entry.isEvent&&entry.id!==item.id&&(entry.genre||'')===(item.genre||''));}
