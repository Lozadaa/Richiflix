import {isPornographic,withoutPornography} from './contentPolicy.js';
// No bundled films or age evidence: new sources need title-specific verification.
export const ageEvidence=[];
export function ratingFor(item,evidence=ageEvidence){return evidence.find(record=>record.id===item.id&&record.url===item.url&&record.source?.startsWith('https://')&&record.checkedAt&&Number.isInteger(record.minAge)&&record.minAge>=0);}
export function canShowForKids(item,evidence=ageEvidence){const rating=ratingFor(item,evidence);return ['demo','vod','local'].includes(item.kind)&&!isPornographic(item)&&Boolean(rating&&rating.minAge<=10);}
export function forProfile(items,profile){const allowed=withoutPornography(items);return profile.kind==='kids'?allowed.filter(item=>canShowForKids(item)):allowed;}
export function mergeContent(...lists){const seen=new Set();return lists.flat().filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;});}
