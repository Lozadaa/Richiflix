import {createTmdbSelectionCache,matchTmdbSelections} from './tmdbSelections.js';
import {validateAccount,authenticate,accountKey,loadXtreamCatalogue,loadXtreamEpisodes,loadXtreamVideoDetails,playbackURL} from './xtream.js';
import {deduplicateItemsAsync} from './catalogueIdentity.js';
import {cooperativeMap,cooperativeForEach} from './cooperativeWork.js';
import {defaultSource,PRIMARY_SOURCE_ID} from './sourceDefaults.js';
import {filterCatalogue,isPornographic,CONTENT_POLICY_VERSION} from './contentPolicy.js';

export function createSourceRegistry({readAccounts,writeAccounts,readCache,writeCache,metadataToken=async()=>'',readDetails=async()=>null,writeDetails=async()=>{},readRatings=async()=>({}),writeRating=async()=>{},readRankings=async()=>null,writeRankings=async()=>{},fetcher=fetch,preset=defaultSource,catalogueTTL=2*60*60*1000,catalogueTimeout=18000,now=Date.now}){
 let selectionsPromise,selectionsCatalogue;const selections=createTmdbSelectionCache({read:readRankings,write:writeRankings,fetcher,now});
 let accountsPromise,cataloguePromise,catalogueController,revision=0,catalogueGeneration=0;const detailCache=new Map(),episodeCache=new Map(),sourceData=new Map(),cacheWrites=new Map();
 const publicSource=account=>({id:account.sourceId,name:account.name,host:account.host,key:accountKey(account),configured:true,pinned:account.sourceId===PRIMARY_SOURCE_ID});
 const accounts=()=>accountsPromise??=(async()=>{
  const stored=await readAccounts();const list=(stored||[]).map(account=>({...validateAccount(account),sourceId:account.sourceId||PRIMARY_SOURCE_ID}));
  if(!list.some(account=>account.sourceId===PRIMARY_SOURCE_ID)&&preset)list.unshift({...validateAccount(preset),sourceId:PRIMARY_SOURCE_ID});
  if(!stored||list.length!==stored.length)await writeAccounts(list);
  return list;
 })().catch(error=>{accountsPromise=null;throw error;});
 const statusFor=list=>{const sources=list.map(publicSource),primary=sources.find(source=>source.pinned);return {...(primary||{name:'eterboxtv',host:defaultSource?.host||'',configured:false}),sources,revision:sources.map(source=>source.id+':'+source.key).join('|')};};
 async function commit(list){await writeAccounts(list);catalogueController?.abort();accountsPromise=Promise.resolve(list);revision++;cataloguePromise=null;detailCache.clear();episodeCache.clear();selectionsPromise=null;selectionsCatalogue=null;sourceData.clear();return statusFor(list);}
 async function selected(sourceId=PRIMARY_SOURCE_ID){const account=(await accounts()).find(account=>account.sourceId===sourceId);if(!account)throw Error('Esta fuente ya no está disponible.');return account;}
 const expires=data=>{const updated=Date.parse(data?.updatedAt);return Number.isFinite(updated)?updated+catalogueTTL:0;};
 const blockedRecords=new Map(),sanitizedData=new WeakSet();
 const sourceKeyFor=account=>account.sourceId+':'+accountKey(account);
 const recordKey=item=>`${item.mediaType}:${item.streamId}`;
 async function sanitize(account,data,options){
  const records=blockedRecords.get(sourceKeyFor(account))||new Map();
  for(const item of data.blockedContent||[])records.set(recordKey(item),item);
  blockedRecords.set(sourceKeyFor(account),records);
  const clean=await filterCatalogue({...data,blockedContent:[...records.values()]},options);sanitizedData.add(clean);return clean;
 }
 async function rememberBlocked(account,id,type){
  const key=sourceKeyFor(account),records=blockedRecords.get(key)||new Map();records.set(`${type}:${id}`,{mediaType:type,streamId:String(id)});blockedRecords.set(key,records);
  const write=(cacheWrites.get(key)||Promise.resolve()).catch(()=>{}).then(async()=>{
   let data=sourceData.get(key);if(!data)try{data=await readCache(account);}catch{}
   if(data&&data.connection?.key===accountKey(account)){const clean=await sanitize(account,data);sourceData.set(key,clean);cataloguePromise=null;await writeCache(account,clean);}
  });cacheWrites.set(key,write);try{await write;}catch{}finally{if(cacheWrites.get(key)===write)cacheWrites.delete(key);}
 }
 async function sourceCatalogue(account,force,outerSignal){
  const sourceKey=account.sourceId+':'+accountKey(account);let cached=sourceData.get(sourceKey);
  if(!cached)try{cached=await readCache(account);}catch{}
  const valid=cached?.connection?.key===accountKey(account)&&['channels','movies','shows'].every(type=>Array.isArray(cached[type]))?(sanitizedData.has(cached)?cached:await sanitize(account,cached,{budget:2,batchSize:128})):null;
  if(valid&&(cached.contentPolicyVersion!==CONTENT_POLICY_VERSION||['channels','movies','shows'].some(type=>valid[type]!==cached[type])))try{await writeCache(account,valid);}catch{}
  if(!force&&valid){sourceData.set(sourceKey,valid);return {data:valid,stale:expires(valid)<=now()};}
  const controller=new AbortController(),cleanups=[];let timer,abort;
  try{
   if(outerSignal?.aborted)throw Error('La actualización tardó demasiado.');
   const stopped=new Promise((_,reject)=>{abort=()=>{controller.abort();reject(Error('La actualización tardó demasiado.'));};});
   outerSignal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,catalogueTimeout);
   const boundedFetch=(url,options={})=>{
    if(controller.signal.aborted||options.signal?.aborted)return Promise.reject(Error('La actualización fue cancelada.'));
    const request=new AbortController(),cancel=()=>request.abort();
    controller.signal.addEventListener('abort',cancel,{once:true});options.signal?.addEventListener('abort',cancel,{once:true});
    cleanups.push(()=>{controller.signal.removeEventListener('abort',cancel);options.signal?.removeEventListener('abort',cancel);});
    return fetcher(url,{...options,signal:request.signal});
   };
   const raw=await Promise.race([loadXtreamCatalogue(account,boundedFetch,{cancelled:()=>controller.signal.aborted}),stopped]);
   const data=await sanitize(account,raw,{budget:2,batchSize:128,cancelled:()=>controller.signal.aborted});
   // A cache write failure must not discard a complete, playable catalogue.
   if(controller.signal.aborted||outerSignal?.aborted)throw Error('La actualización fue cancelada.');
   sourceData.set(sourceKey,data);
   const write=(cacheWrites.get(sourceKey)||Promise.resolve()).catch(()=>{}).then(()=>{if(!controller.signal.aborted&&!outerSignal?.aborted)return writeCache(account,data);});cacheWrites.set(sourceKey,write);
   const finished=()=>{if(cacheWrites.get(sourceKey)===write)cacheWrites.delete(sourceKey);};write.then(finished,finished);
   try{await Promise.race([write,stopped]);}catch{}
   return {data,stale:false};
  }catch(error){if(valid)sourceData.set(sourceKey,valid);return {data:valid,stale:Boolean(valid),error:error.message};}
  finally{clearTimeout(timer);if(abort)outerSignal?.removeEventListener('abort',abort);for(const cleanup of cleanups)cleanup();}
 }
 async function catalogue(force=false){
  if(!force&&cataloguePromise)return cataloguePromise;if(force)catalogueController?.abort();const generation=revision,current=++catalogueGeneration,options={cancelled:()=>current!==catalogueGeneration||generation!==revision};
  const work=(async()=>{const list=await accounts(),result={channels:[],movies:[],shows:[],sources:[],connection:statusFor(list),needsRefresh:false,contentPolicyVersion:CONTENT_POLICY_VERSION};let oldest,expiry=Infinity;
   const controller=new AbortController();catalogueController=controller;const timer=setTimeout(()=>controller.abort(),catalogueTimeout),loaded=new Array(list.length);let next=0;
   // Different providers can load concurrently; each provider still has only
   // two catalogue requests in flight. The entire job has one time budget.
   try{await Promise.all(Array.from({length:Math.min(2,list.length)},async()=>{while(next<list.length){const index=next++;loaded[index]=await sourceCatalogue(list[index],force,controller.signal);}}));}finally{clearTimeout(timer);if(catalogueController===controller)catalogueController=null;}
   for(let index=0;index<list.length;index++){const account=list[index],{data,error,stale}=loaded[index],source=publicSource(account);
    if(data){for(const type of ['channels','movies','shows']){const items=await cooperativeMap(data[type],item=>({...item,sourceId:account.sourceId,catalogueUpdatedAt:data.updatedAt}),options);for(const item of items)result[type].push(item);}if(!oldest||data.updatedAt<oldest)oldest=data.updatedAt;}
    if(data)expiry=Math.min(expiry,expires(data));result.needsRefresh||=Boolean(stale);
    result.sources.push({...source,channels:data?.channels.length||0,movies:data?.movies.length||0,shows:data?.shows.length||0,...(stale?{stale:true}:{}),...(error?{error}:{})});
   }
   for(const type of ['channels','movies','shows']){result[type]=await deduplicateItemsAsync(result[type],options);const counts=new Map();await cooperativeForEach(result[type],item=>counts.set(item.sourceId,(counts.get(item.sourceId)||0)+1),options);for(const source of result.sources)source[type]=counts.get(source.id)||0;}
   result.updatedAt=oldest;result.cacheExpiresAt=Number.isFinite(expiry)?expiry:now()+catalogueTTL;result.connection.sources=result.sources;return result;
  })();cataloguePromise=work;try{return await work;}catch(error){if(cataloguePromise===work&&generation===revision)cataloguePromise=null;throw error;}
 }
 const registry={
  status:async()=>statusFor(await accounts()),catalogue,
  save:async input=>{const candidate=validateAccount(input),list=await accounts(),sourceId=input.sourceId===''?'source-'+accountKey(candidate):input.sourceId||PRIMARY_SOURCE_ID;
   if(list.some(account=>account.sourceId!==sourceId&&accountKey(account)===accountKey(candidate)))throw Error('Esta conexión ya está agregada.');
   if(input.sourceId&&input.sourceId!==PRIMARY_SOURCE_ID&&!list.some(account=>account.sourceId===sourceId))throw Error('Esta fuente ya no está disponible.');
   await authenticate(candidate,fetcher);return commit([...list.filter(account=>account.sourceId!==sourceId),{...candidate,sourceId}].sort((a,b)=>Number(b.sourceId===PRIMARY_SOURCE_ID)-Number(a.sourceId===PRIMARY_SOURCE_ID)));
  },
  remove:async sourceId=>{if(sourceId===PRIMARY_SOURCE_ID)throw Error('La fuente principal permanece en la app.');return commit((await accounts()).filter(account=>account.sourceId!==sourceId));},
  restore:async()=>{if(!preset)throw Error('No hay configuración de fábrica.');const candidate=validateAccount(preset),list=await accounts();if(list.some(account=>account.sourceId!==PRIMARY_SOURCE_ID&&accountKey(account)===accountKey(candidate)))throw Error('La conexión original ya está agregada como fuente adicional. Quita esa copia antes de restaurar.');await authenticate(candidate,fetcher);return commit([{...candidate,sourceId:PRIMARY_SOURCE_ID},...list.filter(account=>account.sourceId!==PRIMARY_SOURCE_ID)]);},
  clearDetails:()=>{detailCache.clear();selectionsPromise=null;selectionsCatalogue=null;},
  cachedRatings:async()=>{const data=await catalogue(),list=await accounts(),token=await metadataToken(),tokenKey=accountKey({host:'metadata',username:token}),sources=new Map(list.map(account=>[account.sourceId,`${account.sourceId}:${accountKey(account)}`])),items=[...data.movies,...data.shows];const keys=await cooperativeMap(items,item=>`${sources.get(item.sourceId)}:${item.mediaType}:${item.streamId}:metadata-v3:${tokenKey}`);const saved=await readRatings(keys),result={};await cooperativeForEach(items,(item,index)=>{if(saved[keys[index]])result[item.id]=saved[keys[index]];});return result;},
  recommendations:async()=>{const data=await catalogue();if(selectionsPromise&&selectionsCatalogue===data)return selectionsPromise;selectionsCatalogue=data;const work=(async()=>{const token=await metadataToken(),ranking=await selections.get(token,accountKey({host:'tmdb',username:token}));return matchTmdbSelections(data,ranking);})();selectionsPromise=work;try{return await work;}catch(error){if(selectionsPromise===work)selectionsPromise=null;throw error;}},
  episodes:async(id,sourceId)=>{
   const account=await selected(sourceId),key=account.sourceId+':'+accountKey(account)+':'+id;
   const previous=sourceData.get(sourceKeyFor(account))||await readCache(account).catch(()=>null);
   if(blockedRecords.get(sourceKeyFor(account))?.has(`series:${id}`)||(previous?.blockedContent||[]).some(item=>item.mediaType==='series'&&String(item.streamId)===String(id))||isPornographic(previous?.shows?.find(item=>String(item.streamId)===String(id))))throw Error('Este contenido está bloqueado en Richiflix.');
   const cached=episodeCache.get(key);
   if(cached&&now()-cached.at<30*60*1000){episodeCache.delete(key);episodeCache.set(key,cached);return cached.work;}
   const work=loadXtreamEpisodes(account,id,fetcher);episodeCache.set(key,{at:now(),work});while(episodeCache.size>8)episodeCache.delete(episodeCache.keys().next().value);
   try{return await work;}catch(error){if(episodeCache.get(key)?.work===work)episodeCache.delete(key);throw error;}
  },
  details:async(id,type='movie',sourceId)=>{if(!['movie','series'].includes(type))throw Error('Tipo no válido.');const account=await selected(sourceId),key=account.sourceId+':'+accountKey(account)+':'+type+':'+id;if(detailCache.has(key)){const value=detailCache.get(key);detailCache.delete(key);detailCache.set(key,value);return value;}
   // Only detail entries change generation; sources, profiles and catalogues keep their storage keys.
   const work=(async()=>{const token=await metadataToken(),persistedKey=key+':metadata-v4:'+accountKey({host:'metadata',username:token}),cached=await readDetails(persistedKey);const candidate=cached||await loadXtreamVideoDetails(account,id,fetcher,type,token),data=isPornographic(candidate)?{isPornographic:true}:candidate;if(data.isPornographic)await rememberBlocked(account,id,type);if(!cached||data!==candidate)writeDetails(persistedKey,data).catch(()=>{});if(data.tmdbScore>0&&data.tmdbScore<=10&&Number.isSafeInteger(data.tmdbVotes)&&data.tmdbVotes>0)writeRating(key+':metadata-v3:'+accountKey({host:'metadata',username:token}),{tmdbScore:data.tmdbScore,tmdbVotes:data.tmdbVotes,tmdbId:data.tmdbId}).catch(()=>{});return data;})();detailCache.set(key,work);while(detailCache.size>160)detailCache.delete(detailCache.keys().next().value);try{return await work;}catch(error){detailCache.delete(key);throw error;}
  },
  playback:async item=>{if(isPornographic(item))throw Error('Este contenido está bloqueado en Richiflix.');const account=await selected(item.sourceId),key=accountKey(account);if(!item.url?.startsWith(`xtream://${key}/`))throw Error('El título no pertenece a esta conexión.');const {data,error}=await sourceCatalogue(account,false);if(!data)throw Error(error||'No se pudo preparar la señal.');
   let canonical;if(item.mediaType==='episode'){for(const [cacheKey,cached] of episodeCache){if(!cacheKey.startsWith(sourceKeyFor(account)+':'))continue;const parent=cacheKey.slice((sourceKeyFor(account)+':').length);if((data.blockedContent||[]).some(record=>record.mediaType==='series'&&String(record.streamId)===parent))continue;try{canonical=(await cached.work).flatMap(group=>group.episodes).find(episode=>episode.url===item.url);if(canonical)break;}catch{}}}
   else canonical=(item.mediaType==='live'?data.channels:data.movies).find(candidate=>candidate.url===item.url&&candidate.mediaType===item.mediaType&&String(candidate.streamId)===String(item.streamId));
   if(!canonical||isPornographic(canonical))throw Error('Este contenido no está disponible en el catálogo permitido.');
   if(canonical.mediaType==='movie'&&isPornographic(await registry.details(canonical.streamId,'movie',account.sourceId)))throw Error('Este contenido está bloqueado en Richiflix.');
   return playbackURL(account,canonical,data.connection.formats);},
 };
 return registry;
}
