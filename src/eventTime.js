import {displayText} from './displayText.js';
const formatters=new Map(),zones=new Map();
// Santiago is the display zone. Provider clocks can originate in other regions.
export const EVENTS_TIME_ZONE='America/Santiago';
export function validTimeZone(zone){
 if(typeof zone!=='string'||!zone||zone.length>100)return false;
 if(zones.has(zone))return zones.get(zone);let valid=false;try{new Intl.DateTimeFormat('en',{timeZone:zone}).format();valid=true;}catch{}
 if(zones.size>=64)zones.delete(zones.keys().next().value);zones.set(zone,valid);return valid;
}
function parts(time,zone){
 if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
 return Object.fromEntries(formatters.get(zone).formatToParts(new Date(time)).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
}
function stamp(value){return Date.UTC(value.year,value.month-1,value.day,value.hour||0,value.minute||0);}
export function zonedEventTime(date,hour,minute,zone){
 if(!validTimeZone(zone)||hour<0||hour>23||minute<0||minute>59)return null;
 const expected={...date,hour,minute},target=stamp(expected);let guess=target;
 for(let index=0;index<4;index++)guess+=target-stamp(parts(guess,zone));
 if(stamp(parts(guess,zone))!==target)return null;
 // A repeated DST wall-clock time is ambiguous without a supplied offset.
 for(const offset of [-3600000,-1800000,1800000,3600000])if(stamp(parts(guess+offset,zone))===target)return null;
 return guess;
}
export function eventInstant(value){
 if(typeof value==='number'||/^\d{10}(?:\d{3})?$/.test(String(value||''))){const number=Number(value),time=number<1e12?number*1000:number;return Number.isFinite(time)&&time>=Date.UTC(2000,0,1)&&time<Date.UTC(2100,0,1)?time:null;}
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)){
  const [year,month,day]=value.slice(0,10).split('-').map(Number),calendar=new Date(Date.UTC(year,month-1,day));
  if(calendar.getUTCFullYear()!==year||calendar.getUTCMonth()+1!==month||calendar.getUTCDate()!==day)return null;
  const time=Date.parse(value);return Number.isFinite(time)?time:null;
 }
 return null;
}
export function providerEventZone(item,host){
 let known=false;try{known=new URL(host).hostname.toLowerCase()==='ebxvip.xyz';}catch{}
 if(!known)return null;
 const title=displayText(item.title);
 // The HH:mm event feed agrees with MLB, NBA, NFL and UEFA schedules.
 // Its decorated event format differs from the separate MM/DD Soccer feed.
 if(/^\s*\d{1,2}:\d{2}\b/.test(title)&&(/\bmlb\b|baseball|b[eé]isbol/i.test(`${title} ${item.genre||''}`)||/^\s*\d{1,2}:\d{2}\s*[\u25a0-\u25ff·]/.test(title)))return 'America/Chicago';
 if(/^\s*\d{1,2}\/\d{1,2}\s+Soccer\s+\d{1,2}:\d{2}\s*[ap]m\b/i.test(title))return 'America/New_York';
 return null;
}
export function scheduledEventTime(item,{updatedAt,timeZone,host}={}){
 if(item.kind!=='iptv')return null;
 const explicit=eventInstant(item.eventStartsAt);if(explicit!==null)return explicit;
 const title=displayText(item.title),us=title.match(/^\s*(\d{1,2})\/(\d{1,2})\s+Soccer\s+(\d{1,2}):(\d{2})\s*([ap]m)\b/i),clock=title.match(/^\s*(\d{1,2}):(\d{2})\b/);
 const zone=providerEventZone(item,host)||timeZone;
 if((!clock&&!us)||!validTimeZone(zone))return null;
 const dated=title.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/),daily=/event|evento|ppv|\bmlb\b|\bvs\.?\s/i.test(`${title} ${item.genre||''}`);
 const anchor=Date.parse(updatedAt);if(!dated&&(!daily||!Number.isFinite(anchor)))return null;
 let date=dated?{year:Number(dated[1]),month:Number(dated[2]),day:Number(dated[3])}:Number.isFinite(anchor)?parts(anchor,zone):null;
 let hour=Number(us?us[3]:clock[1]),minute=Number(us?us[4]:clock[2]);
 if(us){
  if(!date||hour<1||hour>12)return null;
  hour=hour%12+(us[5].toLowerCase()==='pm'?12:0);
  // Month/day belongs to the provider's calendar, including a New Year rollover.
  date=[date.year-1,date.year,date.year+1].map(year=>({year,month:Number(us[1]),day:Number(us[2])})).sort((a,b)=>Math.abs(stamp(a)-anchor)-Math.abs(stamp(b)-anchor))[0];
 }
 if(!date)return null;
 const check=new Date(stamp(date));if(check.getUTCFullYear()!==date.year||check.getUTCMonth()+1!==date.month||check.getUTCDate()!==date.day)return null;
 return zonedEventTime(date,hour,minute,zone);
}
export function eventDisplayTitle(item){
 if(item.displayTitle!==undefined)return item.displayTitle;
 const title=displayText(item.title);
 if(eventInstant(item.eventStartsAt)===null)return title;
 return title.replace(/^\s*\d{1,2}\/\d{1,2}\s+Soccer\s+\d{1,2}:\d{2}\s*[ap]m\s*/i,'').replace(/^\s*\d{1,2}:\d{2}\s*[·|:-]?\s*/,'').trim();
}
export function eventStartLabel(item){
 const time=eventInstant(item?.eventStartsAt);if(time===null)return '';
 const value=parts(time,EVENTS_TIME_ZONE),pad=number=>String(number).padStart(2,'0');
 return `${pad(value.day)}/${pad(value.month)} · ${pad(value.hour)}:${pad(value.minute)} · Santiago`;
}
export function eventCountdown(item,now=Date.now()){
 const startsAt=eventInstant(item.eventStartsAt);if(startsAt===null)return null;
 const remaining=startsAt-now;if(remaining<=0)return {state:'scheduled',label:'Hora de inicio alcanzada',startsAt};
 const seconds=Math.ceil(remaining/1000),minutes=Math.ceil(seconds/60),days=Math.floor(minutes/1440),hours=Math.floor(minutes%1440/60),rest=minutes%60;
 const units=seconds<60?`${seconds} s`:[days?`${days} d`:'',hours?`${hours} h`:'',rest?`${rest} min`:''].filter(Boolean).join(' ');
 return {state:'upcoming',label:`Empieza en ${units}`,startsAt};
}
const pad=number=>String(number).padStart(2,'0');
export function eventTimeShort(item){const time=eventInstant(item?.eventStartsAt);if(time===null)return '';const value=parts(time,EVENTS_TIME_ZONE);return `${pad(value.hour)}:${pad(value.minute)}`;}
// Santiago calendar day as a day number (and weekday), for «Hoy», «Mañana» and grouping.
export function eventDay(time){const value=parts(time,EVENTS_TIME_ZONE),day=Date.UTC(value.year,value.month-1,value.day)/864e5;return {day,weekday:new Date(day*864e5).getUTCDay(),key:`${value.year}-${pad(value.month)}-${pad(value.day)}`};}
