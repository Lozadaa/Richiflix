import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogueWorkerClient} from './catalogueWorkerClient.js';

const turn=()=>new Promise(resolve=>setImmediate(resolve));
function clock(){let time=0,next=0;const tasks=new Map();return {schedule:(callback,delay)=>{const id=++next;tasks.set(id,{callback,at:time+delay});return id;},cancel:id=>tasks.delete(id),advance(ms){time+=ms;for(const [id,task] of [...tasks])if(task.at<=time){tasks.delete(id);task.callback();}},get size(){return tasks.size;}};}
class FakeWorker{
 listeners=new Map();messages=[];terminated=false;
 addEventListener(name,listener){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(listener);}
 removeEventListener(name,listener){this.listeners.get(name)?.delete(listener);}
 emit(name,data){for(const listener of this.listeners.get(name)||[])listener({data,preventDefault(){}});}
 postMessage(value){this.messages.push(value);}
 terminate(){this.terminated=true;}
 ready(){this.emit('message',{type:'ready',backendAvailable:true});}
 reply(request,value,error){this.emit('message',{type:'response',id:request.id,value,...(error?{error}:{})});}
}

test('one worker serves concurrent RPCs with independent responses and bounded callbacks',async()=>{
 const worker=new FakeWorker(),timer=clock();let created=0;const client=createCatalogueWorkerClient({createWorker:()=>{created++;return worker;},maxPending:2,...timer});
 const status=client.request('status'),metadata=client.request('metadataStatus');assert.equal(created,1);assert.equal(worker.messages.length,0);assert.equal(client.mode,'starting');
 await assert.rejects(client.request('status'),{code:'WORKER_BUSY'});worker.ready();await turn();
 assert.equal(worker.messages.length,2);assert.notEqual(worker.messages[0].id,worker.messages[1].id);
 worker.reply(worker.messages[1],{configured:true});worker.reply(worker.messages[0],{name:'Fixture'});assert.deepEqual(await status,{name:'Fixture'});assert.deepEqual(await metadata,{configured:true});
 assert.deepEqual(client.diagnostics(),{mode:'worker',session:1,pending:0});client.dispose();assert.equal(timer.size,0);assert.equal(worker.terminated,true);
});
test('three-second readiness failure terminates the worker and uses a single cooperative fallback',async()=>{
 const worker=new FakeWorker(),timer=clock();let fallbacks=0;const calls=[];const client=createCatalogueWorkerClient({createWorker:()=>worker,fallbackFactory:()=>{fallbacks++;return {request:async(method,args)=>{calls.push([method,args]);return 'fallback';}};},...timer});
 const work=client.request('status');timer.advance(2999);await turn();assert.equal(calls.length,0);timer.advance(1);assert.equal(await work,'fallback');
 assert.equal(await client.request('metadataStatus'),'fallback');assert.equal(fallbacks,1);assert.equal(worker.terminated,true);assert.equal(client.mode,'fallback');assert.equal(client.available,false);client.dispose();assert.equal(timer.size,0);
});
test('unsupported constructors and unavailable worker storage retain the fallback API',async()=>{
 for(const createWorker of [()=>{throw Error('Unavailable');},()=>new FakeWorker()]){
  let worker;const client=createCatalogueWorkerClient({createWorker:()=>worker=createWorker(),fallbackFactory:()=>({request:async(method,args)=>({method,args})})});
  const work=client.request('prepareChannels',[{channels:[]}]);if(worker)worker.emit('message',{type:'ready',backendAvailable:false});assert.deepEqual(await work,{method:'prepareChannels',args:[{channels:[]}]});client.dispose();
 }
});
test('a crashed worker retries reads in fallback but never repeats an uncertain mutation',async()=>{
 const worker=new FakeWorker(),calls=[];const client=createCatalogueWorkerClient({createWorker:()=>worker,fallbackFactory:()=>({request:async method=>{calls.push(method);return 'read result';}})});
 const read=client.request('status'),mutation=client.request('save',[{fixture:true}]);const rejected=assert.rejects(mutation,{code:'WORKER_UNAVAILABLE'});worker.ready();await turn();assert.equal(worker.messages.length,2);
 const originalSession=client.session;worker.emit('error');assert.equal(await read,'read result');await rejected;assert.deepEqual(calls,['status']);assert.ok(client.session>originalSession);client.dispose();
});
test('cancelling a sent request releases its callback and ignores a late worker response',async()=>{
 const worker=new FakeWorker(),timer=clock(),controller=new AbortController(),client=createCatalogueWorkerClient({createWorker:()=>worker,...timer});
 const work=client.request('search',['group','query','Todas'],{signal:controller.signal}),rejected=assert.rejects(work,{name:'AbortError'});worker.ready();await turn();const request=worker.messages[0];controller.abort();await rejected;
 assert.deepEqual(worker.messages[1],{type:'cancel',id:request.id});worker.reply(request,['late']);assert.equal(client.diagnostics().pending,0);assert.equal(timer.size,0);client.dispose();
});
test('fallback cancellation and disposal abort jobs without leaving request timers',async()=>{
 const timer=clock(),controller=new AbortController();let seen;const client=createCatalogueWorkerClient({createWorker:()=>{throw Error('Unavailable');},fallbackFactory:()=>({request:(_method,_args,{signal})=>new Promise((_resolve,reject)=>{seen=signal;signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true});})}),...timer});
 const work=client.request('search',['group','query'],{signal:controller.signal}),rejected=assert.rejects(work,{name:'AbortError'});await turn();controller.abort();await rejected;assert.equal(seen.aborted,true);assert.equal(client.diagnostics().pending,0);
 const next=client.request('status'),closed=assert.rejects(next,{name:'AbortError'});await turn();client.dispose();await closed;assert.equal(timer.size,0);await assert.rejects(client.request('status'),{name:'AbortError'});
});
test('timeouts cancel worker jobs and malformed operations never start a worker',async()=>{
 const timer=clock(),worker=new FakeWorker();let created=0;const client=createCatalogueWorkerClient({createWorker:()=>{created++;return worker;},requestTimeout:1000,...timer});
 await assert.rejects(client.request('not-a-method'));await assert.rejects(client.request('status',{}));assert.equal(created,0);
 const work=client.request('status'),rejected=assert.rejects(work,{code:'WORKER_TIMEOUT'});worker.ready();await turn();timer.advance(1000);await rejected;assert.equal(worker.messages[1].type,'cancel');assert.equal(client.diagnostics().pending,0);client.dispose();assert.equal(timer.size,0);
});
