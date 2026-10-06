// No bundled films or age evidence: new sources need title-specific verification.
export const ageEvidence=[];
export function ratingFor(item,evidence=ageEvidence){return evidence.find(record=>record.id===item.id&&record.url===item.url&&record.source?.startsWith('https://')&&record.checkedAt&&Number.isInteger(record.minAge)&&record.minAge>=0);}
export function canShowForKids(item,evidence=ageEvidence){const rating=ratingFor(item,evidence);return ['demo','vod','local'].includes(item.kind)&&!item.isNsfw&&Boolean(rating&&rating.minAge<=10);}
export function forProfile(items,profile){return profile.kind==='kids'?items.filter(item=>canShowForKids(item)):items;}
export function mergeContent(...lists){const seen=new Set();return lists.flat().filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true;});}
