import {useEffect,useRef,useState} from 'react';
import {parseM3U,safeStream} from './catalog.js';
import {uuid,fetchPlaylist} from './platform.js';

const storage=(profileId,value)=>new Promise((resolve,reject)=>{
 const request=indexedDB.open('richiflix-library',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('sources');
 request.onerror=()=>reject(request.error);
 request.onsuccess=()=>{
  const db=request.result,transaction=db.transaction('sources',value===undefined?'readonly':'readwrite');
  const operation=value===undefined?transaction.objectStore('sources').get(profileId):transaction.objectStore('sources').put(value,profileId);
  transaction.oncomplete=()=>{db.close();resolve(value===undefined?operation.result||[]:value);};
  transaction.onerror=transaction.onabort=()=>{db.close();reject(transaction.error||new Error('No pudimos guardar la fuente.'));};
 };
});

export function useManualSources(profileId){
 const [sources,setSources]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const current=useRef([]);
 useEffect(()=>{let active=true;storage(profileId).then(saved=>{if(active){current.current=saved;setSources(saved);setLoading(false);}}).catch(()=>{if(active){setError('No pudimos leer tus fuentes guardadas.');setLoading(false);}});return()=>{active=false;};},[profileId]);
 const commit=async transform=>{const next=transform(current.current);await storage(profileId,next);current.current=next;setSources(next);setError('');};
 return {sources,loading,error,upsert:source=>commit(previous=>{const found=previous.some(item=>item.id===source.id);return found?previous.map(item=>item.id===source.id?source:item):[...previous,source];}),remove:id=>commit(previous=>previous.filter(item=>item.id!==id))};
}

async function playlistText(url){
 if(window.richiflix)return window.richiflix.fetchPlaylist(url);
 return fetchPlaylist(url);
}

export async function prepareSource(input,previous,refresh=false){
 const name=input.name.trim().slice(0,80);if(!name)throw Error('Ponle un nombre a la fuente.');
 if(!safeStream(input.url.trim()))throw Error('Usa una dirección HTTP o HTTPS.');
 if(!['playlist','vod','live','provider'].includes(input.type))throw Error('Elige un tipo de fuente.');
 const url=new URL(input.url.trim()).href,id=previous?.id||`manual-${uuid()}`;
 const image=input.image?.trim();if(image&&!safeStream(image))throw Error('La portada debe usar una dirección HTTP o HTTPS.');
 let items;
 if(input.type==='playlist'){
  items=!refresh&&previous?.url===url&&previous.type==='playlist'?previous.items:parseM3U(await playlistText(url));
  if(!items.length)throw Error('La lista no contiene emisiones HTTP o HTTPS.');
  items=items.map(item=>({...item,source:name,credit:name,manual:true,sourceId:id}));
 }else{
  items=[{id,title:name,url,image:image||undefined,kind:input.type==='live'?'iptv':input.type,genre:input.type==='provider'?'Plataforma':input.type==='live'?'En vivo':'Vídeo',source:name,credit:name,manual:true,sourceId:id,description:input.type==='provider'?`Abrir ${name}.`:`${name} · edad sin verificar`,availability:name,color:input.type==='provider'?'#bdb5e9':undefined}];
 }
 return {id,name,url,type:input.type,image:image||'',items,updatedAt:new Date().toISOString()};
}
