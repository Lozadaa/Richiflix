import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Cache ESPN crests locally (160 px PNG); browsing never depends on ESPN's CDN.
// Five European leagues plus the UEFA club competitions; a club keeps every league it plays in.
const directory=resolve(import.meta.dirname,'../public/artwork/futbol');
const leagues=['eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.europa'];
const teams=new Map();
for(const league of leagues){
 const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams`);
 if(!response.ok)throw Error(`ESPN teams unavailable: ${league}`);
 const list=(await response.json()).sports?.[0]?.leagues?.[0]?.teams||[];
 if(list.length<16)throw Error(`Expected a full league: ${league}`);
 for(const {team} of list){
  if(!/^\d{1,8}$/.test(team.id))throw Error(`Invalid team id: ${team.id}`);
  const known=teams.get(team.id);
  if(known){known.leagues.push(league);continue;}
  teams.set(team.id,{id:team.id,name:team.displayName,shortName:team.shortDisplayName,abbreviation:team.abbreviation,leagues:[league],color:team.color||null,alternateColor:team.alternateColor||null});
 }
}
await mkdir(directory,{recursive:true});
const manifest=[...teams.values()].sort((a,b)=>Number(a.id)-Number(b.id));
const png=[0x89,0x50,0x4e,0x47];
for(let index=0;index<manifest.length;index+=6){
 await Promise.all(manifest.slice(index,index+6).map(async team=>{
  const source=`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${team.id}.png&w=160&h=160`;
  const result=await fetch(source),data=new Uint8Array(await result.arrayBuffer());
  if(!result.ok||!png.every((byte,at)=>data[at]===byte)){team.logo=false;return;}
  await writeFile(resolve(directory,`${team.id}.png`),data);team.logo=true;
 }));
}
await writeFile(resolve(directory,'teams.json'),JSON.stringify(manifest,null,1)+'\n');
console.log(`Saved ${manifest.filter(team=>team.logo).length}/${manifest.length} ESPN football crests locally.`);
