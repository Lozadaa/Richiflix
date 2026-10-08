import {catalogueCategories} from './catalogueCategories.js';
import {cooperativeForEach,cooperativeMap} from './cooperativeWork.js';
import {scheduledEventTime,eventDisplayTitle} from './eventTime.js';

// Shared with the catalogue worker. Date parsing and generic-logo detection
// are performed once, before the prepared catalogue reaches the UI.
export async function prepareChannels(data,options){
 const sources=new Map((data.sources||data.connection?.sources||[]).map(source=>[source.id,source]));
 const uses=new Map();await cooperativeForEach(data.channels,item=>{if(!item.image)return;const names=uses.get(item.image)||new Set();names.add(item.title.replace(/\b(?:SD|HD|FHD|4K|HEVC)\b/gi,'').trim().toLowerCase());uses.set(item.image,names);},options);
 return cooperativeMap(data.channels,item=>{const timed={...item,imageGeneric:(uses.get(item.image)?.size||0)>=8,eventStartsAt:scheduledEventTime(item,{updatedAt:item.catalogueUpdatedAt||data.updatedAt,host:sources.get(item.sourceId)?.host})};return {...timed,eventDisplayTitle:eventDisplayTitle(timed)};},options);
}

export async function prepareCatalogueGroups(data,preparedChannels,options){
 const result={};
 for(const name of ['movies','shows','channels']){
  const positions=new Map(),items=name==='channels'?preparedChannels:data[name];
  await cooperativeForEach(items,(item,index)=>{for(const category of catalogueCategories(item)){if(typeof category!=='string')continue;if(!positions.has(category))positions.set(category,[]);positions.get(category).push(index);}},options);
  const categoryPositions=Object.create(null);for(const [category,indices] of positions)categoryPositions[category]=indices;
  result[name]={categories:[...positions.keys()].sort((a,b)=>a.localeCompare(b,'es')),categoryPositions};
 }
 return result;
}
