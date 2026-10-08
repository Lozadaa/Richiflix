import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cleanName,titleCase,normalizeSpacing} from './displayNames.js';
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
