import {mkdir,readdir,unlink,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Cache ESPN crests and flags locally (128 px PNG); browsing never depends on ESPN's CDN.
// Clubs keep every competition they play in; national teams also play friendlies (`fifa.friendly`).
const directory=resolve(import.meta.dirname,'../public/artwork/futbol');
const clubs=['eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.europa','conmebol.libertadores','conmebol.sudamericana','chi.1','arg.1','bra.1','mex.1','col.1','per.1','ecu.1','usa.1'];
const nations=['fifa.world','fifa.worldq.conmebol','uefa.nations','concacaf.nations.league'];
const teams=new Map();
for(const league of [...clubs,...nations]){
 const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams`);
 if(!response.ok)throw Error(`ESPN teams unavailable: ${league}`);
 const list=(await response.json()).sports?.[0]?.leagues?.[0]?.teams||[];
 if(list.length<10)throw Error(`Expected a full competition: ${league}`);
 const national=nations.includes(league);
 for(const {team} of list){
  if(!/^\d{1,8}$/.test(team.id))throw Error(`Invalid team id: ${team.id}`);
  const known=teams.get(team.id);
  if(known){if(!known.leagues.includes(league))known.leagues.push(league);continue;}
  const art=(team.logos||[]).find(logo=>logo.rel?.includes('default'))?.href||team.logos?.[0]?.href||'';
  teams.set(team.id,{id:team.id,name:team.displayName,shortName:team.shortDisplayName,abbreviation:team.abbreviation,national,leagues:national?[league,'fifa.friendly']:[league],color:team.color||null,alternateColor:team.alternateColor||null,art:new URL(art||'https://a.espncdn.com/').pathname});
 }
}
await mkdir(directory,{recursive:true});
for(const file of await readdir(directory))if(file.endsWith('.png'))await unlink(resolve(directory,file));
const manifest=[...teams.values()].sort((a,b)=>Number(a.id)-Number(b.id));
const png=[0x89,0x50,0x4e,0x47];
for(let index=0;index<manifest.length;index+=8){
 await Promise.all(manifest.slice(index,index+8).map(async team=>{
  const {art,...entry}=team;Object.keys(team).forEach(key=>delete team[key]);Object.assign(team,entry);
  if(!/^\/i\/teamlogos\/[a-z]+\/500\/[\w-]+\.png$/.test(art)){team.logo=false;return;}
  const result=await fetch(`https://a.espncdn.com/combiner/i?img=${art}&w=128&h=128`),data=new Uint8Array(await result.arrayBuffer());
  if(!result.ok||!png.every((byte,at)=>data[at]===byte)){team.logo=false;return;}
  await writeFile(resolve(directory,`${team.id}.png`),data);team.logo=true;
 }));
}
await writeFile(resolve(directory,'teams.json'),JSON.stringify(manifest)+'\n');
console.log(`Saved ${manifest.filter(team=>team.logo).length}/${manifest.length} ESPN football crests and flags locally.`);
