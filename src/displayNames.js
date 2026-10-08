const acronyms=new Set('TV HD MLB NBA NFL UFC ESPN HBO CNN BBC FOX DAZN UEFA FIFA USA UK EEUU DC'.split(' '));
const small=new Set('a al de del el la los las un una unos unas y e o u en con por para sin sobre entre vs'.split(' '));
export function titleCase(text){return text.toLocaleLowerCase('es').replace(/\p{L}[\p{L}\p{N}]*/gu,(word,offset)=>acronyms.has(word.toUpperCase())?word.toUpperCase():offset>0&&small.has(word)?word:word[0].toLocaleUpperCase('es')+word.slice(1));}
export function normalizeSpacing(text){return String(text??'').replace(/_+/g,' ').replace(/[–—-]+/g,' - ').replace(/\bvs\.?\s*/gi,'vs. ').replace(/\s+/g,' ').replace(/\s+([,.;!?])/g,'$1').replace(/^[\s·:;-]+|[\s·:;-]+$/g,'').trim();}
// H2-T1: VOD names. Trailing audio/quality tags («(LAT/ENG/CAST)», «[4K]», «- Latino», «DUAL») leave the title;
// languages keep their original order, upper case (LATINO→LAT, CASTELLANO→CAST, SUBS/SUBTITULADO→SUB); a «(2024)» goes
// to `year`. Hyphens inside the title stay (no normalizeSpacing: «Spider-Man»). Only tags are removed, so it is idempotent.
const VOD_LANGUAGE={LAT:'LAT',LATINO:'LAT',ENG:'ENG',CAST:'CAST',CASTELLANO:'CAST',SUB:'SUB',SUBS:'SUB',SUBTITULADO:'SUB',DUAL:'DUAL',ES:'ES',EN:'EN',VOSE:'VOSE'};
const VOD_QUALITY=/^(?:4K|UHD|FHD|HD|SD|HDR|HEVC|H\.?26[45]|\d{3,4}P)$/i,PICTOGRAPHS=/\p{Extended_Pictographic}[️‍]*/gu;
// A group is removable only if every token is a tag; bare (unbracketed) tokens must be written in capitals.
function vodTags(text,bare=false){
 const out={codes:[],quality:undefined,year:undefined};
 for(const token of text.split(/[\s/,|+]+/).filter(Boolean)){
  const upper=token.toUpperCase();
  if(VOD_LANGUAGE[upper]&&(!bare||token===upper&&!['ES','EN'].includes(upper)))out.codes.push(VOD_LANGUAGE[upper]);
  else if(VOD_QUALITY.test(token)&&(!bare||token===upper||/^\d{3,4}p$/.test(token)))out.quality??=upper;
  else if(!bare&&/^(?:19|20)\d{2}$/.test(token))out.year=token;
  else return null;
 }
 return out;
}
function cleanVod(raw){
 const original=String(raw??'').trim(),groups=[];let title=original.replace(PICTOGRAPHS,' ').trim(),quality,year;
 for(;;){
  const match=title.match(/[\s\-–|·]*[([]([^()[\]]*)[)\]]\s*$/)||title.match(/\s*[-–|·]\s*(Latino|Castellano|Subtitulado|Dual)\s*$/i)||title.match(/[\s\-–|·]+([^\s\-–|·]+)\s*$/);
  const tags=match&&vodTags(match[1],!/[)\]]\s*$/.test(match[0])&&!/^(?:Latino|Castellano|Subtitulado|Dual)$/i.test(match[1]));
  if(!tags)break;
  groups.unshift(tags.codes);quality=tags.quality||quality;year??=tags.year;title=title.slice(0,match.index);
 }
 title=title.replace(/\s+/g,' ').replace(/^[\s\-–|·:]+|[\s\-–|·:]+$/g,'');
 const letters=[...title].filter(char=>/\p{L}/u.test(char)),uppercase=letters.filter(char=>char===char.toLocaleUpperCase('es')).length;
 if(letters.length&&uppercase/letters.length>=.8)title=titleCase(title);
 return {title:title||original,languages:[...new Set(groups.flat())],quality,year};
}
export function cleanName(raw,{kind='title',series}={}){
 if(kind==='vod')return cleanVod(raw);
 let title=String(raw??''),language,quality,country,episodeNumber,season,time;
 // A clock can follow a decorative league prefix; keep only the event after it.
 const clock=title.match(/\b(\d{1,2}):([0-5]\d)\s*([ap]m)?\b/i);
 if(clock&&(kind==='event'||kind==='channel')){let hour=Number(clock[1]);if(clock[3])hour=hour%12+(/pm/i.test(clock[3])?12:0);if(hour<24){time=`${String(hour).padStart(2,'0')}:${clock[2]}`;title=title.slice(clock.index+clock[0].length);}}
 title=title.replace(/^\s*\d{1,2}\/\d{1,2}\s*/,'');
 title=title.replace(/^\s*(?:\|([A-Z]{2})\||([A-Z]{2})\s*[:|])\s*/,(_,a,b)=>{country=a||b;return '';});
 title=title.replace(/\b(?:Spanish|Espa[nñ]ol|English|Ingl[eé]s)\b|\((?:LAT(?:INO)?|ENG|ES|EN)\)|\[(?:LAT|ENG|ES|EN)\]|(?:^|[|·◘]\s*)(?:LAT|ENG|ES|EN)\b/gi,tag=>{language=/english|ingl|ENG|\bEN\b/i.test(tag)?'en':'es';return ' ';});
 title=title.replace(/\b(?:FHD|HD|4K|HEVC|H[ .-]?26[45]|SD)\b/gi,tag=>{quality??=tag.toUpperCase();return ' ';});
 if(kind==='episode'){
  title=title.replace(/\bS(\d+)\s*E(\d+)\b|\b(\d+)x(\d+)\b|(?:^|[-–—:|·]\s*)(?:Ep\.?|Episode|Episodio)\s*(\d+)\b/gi,(_,s,e,x,n,ep)=>{season=s!==undefined?Number(s):x!==undefined?Number(x):season;episodeNumber=Number(e??n??ep);return ' ';});
  if(series){const escaped=series.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');title=title.replace(new RegExp(`^\\s*${escaped}\\s*(?:[-–—:|·]+\\s*|$)`,'i'),'');}
 }
 if(kind==='event'||time)title=title.replace(/(?:^|[◘·|]\s*)(?:MLB|NBA|NFL|UFC|Soccer)(?=\s*(?:[◘·|]|$))/gi,' ');
 title=title.replace(/\p{Extended_Pictographic}[\uFE0F\u200D]*|[\u25a0-\u25ff✪★▶|\u200b-\u200f\ufeff]/gu,' ').replace(/\[\s*\]|\(\s*\)/g,'');
 title=normalizeSpacing(title);
 const letters=[...title].filter(char=>/\p{L}/u.test(char)),uppercase=letters.filter(char=>char===char.toLocaleUpperCase('es')).length;
 if(letters.length&&uppercase/letters.length>=.8)title=titleCase(title);
 return {title,language,quality,country,episodeNumber,season,time};
}
