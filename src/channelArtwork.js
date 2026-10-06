// A provider often reuses a catalogue watermark as thousands of unrelated logos.
export function composeChannels(items){
 const uses=new Map();
 for(const item of items){if(!item.image)continue;const names=uses.get(item.image)||new Set();names.add(item.title.replace(/\b(?:SD|HD|FHD|4K|HEVC)\b/gi,'').trim().toLowerCase());uses.set(item.image,names);}
 return items.map(item=>({...item,imageGeneric:(uses.get(item.image)?.size||0)>=8}));
}
