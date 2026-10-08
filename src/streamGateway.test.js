import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createStreamGateway}=createRequire(import.meta.url)('../electron/stream-gateway.cjs');
test('redirected HLS uses the final manifest location even when Electron omits Response.url',async()=>{
 const calls=[],gateway=createStreamGateway(async(url,options)=>{
  calls.push(url);assert.equal(options.redirect,'manual');
  if(url==='https://fixture.test/login.m3u8')return new Response(null,{status:302,headers:{location:'https://cdn.fixture.test/events/master.m3u8'}});
  if(url.endsWith('master.m3u8'))return new Response('#EXTM3U\n#EXTINF:2,\nsegment.ts\n',{headers:{'content-type':'application/vnd.apple.mpegurl'}});
  return new Response(new Uint8Array([1,2]));
 });
 const manifest=await (await gateway.handle(new Request(gateway.start('https://fixture.test/login.m3u8')))).text();
 const segment=manifest.split('\n').find(line=>line.startsWith('richiflix://'));assert.equal((await gateway.handle(new Request(segment))).status,200);
 assert.equal(calls.at(-1),'https://cdn.fixture.test/events/segment.ts');
});
test('redirect loops and executable redirect targets fail safely',async()=>{
 for(const location of ['/loop.m3u8','file:///private']){
  let count=0;const gateway=createStreamGateway(async()=>{count++;return new Response(null,{status:302,headers:{location}});});
  assert.equal((await gateway.handle(new Request(gateway.start('https://fixture.test/loop.m3u8')))).status,502);assert.ok(count<=9);
 }
});
test('HLS gateway rewrites variants, relative segments and keys without exposing credentials',async()=>{
 const calls=[],gateway=createStreamGateway(async(url,options)=>{
  calls.push({url,options});
  if(url.endsWith('/master.m3u8'))return new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=9000\nvariant.m3u8',{headers:{'content-type':'application/vnd.apple.mpegurl'}});
  if(url.endsWith('/variant.m3u8'))return new Response('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:5,\nsegment.ts\n',{headers:{'content-type':'application/vnd.apple.mpegurl'}});
  return new Response(new Uint8Array([1,2,3]),{status:206,headers:{'content-type':'video/mp2t','content-range':'bytes 0-2/3'}});
 });
 const first=gateway.start('http://fixture.test/live/private-user/private-password/master.m3u8');
 const master=await gateway.handle(new Request(first));assert.equal(master.headers.get('access-control-allow-origin'),'*');
 const text=await master.text();assert.ok(!text.includes('private'));const variant=text.split('\n').at(-1);assert.ok(variant.startsWith('richiflix://'));
 const nested=await (await gateway.handle(new Request(variant))).text();assert.ok(!nested.includes('private'));assert.ok(nested.includes('URI="richiflix://'));
 const segment=nested.split('\n').find(line=>line.startsWith('richiflix://'));
 const response=await gateway.handle(new Request(segment,{headers:{Range:'bytes=0-2'}}));assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[1,2,3]);assert.equal(response.status,206);assert.equal(calls.at(-1).options.headers.Range,'bytes=0-2');
});
test('gateway rejects arbitrary resources and invalidates the previous playback session',async()=>{
 let requests=0;const gateway=createStreamGateway(async()=>{requests++;return new Response('test');});
 const old=gateway.start('http://fixture.test/live.m3u8');assert.equal(gateway.handles(new Request(old)),true);
 assert.equal((await gateway.handle(new Request(old.replace('/0.m3u8','/unknown')))).status,404);assert.equal(requests,0);
 const next=gateway.start('http://fixture.test/next.m3u8');assert.equal(gateway.handles(new Request(old)),false);assert.equal((await gateway.handle(new Request(old))).status,404);assert.equal(requests,0);
 gateway.clear();assert.equal(gateway.handles(new Request(next)),false);assert.equal((await gateway.handle(new Request(next))).status,404);
});
