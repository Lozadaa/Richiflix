import {displayText} from './displayText.js';
export function artworkURL(value,backdrop=false){
 if(!value)return value;
 try{const url=new URL(value);if(url.hostname==='image.tmdb.org'&&/^\/t\/p\/[^/]+\/[^/]+\.(?:jpg|png|webp)$/i.test(url.pathname))url.pathname=url.pathname.replace(/^\/t\/p\/[^/]+\//,`/t/p/${backdrop?'original':'w780'}/`);return url.href;}catch{return value;}
}
export function displayTitle(item){
 if(item.eventDisplayTitle)return displayText(item.eventDisplayTitle);
 if(item.localizedTitle)return displayText(item.localizedTitle);
 return displayText(item.title.replace(/\s*\((?:LAT(?:INO)?(?:\s*\/\s*ENG)?|ENG|DUAL|SUB(?:S|TITULADO)?|\d{4})\)\s*$/i,'').replace(/\s*\((?:LAT(?:INO)?(?:\s*\/\s*ENG)?|ENG|DUAL|SUB(?:S|TITULADO)?)\)\s*$/i,'').trim()||item.title);
}
export function titleFacts(item){
 const year=item.year||item.title.match(/\((\d{4})\)\s*$/)?.[1];
 const audio=item.title.match(/\((LAT(?:INO)?(?:\s*\/\s*ENG)?|ENG|DUAL|SUB(?:S|TITULADO)?)\)/i)?.[1];
 return displayText([year,audio,item.duration||(item.durationSeconds?`${Math.round(item.durationSeconds/60)} min`:undefined)].filter(Boolean).join(' · '));
}
