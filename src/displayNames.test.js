import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cleanName,titleCase,normalizeSpacing} from './displayNames.js';
import {normaliseItem} from './xtream.js';
import {displayTitle} from './artwork.js';
const cases=[
 ['◘ MLB ◘ 19:00 Yankees vs Rays ◘ Spanish','event',{title:'Yankees vs. Rays',language:'es',time:'19:00'}],
 ['10/07 Soccer 7:30pm Barcelona vs Real Madrid','event',{title:'Barcelona vs. Real Madrid',time:'19:30'}],
 ['Breaking Bad - S01E03 - Piloto','episode',{title:'Piloto',season:1,episodeNumber:3}],
 ['1x03 Piloto','episode',{title:'Piloto',season:1,episodeNumber:3}],
 ['US: ESPN HD [ENG]','channel',{title:'ESPN',language:'en',quality:'HD',country:'US'}],
 ['LOS SIMPSON (LAT)','title',{title:'Los Simpson',language:'es'}],
 ['Los Simpson','title',{title:'Los Simpson'}],['Yankees vs. Rays','event',{title:'Yankees vs. Rays'}],
 ['Episode 3','episode',{title:'',episodeNumber:3}],['Ep. 3 – Piloto','episode',{title:'Piloto',episodeNumber:3}],
 ['Breaking Bad - Piloto','episode',{title:'Piloto'}],['ES| HBO FHD H265','channel',{title:'HBO',country:'ES',quality:'FHD'}],
 ['|MX| ✪ TV_UNO ★ ▶ 📺 [ES]','channel',{title:'TV Uno',country:'MX',language:'es'}],
 ['MLB Network','channel',{title:'MLB Network'}],['ESPN','channel',{title:'ESPN'}],
 ['Yankees  vs.Rays','event',{title:'Yankees vs. Rays'}],
 ['Fixture Episode 1','episode',{title:'Fixture Episode 1'}],
];
for(const [raw,kind,expected] of cases)test(`cleanName ${raw}`,()=>{const out=cleanName(raw,{kind,series:'Breaking Bad'});for(const key of Object.keys(expected))assert.equal(out[key],expected[key]);});
test('spacing and Spanish title case preserve acronyms',()=>{assert.equal(normalizeSpacing(' Uno__-- Dos '),'Uno - Dos');assert.equal(titleCase('LA CASA DE HBO Y TV MLB ESPN'),'La Casa de HBO y TV MLB ESPN');});
test('sample titles are clean and idempotent',async()=>{const sample=JSON.parse(await readFile('artifacts/nombres-muestra.json','utf8'));for(const raw of sample.names){const kind=/S\d+E\d+|\d+x\d+|\b(?:Ep\.?|Episode|Episodio)\s*\d+/i.test(raw)?'episode':'channel',first=cleanName(raw,{kind}).title;assert.equal(cleanName(first,{kind}).title,first,raw);assert.doesNotMatch(first,/[◘✪★▶|_]|S\d\dE\d\d|^\d{1,2}:\d{2}/i);}});
// H2-T1: VOD names (no real cache in artifacts/: the plan's names plus the fixture's VOD titles).
const vod=[
 ['Michael (LAT/ENG/CAST)',{title:'Michael',languages:['LAT','ENG','CAST']}],
 ['Dune: Parte Dos [4K] LAT',{title:'Dune: Parte Dos',languages:['LAT'],quality:'4K'}],
 ['Shrek - Latino',{title:'Shrek',languages:['LAT']}],
 ['(LAT/ENG)',{title:'(LAT/ENG)',languages:['LAT','ENG']}],
 ['A Movie (LAT/ENG) (2025)',{title:'A Movie',languages:['LAT','ENG'],year:'2025'}],
 ['\u{1F3AC} Película (LAT/ENG) (2026)',{title:'Película',languages:['LAT','ENG'],year:'2026'}],
 ['LOS SIMPSON (LAT)',{title:'Los Simpson',languages:['LAT']}],
 ['Película (1997)',{title:'Película',languages:[],year:'1997'}],
 ['Spider-Man: No Way Home DUAL 1080p',{title:'Spider-Man: No Way Home',languages:['DUAL'],quality:'1080P'}],
 ['The Batman - Subtitulado [HD]',{title:'The Batman',languages:['SUB'],quality:'HD'}],
 ['Avatar | LAT',{title:'Avatar',languages:['LAT']}],
 ['Blade Runner 2049',{title:'Blade Runner 2049',languages:[]}],
 ["Rocky (Director's Cut)",{title:"Rocky (Director's Cut)",languages:[]}],
 ['Ella es',{title:'Ella es',languages:[]}],
];
for(const [raw,expected] of vod)test(`cleanName vod ${raw}`,()=>{
 const out=cleanName(raw,{kind:'vod'});
 for(const key of Object.keys(expected))assert.deepEqual(out[key],expected[key]);
 assert.equal(cleanName(out.title,{kind:'vod'}).title,out.title,'idempotent');
});
test('normaliseItem gives films and series a clean displayTitle, the raw originalTitle and languages',()=>{
 const account={host:'http://example.test',username:'u',password:'p',name:'Fuente'};
 const movie=normaliseItem({stream_id:7,name:'Michael (LAT/ENG/CAST) (2026)'},'movie',new Map(),account);
 assert.equal(movie.title,'Michael (LAT/ENG/CAST) (2026)');assert.equal(movie.displayTitle,'Michael');assert.equal(movie.originalTitle,movie.title);
 assert.deepEqual(movie.languages,['LAT','ENG','CAST']);assert.equal(movie.year,'2026');assert.equal(displayTitle(movie),'Michael');
 assert.equal(normaliseItem({series_id:8,name:'Shrek - Latino',year:'2001'},'series',new Map(),account).displayTitle,'Shrek');
 const channel=normaliseItem({stream_id:9,name:'ESPN (LAT)'},'live',new Map(),account);
 assert.equal(channel.displayTitle,undefined);assert.equal(channel.languages,undefined);
});
