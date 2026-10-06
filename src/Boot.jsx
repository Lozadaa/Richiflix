import React,{useEffect,useState} from 'react';
import {Brand,BrandGlyph} from './Brand.jsx';
import {contentStore,loadContent} from './contentStore.js';
import {xtreamClient} from './xtreamClient.js';
import {preloadPreviewArtwork} from './previewArtwork.js';
import {recoverBootProfiles} from './bootRecovery.js';
import {warmTrailerAPI} from './TrailerPreview.jsx';
const bounded=(promise,ms)=>new Promise(resolve=>{const timer=setTimeout(resolve,ms);promise.then(value=>{clearTimeout(timer);resolve(value);},()=>{clearTimeout(timer);resolve();});});
function image(path){return new Promise(resolve=>{const img=new Image();img.onload=async()=>{try{await img.decode?.();}catch{}resolve();};img.onerror=resolve;img.src=import.meta.env.BASE_URL+path;});}
export function Boot({children}){
 const [ready,setReady]=useState(false),[profiles,setProfiles]=useState([]),[slow,setSlow]=useState(false),[stage,setStage]=useState('configuration'),[profileError,setProfileError]=useState(null),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setProfileError(null);setSlow(false);const timer=setTimeout(()=>{if(live)setSlow(true);},6000);performance.mark('richiflix-boot-start');
  const resources=Promise.allSettled([document.fonts.load('600 24px Manrope'),document.fonts.load('800 40px "Bricolage Grotesque"'),image('avatars/adult-raccoon.png'),image('avatars/kids-kitten.png'),image('brand/richiflix-glyph.svg'),image('artwork/categories/cinema.png')]);
  warmTrailerAPI();
  let contentReady=false,resourcesReady=false,profilesReady=false;
  const remainingStage=()=>{if(!live)return;if(contentReady&&resourcesReady&&!profilesReady)setStage('profiles');else if(contentReady&&!resourcesReady)setStage('resources');};
  const unsubscribe=contentStore.subscribe(()=>{if(live){if(contentReady&&resourcesReady&&!profilesReady)setStage('profiles');else setStage(contentStore.get().phase||'configuration');}});
  const profileWork=recoverBootProfiles().then(value=>({value}),error=>({error})).then(value=>{profilesReady=true;remainingStage();return value;});
  const contentWork=bounded(loadContent().then(async content=>{if(live)setStage('artwork');const first=content.movies[0]||content.shows[0];if(first){const metadata=await bounded(xtreamClient().details(first.streamId,first.mediaType,first.sourceId),1500);if(metadata)preloadPreviewArtwork({...first,...metadata});}return content;}),20000).then(value=>{contentReady=true;remainingStage();return value;});
  const resourcesWork=bounded(resources,4000).then(value=>{resourcesReady=true;remainingStage();return value;});
  Promise.all([contentWork,resourcesWork,profileWork]).then(([, ,saved])=>{if(!live)return;if(saved.error){setStage('profiles');setProfileError(saved.error.message);return;}setProfiles(saved.value);setReady(true);performance.mark('richiflix-boot-ready');performance.measure('richiflix-boot','richiflix-boot-start','richiflix-boot-ready');});
  return()=>{live=false;clearTimeout(timer);unsubscribe();};
 },[attempt]);
 const stages={configuration:'Recuperando tu configuración',catalogue:'Preparando tus fuentes',indexing:'Ordenando tu catálogo',artwork:'Preparando tu próxima portada',profiles:'Recuperando tus perfiles',resources:'Preparando las imágenes y tipografías'};
 return ready?children(profiles):<div className="boot-screen" role="status" aria-label="Preparando Richiflix" data-boot-stage={stage}><div className="brand"><Brand/></div><div className="boot-orbit"><BrandGlyph/></div><p>{profileError?'Recuperando tus perfiles':stages[stage]||'Preparando Richiflix'}</p>{profileError?<><small role="alert">{profileError}</small><button className="primary" onClick={()=>setAttempt(value=>value+1)} autoFocus>Reintentar</button></>:slow&&<small>La primera carga necesita más tiempo</small>}</div>;
}
