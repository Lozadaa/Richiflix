import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Cache official vector marks locally; browsing never depends on MLB's CDN.
const directory=resolve(import.meta.dirname,'../public/artwork/mlb');
const response=await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1');
if(!response.ok)throw Error('MLB teams unavailable');
const {teams}=await response.json();
if(teams.length!==30)throw Error('Expected all 30 MLB teams');
await mkdir(directory,{recursive:true});
const manifest=[];
for(let index=0;index<teams.length;index+=5){
 const results=await Promise.all(teams.slice(index,index+5).map(async team=>{
  const source=`https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg`;
  const result=await fetch(source),svg=(await result.text()).replace(/^<\?xml[^>]*>\s*/,'').trim();
  if(!result.ok||!svg.startsWith('<svg')||/<script|<foreignObject|\bon\w+=|(?:href|src)=["'](?:https?:|\/\/|data:)/i.test(svg))throw Error(`Invalid logo: ${team.id}`);
  await writeFile(resolve(directory,`${team.id}.svg`),svg);
  return {id:team.id,name:team.name,teamName:team.teamName,abbreviation:team.abbreviation,source};
 }));manifest.push(...results);
}
manifest.sort((a,b)=>a.id-b.id);
await writeFile(resolve(directory,'teams.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Saved ${manifest.length} official MLB SVG logos locally.`);
