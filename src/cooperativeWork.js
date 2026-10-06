export function yieldWork(){
 if(globalThis.scheduler?.yield)return globalThis.scheduler.yield();
 if(globalThis.MessageChannel)return new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);});
 return new Promise(resolve=>setTimeout(resolve,0));
}
export async function cooperativeForEach(items,visit,{batchSize=512,budget=5,cancelled=()=>false}={}){
 let count=0,started=performance.now();
 for(let index=0;index<items.length;index++){
  if(cancelled())throw Error('El trabajo anterior fue cancelado.');
  visit(items[index],index);count++;
  if(index<items.length-1&&(count>=batchSize||performance.now()-started>=budget)){
   await yieldWork();started=performance.now();count=0;
  }
 }
}
export async function cooperativeMap(items,mapper,options){const result=new Array(items.length);await cooperativeForEach(items,(item,index)=>{result[index]=mapper(item,index);},options);return result;}
