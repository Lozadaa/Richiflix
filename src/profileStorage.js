import {deviceStorage} from './deviceStorage.js';
const key='rf-profiles',versionKey='rf-profiles-v2';
const valid=list=>{
 if(!Array.isArray(list))return null;
 const ids=new Set();return list.filter(profile=>{
  if(typeof profile?.id!=='string'||!profile.id||typeof profile.name!=='string'||!['adult','kids'].includes(profile.kind)||ids.has(profile.id))return false;
  ids.add(profile.id);return true;
 });
};
const versioned=value=>value?.version===2&&Number.isFinite(value.updatedAt)&&valid(value.profiles)?value:null;
export function createProfileStorage({local=()=>globalThis.localStorage,backup=deviceStorage,now=Date.now}={}){
 let revision=0,lastTimestamp=0,saving=Promise.resolve(),futureBackup=false,probed,lastSaved;
 const read=name=>{try{return JSON.parse(local().getItem(name));}catch{return null;}};
 const currentLocal=()=>{const value=read(versionKey);return versioned(Number(value?.version)>2?read(versionKey+':recovery-v2'):value);};
 const localProfiles=()=>valid(read(key))||lastSaved?.profiles||currentLocal()?.profiles||null;
 const writeLocal=value=>{let saved=false;const target=Number(read(versionKey)?.version)>2?versionKey+':recovery-v2':versionKey;for(const [name,data] of [[key,value.profiles],[target,value]])try{local().setItem(name,JSON.stringify(data));saved=true;}catch{}return saved;};
 const readBackup=()=>probed??=(async()=>{try{const value=await backup(versionKey);futureBackup=Number(value?.version)>2;const current=versioned(value)||versioned(await backup(versionKey+':recovery-v2'));return {current,legacy:current?null:valid(await backup(key))};}catch{futureBackup=true;return {error:Error('No se pudieron recuperar los perfiles guardados. Vuelve a intentarlo.')};}})().then(value=>{if(value.error)probed=null;return value;});
 async function loadProfiles(){
  const started=revision,localValue=currentLocal(),current=lastSaved&&lastSaved.updatedAt>(localValue?.updatedAt||0)?lastSaved:localValue,legacy=localProfiles(),{current:stored,legacy:oldBackup,error}=await readBackup();
  if(started!==revision)return localProfiles()||[];
  if(error)throw error;
  if((futureBackup||Number(read(versionKey)?.version)>2)&&!legacy?.length&&!current?.profiles?.length&&!stored?.profiles?.length&&!oldBackup?.length)throw Error('La copia de perfiles usa una versión más reciente. Tus datos se han conservado.');
  const newest=stored&&(!current||stored.updatedAt>current.updatedAt)?stored:current;
  // Legacy local data has no revision to compare. Preserve both compatible
  // lists during migration instead of discarding profiles found in backup.
  const migrated=!current&&legacy?.length?[...new Map([...(stored?.profiles||oldBackup||[]),...legacy].map(profile=>[profile.id,profile])).values()]:null;
  const profiles=migrated||newest?.profiles||(legacy?.length?legacy:null)||oldBackup||legacy||[];
  if(profiles.length){
   const value={version:2,updatedAt:Math.max(newest?.updatedAt||0,lastTimestamp,now()),profiles};lastTimestamp=value.updatedAt;
   writeLocal(value);
   const work=saving.catch(()=>{}).then(()=>{if(started===revision)return backup(futureBackup?versionKey+':recovery-v2':versionKey,value);});saving=work;
   try{await work;}catch{}
  }
  return profiles;
 }
 async function saveProfiles(profiles){
  if(!valid(profiles)||valid(profiles).length!==profiles.length)throw Error('El perfil contiene datos no válidos.');
  revision++;lastTimestamp=Math.max(now(),lastTimestamp+1);
  const value={version:2,updatedAt:lastTimestamp,profiles},savedLocal=writeLocal(value);
  // Serial commits keep an older write from landing after a new profile.
  const work=saving.catch(()=>{}).then(readBackup).then(()=>backup(futureBackup?versionKey+':recovery-v2':versionKey,value));saving=work;
  try{await work;lastSaved=value;}catch{if(!savedLocal)throw Error('No se pudo guardar el perfil en este dispositivo.');lastSaved=value;}
 }
 return {localProfiles,loadProfiles,saveProfiles};
}
const storage=createProfileStorage();
export const {localProfiles,loadProfiles,saveProfiles}=storage;
