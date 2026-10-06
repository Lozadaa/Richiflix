import {xtreamClient} from './xtreamClient.js';
import {prepareChannels,prepareCatalogueGroups} from './channelPreparation.js';
import {primeCatalogueGroups} from './catalogueIndex.js';
export {prepareChannels} from './channelPreparation.js';
export const emptyContent={channels:[],movies:[],shows:[],connection:{name:'Mi IPTV',host:'',configured:false},loading:false,error:null};
let snapshot=emptyContent,pending,generation=0,refreshTimer,nextRefreshAt=0;const listeners=new Set();
const publish=value=>{snapshot=value;for(const listener of listeners)listener();};
export const contentStore={get:()=>snapshot,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}};
export function loadContent(force=false){
 if(pending&&!force)return pending;if(!force&&snapshot!==emptyContent&&!snapshot.error&&!snapshot.loading)return Promise.resolve(snapshot);
 clearTimeout(refreshTimer);const current=++generation;
 const existing=Boolean(snapshot.channels.length||snapshot.movies.length||snapshot.shows.length);
 publish({...snapshot,loading:!existing,refreshing:existing,error:null,phase:'configuration'});
 const started=performance.now(),timings={};
 const work=(async()=>{try{
  const client=xtreamClient(),connection=await client.status();
  timings.configuration=performance.now()-started;
  if(!connection.configured){if(current===generation)publish({...emptyContent,connection});return snapshot;}
  if(current===generation)publish({...snapshot,connection,phase:'catalogue'});
  const catalogueStart=performance.now(),data=await client.catalogue(force);timings.catalogue=performance.now()-catalogueStart;
  if(current!==generation)return snapshot;
  publish({...snapshot,phase:'indexing'});
  const indexingStart=performance.now(),preparedChannels=Array.isArray(data.preparedChannels)?data.preparedChannels:await prepareChannels(data,{cancelled:()=>current!==generation});const preparedGroups=data.preparedGroups||await prepareCatalogueGroups(data,preparedChannels,{budget:2,batchSize:128,cancelled:()=>current!==generation});timings.indexing=performance.now()-indexingStart;timings.total=performance.now()-started;
  primeCatalogueGroups({...data,preparedChannels,preparedGroups});
  const value={...data,preparedChannels,preparedGroups,connection:{...data.connection,configured:true},loading:false,refreshing:false,phase:'ready',bootTimings:existing?snapshot.bootTimings:timings,loadTimings:timings,error:data.sources?.length&&data.sources.every(source=>source.error)?'No pudimos actualizar tus fuentes. Revisa su estado en Ajustes.':null};
  if(current===generation){
   publish(value);
   const failed=data.sources?.some(source=>source.error),delay=failed?5*60*1000:data.needsRefresh?1000:Math.max(1000,(data.cacheExpiresAt||Date.now()+2*60*60*1000)-Date.now());
   nextRefreshAt=Date.now()+Math.min(delay,2*60*60*1000);
   refreshTimer=setTimeout(()=>{if(!document.hidden)loadContent(true);},Math.min(delay,2*60*60*1000));
  }
 }catch(error){if(current===generation)publish({...snapshot,loading:false,refreshing:false,phase:'ready',error:error.message||'No se pudo cargar tu fuente.'});}
 return snapshot;})();pending=work;work.finally(()=>{if(pending===work)pending=null;});return work;
}
if(globalThis.document)document.addEventListener('visibilitychange',()=>{
 if(!document.hidden&&!pending&&snapshot!==emptyContent&&Date.now()>=nextRefreshAt&&(snapshot.needsRefresh||snapshot.cacheExpiresAt<=Date.now()))loadContent(true);
});
