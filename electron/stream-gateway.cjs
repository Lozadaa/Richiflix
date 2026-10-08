const {randomUUID}=require('node:crypto');

// One active HLS session. URLs exist only in memory and expire on source change.
exports.createStreamGateway=fetcher=>{
 let active;
 const start=url=>{
  const token=randomUUID(),resources=new Map(),ids=new Map();
  active={token,resources,ids};return register(url);
 };
 const register=url=>{
  const target=new URL(url);if(!['http:','https:'].includes(target.protocol))throw Error('Recurso no permitido.');
  if(active.ids.has(target.href))return active.ids.get(target.href);
  if(active.resources.size>=20000)throw Error('Demasiados recursos en la emisión.');
  const suffix=/\.m3u8$/i.test(target.pathname)?'.m3u8':'.bin';
  const local=`richiflix://${active.token}/${active.resources.size}${suffix}`;
  active.resources.set(new URL(local).pathname,target.href);active.ids.set(target.href,local);return local;
 };
 const handles=request=>new URL(request.url).hostname===active?.token;
 const handle=async request=>{
  const session=active,address=new URL(request.url),target=session?.resources.get(address.pathname);
  if(!target||address.hostname!==session.token)return new Response('Emisión cerrada',{status:404});
  try{
   const headers={};const range=request.headers.get('range');if(range)headers.Range=range;
   // Electron's net.fetch Response.url may omit the final redirect URL.
   // Track redirects explicitly so relative segments use the actual manifest.
   let finalURL=target,response;
   for(let redirects=0;redirects<=8;redirects++){
    response=await fetcher(finalURL,{headers,signal:request.signal,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status))break;
    const location=response.headers.get('location');await response.body?.cancel();
    if(!location||redirects===8)throw Error('Redirección inválida');
    const next=new URL(location,finalURL);if(!['http:','https:'].includes(next.protocol))throw Error('Redirección inválida');finalURL=next.href;
   }
   const type=response.headers.get('content-type')||'';
   const outgoing={'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'};
   if(!response.ok){await response.body?.cancel();return new Response('Señal no disponible',{status:response.status,headers:outgoing});}
   if(/mpegurl/i.test(type)||/\.m3u8$/i.test(new URL(finalURL).pathname)){
    const reader=response.body.getReader(),chunks=[];let bytes=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>4*1024*1024)throw Error('Manifest demasiado grande');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
    if(session!==active)return new Response('Emisión cerrada',{status:410});
    const rewrite=value=>register(new URL(value,finalURL).href);
    const playlist=Buffer.concat(chunks).toString('utf8').split(/\r?\n/).map(line=>{
     if(!line.trim())return line;
     if(line.startsWith('#'))return line.replace(/URI="([^"]+)"/g,(_,uri)=>`URI="${rewrite(uri)}"`);
     return rewrite(line.trim());
    }).join('\n');
    return new Response(playlist,{headers:{...outgoing,'Content-Type':'application/vnd.apple.mpegurl'}});
   }
   for(const key of ['content-type','content-length','content-range','accept-ranges'])if(response.headers.has(key))outgoing[key]=response.headers.get(key);
   return new Response(response.body,{status:response.status,headers:outgoing});
  }catch{return new Response('No se pudo leer la señal',{status:502,headers:{'Access-Control-Allow-Origin':'*'}});}
 };
 return {start,handles,handle,clear:()=>{active=null;}};
};
