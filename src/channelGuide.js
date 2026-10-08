import {isPornographic} from './contentPolicy.js';
import {eventInstant,eventTimeShort} from './eventTime.js';

// Fase L4: «Ahora · programa» / «Después · programa» for the 24 h channels the user is looking at.
// Times come only from start_timestamp/stop_timestamp (UTC); a bare provider clock is never guessed.
const control=/[\u0000-\u001f\u007f-\u009f]/g;
function decode(value){
 if(typeof value!=='string'||!value.trim())return '';const raw=value.trim();let decoded='';
 // Some panels send plain text: a title that is not strict base64 + valid UTF-8 is kept as sent.
 if(/^[A-Za-z0-9+/]+={0,2}$/.test(raw)&&raw.length%4===0)try{const binary=atob(raw);decoded=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(binary,char=>char.charCodeAt(0)));if(/[\u0000-\u0008\u000e-\u001f�]/.test(decoded))decoded='';}catch{decoded='';}
 return (decoded||raw).replace(control,' ').replace(/\s+/g,' ').trim().slice(0,160);
}
export function parseShortEpg(payload,now=Date.now()){
 const listings=(Array.isArray(payload?.epg_listings)?payload.epg_listings:[]).map(entry=>{const start=eventInstant(entry?.start_timestamp),end=eventInstant(entry?.stop_timestamp),timed=start!==null&&end!==null&&end>start;return {title:decode(entry?.title),start:timed?start:null,end:timed?end:null,playing:Number(entry?.now_playing)===1};}).filter(entry=>entry.title);
 if(!listings.length||listings.some(entry=>isPornographic({title:entry.title,mediaType:'live'})))return null;
 const timed=listings.filter(entry=>entry.start!==null).sort((a,b)=>a.start-b.start);let current,next;
 if(timed.length){current=timed.find(entry=>entry.start<=now&&now<entry.end);next=current?timed.find(entry=>entry.start>=current.end):null;}
 else{current=listings.find(entry=>entry.playing)||listings[0];next=listings[listings.indexOf(current)+1]||null;}
 if(!current)return null;
 return {now:{title:current.title,start:current.start,end:current.end,progress:guideProgress(current,now)},next:next?{title:next.title,start:next.start}:null};
}
export function guideProgress(entry,now=Date.now()){return entry?.start!=null&&entry.end>entry.start?Math.min(1,Math.max(0,(now-entry.start)/(entry.end-entry.start))):null;}
// What to paint now: a finished programme hands over to the next one (without a bar) or to nothing.
export function currentGuide(guide,now=Date.now()){
 if(!guide?.now)return null;if(guide.now.end==null||now<guide.now.end)return guide;
 return guide.next?.start!=null&&guide.next.start<=now?{now:{title:guide.next.title,start:guide.next.start,end:null,progress:null},next:null}:null;
}
export const guideNowLine=(guide,now=Date.now())=>{const value=currentGuide(guide,now);return value?`Ahora · ${value.now.title}`:'';};
export const guideNextLine=(guide,now=Date.now())=>{const value=currentGuide(guide,now)?.next;if(!value)return '';const time=value.start!=null?eventTimeShort({eventStartsAt:value.start}):'';return ['Después',value.title,time].filter(Boolean).join(' · ');};

// Bounded queue + memory cache (never IndexedDB). want() is the plan for the visible window, in priority
// order: what left it is dropped from the queue, what is fresh is not asked again. Running loads finish
// (an IPC/worker reply cannot be aborted cheaply) and are cached. pause() starts nothing new.
export function createGuideQueue({load,concurrency=2,ttlMs=600000,maxEntries=60,now=Date.now}){
 const entries=new Map(),running=new Set(),listeners=new Set();let queue=[],paused=false,started=0;
 const fresh=entry=>entry&&now()-entry.at<ttlMs&&!(entry.value?.now?.end!=null&&entry.value.now.end<=now());
 const store=(id,value)=>{entries.delete(id);entries.set(id,{at:now(),value});while(entries.size>maxEntries)entries.delete(entries.keys().next().value);for(const listener of listeners)listener(id);};
 function pump(){while(!paused&&running.size<concurrency&&queue.length){
  const item=queue.shift();running.add(item.id);started++;
  Promise.resolve().then(()=>load(item)).then(value=>store(item.id,value||null),()=>store(item.id,null)).finally(()=>{running.delete(item.id);pump();});
 }}
 return {
  want(items){const seen=new Set();queue=items.filter(item=>{if(!item?.id||seen.has(item.id))return false;seen.add(item.id);return !running.has(item.id)&&!fresh(entries.get(item.id));});pump();return queue.length;},
  pause(){paused=true;},
  resume(){paused=false;pump();},
  get(id){const entry=entries.get(id);return fresh(entry)?entry.value:undefined;},
  snapshot(){const result={};for(const [id,entry] of entries)if(entry.value&&fresh(entry))result[id]=entry.value;return result;},
  subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  stats:()=>({running:running.size,queued:queue.length,entries:entries.size,paused,started}),
 };
}
