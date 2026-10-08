import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const port=Number(process.env.RICHIFLIX_TRAILER_PORT||59338);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Puerto de tráilers no válido.');
const file=resolve(import.meta.dirname,'../trailer-bridge/dist/index.html');
const server=createServer(async(request,response)=>{
 if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{Allow:'GET, HEAD'});response.end();return;}
 const path=new URL(request.url,'http://localhost').pathname;
 if(!['/','/index.html'].includes(path)){response.writeHead(404);response.end();return;}
 try{
  const html=await readFile(file),etag='"'+createHash('sha256').update(html).digest('hex')+'"';
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','ETag':etag,'Referrer-Policy':'strict-origin-when-cross-origin','X-Content-Type-Options':'nosniff'};
  if(request.headers['if-none-match']===etag){response.writeHead(304,headers);response.end();return;}
  response.writeHead(200,headers);response.end(request.method==='HEAD'?undefined:html);
 }catch{response.writeHead(503);response.end('Reproductor no disponible.');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Reproductor Richiflix disponible en la red local, puerto ${port}. Ctrl+C para cerrar.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close());
