import {createArtworkStorage} from './artworkStorage.js';
import {createArtworkDiskCache} from './artworkDiskCache.js';
const cache=createArtworkDiskCache({store:createArtworkStorage()});
globalThis.addEventListener('message',async event=>{
 const message=event.data;if(!message||!Number.isSafeInteger(message.id))return;
 let value=null;try{if(message.method==='get')value=await cache.get(message.src);else if(message.method==='remember')value=await cache.remember(message.src);else if(message.method==='forget'){await cache.forget(message.src);value=true;}else if(message.method==='warm')value=await cache.warm();else if(message.method==='stats')value=cache.stats();else if(message.method==='idle'){await cache.idle();value=true;}}catch{}
 globalThis.postMessage({id:message.id,value});
});
