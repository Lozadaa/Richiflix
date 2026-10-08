// Development-only connection to the running Richiflix widget on the owner's TV.
export async function connectTV(port=9227){
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const target=targets.find(target=>target.type==='page'&&target.title==='Richiflix');
 if(!target)throw Error('Richiflix is not running in the TV inspector');
 const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map(),events=new Set();let id=0;
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data)),request=pending.get(message.id);if(!request){for(const listener of events)listener(message);return;}pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(Error(message.error.message)):request.resolve(message.result);});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id,timer=setTimeout(()=>{pending.delete(next);reject(Error('TV inspector timeout: '+method));},15000);pending.set(next,{resolve,reject,timer});socket.send(JSON.stringify({id:next,method,params}));});
 const evaluate=async(fn,...args)=>{const result=await send('Runtime.evaluate',{expression:`(${fn.toString()})(...${JSON.stringify(args)})`,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.text||'TV evaluation failed');return result.result?.value;};
 return {send,evaluate,onEvent(listener){events.add(listener);return()=>events.delete(listener);},close(){socket.close();for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Inspector closed'));}pending.clear();}};
}
