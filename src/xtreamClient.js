import {catalogueWorkerClient,flushCatalogueWorker} from './catalogueWorkerClient.js';
const browserClient=Object.fromEntries(['status','recommendations','cachedRatings','save','catalogue','episodes','details','shortEpg','playback','remove','restore','metadataStatus','metadataSave'].map(method=>[method,(...args)=>catalogueWorkerClient().request(method,args)]));
if(globalThis.document){globalThis.addEventListener('pagehide',flushCatalogueWorker);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushCatalogueWorker();});}
export function xtreamClient(){
 const native=globalThis.richiflix;if(!native?.xtreamStatus)return browserClient;
 return {status:native.xtreamStatus,recommendations:native.xtreamRecommendations,cachedRatings:native.xtreamCachedRatings,save:native.xtreamSave,catalogue:native.xtreamCatalogue,episodes:native.xtreamEpisodes,details:native.xtreamDetails,shortEpg:native.xtreamShortEpg,playback:native.xtreamPlayback,metadataStatus:native.metadataStatus,metadataSave:native.metadataSave,remove:native.xtreamRemove,restore:native.xtreamRestore};
}
