import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fixtureResponse} from './xtream-fixture.mjs';
const channels=new Set(),episodes=new Set(),other=new Set();let source='local-fixtures';
const safe=value=>typeof value==='string'&&!/https?:\/\/|xtream:\/\/|username=|password=/i.test(value);
function collect(value,kind='title'){
 if(Array.isArray(value)){for(const entry of value)collect(entry,kind);return;}
 if(!value||typeof value!=='object')return;
 const type=value.mediaType==='episode'||value.episode_num!==undefined?'episode':value.mediaType==='live'||value.kind==='iptv'||value.stream_id!==undefined?'channel':kind;
 for(const key of ['title','name'])if(safe(value[key]))(type==='episode'?episodes:type==='channel'?channels:other).add(value[key]);
 for(const [key,entry] of Object.entries(value))if(entry&&typeof entry==='object')collect(entry,key==='episodes'?'episode':key==='channels'?'channel':type);
}
const directory=process.env.APPDATA&&path.join(process.env.APPDATA,'richiflix');
const files=directory?await readdir(directory).catch(()=>[]):[];
for(const file of files.filter(name=>/^xtream-catalogue(?:-.*)?\.json$/.test(name))){try{collect(JSON.parse(await readFile(path.join(directory,file),'utf8')));source='electron-cache';}catch{}}
if(source==='local-fixtures'){
 for(const action of ['get_live_streams','get_series_info'])collect(fixtureResponse(`https://fixture.invalid/?action=${action}`));
 collect(JSON.parse(await readFile('docs/playlist-checks.json','utf8')));
 for(const file of (await readdir('src')).filter(name=>name.endsWith('.test.js'))){const content=await readFile(path.join('src',file),'utf8');for(const match of content.matchAll(/\b(?:title|name)\s*:\s*(['"])([^\r\n]*?)\1/g))if(safe(match[2]))other.add(match[2]);}
 // The F1 table contains raw names as tuples rather than object fields.
 const tests=await readFile('src/displayNames.test.js','utf8');for(const match of tests.matchAll(/\[\s*'([^']*)'\s*,\s*'(channel|event|episode|title)'/g))if(safe(match[1]))(match[2]==='episode'?episodes:['channel','event'].includes(match[2])?channels:other).add(match[1]);
}
const names=[...new Set([...channels,...episodes,...other])].sort();
const rules={decoration:/[◘✪★▶|_]|\p{Extended_Pictographic}/u,clock:/\d{1,2}:\d{2}/,episode:/S\d+E\d+|\d+x\d+|\b(?:Ep\.?|Episode|Episodio)\s*\d+/i,quality:/\b(?:HD|FHD|4K|HEVC|H265|SD)\b/i,language:/\b(?:LAT|ENG|Spanish|English)\b/i,country:/^(?:[A-Z]{2}[:|]|\|[A-Z]{2}\|)/};
const counts={channelsEvents:channels.size,episodes:episodes.size,other:other.size,total:names.length};
const patterns=Object.fromEntries(Object.entries(rules).map(([key,regex])=>[key,names.filter(name=>regex.test(name)).length]));
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/nombres-muestra.json',JSON.stringify({source,counts,targets:{channelsEvents:2000,episodes:500},patterns,names},null,2)+'\n');
console.log(JSON.stringify({source,counts,patterns}));
