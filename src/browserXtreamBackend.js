import {accountKey} from './xtream.js';
import {createSourceRegistry} from './sourceRegistry.js';
import {checkMetadataToken} from './metadata.js';
import {createMetadataPreferences} from './metadataPreferences.js';
import {createPersistentMetadataCache} from './persistentMetadataCache.js';
import {deviceStorage} from './deviceStorage.js';
import {prepareChannels,prepareCatalogueGroups} from './channelPreparation.js';

// The same database, keys and encryption envelope are used in a window and
// a dedicated worker. No private source values are copied into RPC messages.
export function createBrowserXtreamBackend({storage=deviceStorage,cryptography=globalThis.crypto,fetcher=globalThis.fetch,registryOptions={},metadataOptions={}}={}){
 async function decryptStored(name){const saved=await storage(name);if(!saved)return null;try{return new TextDecoder().decode(await cryptography.subtle.decrypt({name:'AES-GCM',iv:saved.iv},saved.key,saved.data));}catch{throw Error('No se pudo leer la conexión guardada.');}}
 async function encryptStored(name,value){if(!cryptography?.subtle)throw Error('El dispositivo no ofrece almacenamiento cifrado.');const key=await cryptography.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),iv=cryptography.getRandomValues(new Uint8Array(12)),data=await cryptography.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(value));await storage(name,{key,iv,data});}
 const metadata=createMetadataPreferences({readToken:()=>decryptStored('metadata-token'),writeToken:token=>encryptStored('metadata-token',token),checkToken:token=>checkMetadataToken(token,fetcher),...metadataOptions});
 const details=createPersistentMetadataCache({read:()=>storage('preview-details-v1'),write:values=>storage('preview-details-v1',values)});
 const ratings=createPersistentMetadataCache({capacity:5000,read:()=>storage('preview-ratings-v1'),write:values=>storage('preview-ratings-v1',values)});
 const registry=createSourceRegistry({readRatings:ratings.getMany,writeRating:ratings.put,readDetails:details.get,writeDetails:details.put,readRankings:()=>storage('tmdb-selections-v1'),writeRankings:data=>storage('tmdb-selections-v1',data),
  readAccounts:async()=>{const saved=await decryptStored('sources');if(saved)return JSON.parse(saved);const legacy=await decryptStored('account');if(!legacy)return null;const migrated=[{...JSON.parse(legacy),sourceId:'eterboxtv'}];await encryptStored('sources',JSON.stringify(migrated));return migrated;},
  writeAccounts:async list=>encryptStored('sources',JSON.stringify(list)),
  readCache:async account=>await storage('catalogue-'+account.sourceId)||await storage('catalogue-'+accountKey(account)),writeCache:(account,data)=>storage('catalogue-'+account.sourceId,data),metadataToken:metadata.token,fetcher,...registryOptions,
 });
 const prepared=new WeakMap();
 return {
  metadataStatus:metadata.status,
  metadataSave:async input=>{const status=await metadata.save(input);registry.clearDetails();return status;},
  ...Object.fromEntries(['status','recommendations','cachedRatings','save','episodes','details','playback','remove','restore'].map(method=>[method,(...args)=>registry[method](...args)])),
  catalogue:async force=>{const data=await registry.catalogue(force);if(!prepared.has(data)){const work=(async()=>{const options={budget:2,batchSize:128},preparedChannels=await prepareChannels(data,options);return {...data,preparedChannels,preparedGroups:await prepareCatalogueGroups(data,preparedChannels,options)};})();prepared.set(data,work);work.catch(()=>prepared.delete(data));}return prepared.get(data);},
  flush:()=>Promise.all([details.flush(),ratings.flush()]),
 };
}
