const {safeStorage,net}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
exports.createXtreamStore=(directory,options={})=>{
 const accountFile=path.join(directory,'xtream-account.enc'),sourcesFile=path.join(directory,'xtream-sources.enc'),metadataFile=path.join(directory,'metadata-token.enc');
 const fetcher=(url,settings)=>net.fetch(url,settings);
 const decrypt=async file=>{try{return (await safeStorage.decryptStringAsync(await fs.readFile(file))).result;}catch(error){if(error.code==='ENOENT')return null;throw Error('No se pudieron leer las credenciales guardadas.');}};
 const encrypt=async(file,value)=>{if(!await safeStorage.isAsyncEncryptionAvailable())throw Error('El almacenamiento protegido de Windows no está disponible.');await fs.mkdir(directory,{recursive:true});await fs.writeFile(file,await safeStorage.encryptStringAsync(value));};
 let metadataPromise;
 const metadata=()=>metadataPromise??=import('../src/metadataPreferences.js').then(({createMetadataPreferences})=>createMetadataPreferences({readToken:()=>decrypt(metadataFile),writeToken:token=>encrypt(metadataFile,token),checkToken:async token=>(await import('../src/metadata.js')).checkMetadataToken(token,fetcher),...(Object.hasOwn(options,'metadataPreset')?{preset:options.metadataPreset}:{})}));
 const metadataToken=async()=>(await metadata()).token();
 let registryPromise;
 const registry=()=>registryPromise??=import('../src/sourceRegistry.js').then(async({createSourceRegistry})=>{const {createPersistentMetadataCache,previewMetadataCacheOptions}=await import('../src/persistentMetadataCache.js');const details=createPersistentMetadataCache({...previewMetadataCacheOptions,read:async()=>{try{return JSON.parse(await fs.readFile(path.join(directory,'preview-details.json'),'utf8'));}catch{return null;}},write:values=>fs.writeFile(path.join(directory,'preview-details.json'),JSON.stringify(values))});const ratings=createPersistentMetadataCache({capacity:5000,read:async()=>{try{return JSON.parse(await fs.readFile(path.join(directory,'preview-ratings.json'),'utf8'));}catch{return null;}},write:values=>fs.writeFile(path.join(directory,'preview-ratings.json'),JSON.stringify(values))});return createSourceRegistry({readRatings:ratings.getMany,writeRating:ratings.put,readDetails:details.get,writeDetails:details.put,readRankings:async()=>{try{return JSON.parse(await fs.readFile(path.join(directory,'tmdb-selections.json'),'utf8'));}catch{return null;}},writeRankings:async data=>{await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'tmdb-selections.json'),JSON.stringify(data));},
  fetcher,metadataToken,...(Object.hasOwn(options,'preset')?{preset:options.preset}:{}),
  readAccounts:async()=>{const saved=await decrypt(sourcesFile);if(saved)return JSON.parse(saved);const legacy=await decrypt(accountFile);if(!legacy)return null;const migrated=[{...JSON.parse(legacy),sourceId:'eterboxtv'}];await encrypt(sourcesFile,JSON.stringify(migrated));return migrated;},
  writeAccounts:async list=>{await encrypt(sourcesFile,JSON.stringify(list));const primary=list.find(account=>account.sourceId==='eterboxtv');if(primary)await encrypt(accountFile,JSON.stringify(primary));},
  readCache:async account=>{try{return JSON.parse(await fs.readFile(path.join(directory,account.sourceId==='eterboxtv'?'xtream-catalogue.json':'xtream-catalogue-'+account.sourceId+'.json'),'utf8'));}catch{return null;}},
  writeCache:async(account,data)=>{await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,account.sourceId==='eterboxtv'?'xtream-catalogue.json':'xtream-catalogue-'+account.sourceId+'.json'),JSON.stringify(data));},
 });});
 const metadataSave=async input=>{const status=await (await metadata()).save(input);(await registry()).clearDetails();return status;};
 return Object.fromEntries(['save','status','recommendations','cachedRatings','catalogue','episodes','details','playback','remove','restore'].map(method=>[method,async(...args)=>(await registry())[method](...args)]).concat([['metadataSave',metadataSave],['metadataStatus',async()=>(await metadata()).status()]]));
};
