import {displayText} from './displayText.js';
import {isTVBuild} from './platform.js';
// R4.1: TMDB generates w1280 for every backdrop. On the 1080p TV the banner's
// left two thirds sit under the shade, so w1280 (3.7 MB decoded) replaces
// original (up to 3840×2160, 33 MB). Knob: 'original' restores the old size.
export const TV_BACKDROP_SIZE='w1280';
export function artworkURL(value,backdrop=false,tv=isTVBuild){
 if(!value)return value;
 try{const url=new URL(value);if(url.hostname==='image.tmdb.org'&&/^\/t\/p\/[^/]+\/[^/]+\.(?:jpg|png|webp)$/i.test(url.pathname))url.pathname=url.pathname.replace(/^\/t\/p\/[^/]+\//,`/t/p/${backdrop?tv?TV_BACKDROP_SIZE:'original':'w780'}/`);return url.href;}catch{return value;}
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
