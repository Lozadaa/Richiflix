import {cooperativeForEach} from './cooperativeWork.js';

export const CONTENT_POLICY_VERSION=1;
const enabled=value=>value===true||value===1||typeof value==='string'&&/^(?:1|true|yes)$/i.test(value.trim());
const flags=['is_adult','isAdult','adult','isNsfw','is_nsfw','nsfw','isPornographic','pornographic'];
const allowedLists=new WeakMap();
const normalize=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g,'').toLowerCase();
const explicit=/\b(?:porn(?:o|ographic|ography|ograf\w*)?|xxx+|x\s*x\s*x|erotic\w*|hardcore|softcore|nsfw|hentai|adults?\s*only|solo\s*adultos|para\s*adultos|adult\s*entertainment)\b/;
const adultCategory=/\b(?:adultos?|adults?|sex|sexual|sexo|sexuales|sexy|sexshop)\b|(?:^|\W)(?:18\s*\+|\+\s*18)(?:\W|$)/;
const brands=/\b(?:pornhub|xvideos|xnxx|brazzers|bang\s*bros|reality\s*kings|naughty\s*america|legalporno|sexmex|dorcel|redlight|sextreme|sexy\s*hot|onlyfans|playboy|hustler|penthouse|private\s*(?:tv|spice)|vivid\s*(?:tv|red))\b/;
const pornTitle=/\b(?:pornhub|xvideos|xnxx|brazzers|bang\s*bros|reality\s*kings|naughty\s*america|legalporno|sexmex|dorcel|redlight|sextreme|sexy\s*hot|onlyfans|porn(?:o|ographic|ography|ograf\w*)?|hentai|nsfw)\b/;
function values(value){return Array.isArray(value)?value:typeof value==='object'&&value?Object.values(value):[value];}
export function isPornographicCategory(value){
 if(value&&typeof value==='object'&&flags.some(key=>enabled(value[key])))return true;
 const name=normalize(typeof value==='object'?value?.category_name||value?.name:value);
 return explicit.test(name)||adultCategory.test(name)||brands.test(name);
}
export function isPornographic(item){
 if(!item||typeof item!=='object')return false;
 if(flags.some(key=>enabled(item[key])||enabled(item.info?.[key])))return true;
 const categories=[item.category,item.category_name,item.genre,item.contentGenre,...values(item.categories),...values(item.tmdbGenres),item.info?.genre];
 if(categories.some(value=>value!=null&&isPornographicCategory(value)))return true;
 const title=normalize(item.title||item.name||item.localizedTitle);
 if(pornTitle.test(title))return true;
 // Live erotic channel brands and standalone provider markers are distinct
 // from ordinary films such as xXx or series such as Sex Education.
 const live=item.mediaType==='live'||item.kind==='iptv';
 return live&&(brands.test(title)||explicit.test(title)||/^\s*(?:venus|private)(?:\s+(?:tv|hd|fhd|4k|sd))*\s*$/.test(title));
}
export function withoutPornography(items){
 if(allowedLists.has(items))return allowedLists.get(items);
 const filtered=items.filter(item=>!isPornographic(item)),result=filtered.length===items.length?items:filtered;allowedLists.set(items,result);return result;
}
// Only the shared registry marks catalogues, after cooperative filtering.
// The renderer can reuse their arrays without reclassifying 27k titles.
export function markAllowedCatalogue(data){if(data.contentPolicyVersion===CONTENT_POLICY_VERSION)for(const key of ['movies','shows','channels','preparedChannels'])if(Array.isArray(data[key]))allowedLists.set(data[key],data[key]);}
export async function filterCatalogue(data,options){
 const result={...data,contentPolicyVersion:CONTENT_POLICY_VERSION};let changed=false;
 const blocked=new Set((data.blockedContent||[]).map(item=>`${item.mediaType}:${item.streamId}`));
 for(const type of ['channels','movies','shows']){
  const original=data[type]||[],items=[];
  await cooperativeForEach(original,item=>{if(!blocked.has(`${item.mediaType}:${item.streamId}`)&&!isPornographic(item))items.push(item);},options);
  result[type]=items.length===original.length?original:items;changed||=result[type]!==original;
 }
 if(changed){delete result.preparedChannels;delete result.preparedGroups;}
 return result;
}
