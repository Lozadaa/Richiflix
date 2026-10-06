export function safeStream(url){try{return ['https:','http:'].includes(new URL(url).protocol);}catch{return false;}}
export function streamId(url){let hash=2166136261;for(const char of url){hash=Math.imul(hash^char.charCodeAt(0),16777619);}return `iptv-${(hash>>>0).toString(36)}-${url.length}`;}
export function parseM3U(text){
 if(!text.trimStart().startsWith('#EXTM3U'))throw new Error('El archivo debe ser una lista M3U válida.');
 const entries=[],seen=new Set();let info=null;
 for(const line of text.split(/\r?\n/).map(l=>l.trim())){
  if(line.startsWith('#EXTINF:')){
   const attr=name=>line.match(new RegExp(`${name}="([^"]*)"`))?.[1]||'';
   const title=line.match(/,(?![^\"]*\")(.+)$/)?.[1];
   info={title:title?.trim()||'Canal sin nombre',genre:attr('group-title')||'IPTV',image:safeStream(attr('tvg-logo'))?attr('tvg-logo'):undefined,channelId:attr('tvg-id')};
  }else if(line && !line.startsWith('#')&&info){if(safeStream(line)&&!seen.has(line)){seen.add(line);entries.push({...info,id:streamId(line),url:line,kind:'iptv',description:'Emisión en vivo · clasificación por edad desconocida'});}info=null;}
 }
 return entries;
}
