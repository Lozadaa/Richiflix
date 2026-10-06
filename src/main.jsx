import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Plus,Maximize,Minimize} from 'lucide-react';
import App from './App.jsx';
import {Boot} from './Boot.jsx';
import {saveProfiles} from './profileStorage.js';
import {Brand} from './Brand.jsx';
import {QualityImage} from './QualityImage.jsx';
import {displayText} from './displayText.js';
import {Dialog} from './Dialog.jsx';
import {useRemoteNavigation} from './useRemoteNavigation.js';
import {installFocusPaintDiagnostics} from './focusPaintDiagnostics.js';
import './style.css';
import './tvCardComposition.css';
import './compositorMotion.css';
import 'wicg-inert';
import {isTVBuild,installTVPlatform,uuid} from './platform.js';
installTVPlatform();
const avatar=kind=>`${import.meta.env.BASE_URL}avatars/${kind==='kids'?'kids-kitten':'adult-raccoon'}.png`;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
function FullscreenControl(){
 const [fullscreen,setFullscreen]=useState(false);
 useEffect(()=>{
  if(window.richiflix){window.richiflix.getFullscreen().then(setFullscreen);return window.richiflix.onFullscreenChange(setFullscreen);}
  const sync=()=>setFullscreen(Boolean(document.fullscreenElement));document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync);
 },[]);
 const toggle=()=>{if(window.richiflix)window.richiflix.setFullscreen(!fullscreen).catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});};
 if(isTVBuild)return null;
 return <button className="circle" aria-label={fullscreen?'Salir de pantalla completa':'Entrar en pantalla completa'} title="Pantalla completa · F11" onClick={toggle}>{fullscreen?<Minimize size={20}/>:<Maximize size={20}/>}</button>;
}
function ProfileGate({initialProfiles}){
 useRemoteNavigation();
 const [profiles,setProfiles]=useState(initialProfiles),[selected,setSelected]=useState(null),[creating,setCreating]=useState(false),[name,setName]=useState('Adulto'),[kind,setKind]=useState('adult'),[exitPrompt,setExitPrompt]=useState(false);
 const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
 const create=async()=>{if(!name.trim()||saving)return;setSaving(true);setSaveError('');try{const profile={id:uuid(),name:name.trim().slice(0,24),kind};const next=[...profiles,profile];await saveProfiles(next);setProfiles(next);setName('Adulto');setKind('adult');setCreating(false);}catch(error){setSaveError(error.message);}finally{setSaving(false);}};
 useEffect(()=>{if(!isTVBuild||selected)return;requestAnimationFrame(()=>document.querySelector(creating||!profiles.length?'.profile-create input':'.profile-grid button')?.focus());},[selected,creating,profiles.length]);
 useEffect(()=>{
  if(!isTVBuild||selected)return;
  const back=event=>{if(event.defaultPrevented||event.key!=='Escape'||document.querySelector('[role="dialog"]'))return;event.preventDefault();if(creating&&profiles.length)setCreating(false);else setExitPrompt(true);};
  window.addEventListener('keydown',back);return()=>window.removeEventListener('keydown',back);
 },[selected,creating,profiles.length]);
 if(selected)return <App key={selected.id} profile={selected} changeProfile={()=>setSelected(null)}/>;
 return <div className="profile-screen"><QualityImage className="profile-backdrop"/><header className="profile-header"><a className="brand" href="#" onClick={e=>e.preventDefault()}><Brand/></a><FullscreenControl/></header>{creating||!profiles.length?<form className="profile-create" onSubmit={e=>{e.preventDefault();create();}}><h1>{profiles.length?'Añadir perfil':'Crea tu primer perfil'}</h1><input autoFocus aria-label="Nombre del perfil" placeholder="Nombre" value={name} maxLength={24} onChange={e=>setName(e.target.value)}/><div className="profile-types"><button type="button" aria-label="Adulto" className={kind==='adult'?'chosen':''} aria-pressed={kind==='adult'} onClick={()=>{setKind('adult');if(name==='Kids'||!name.trim())setName('Adulto');}}><span className="profile-tile adult"><QualityImage src={avatar('adult')} eager fallback={false}/></span>Adulto</button><button type="button" aria-label="Kids" className={kind==='kids'?'chosen':''} aria-pressed={kind==='kids'} onClick={()=>{setKind('kids');if(name==='Adulto'||!name.trim())setName('Kids');}}><span className="profile-tile kids"><QualityImage src={avatar('kids')} eager fallback={false}/></span>Kids</button></div>{saveError&&<p role="alert">{saveError}</p>}<div className="dialog-actions"><button className="primary" type="submit" disabled={saving||!name.trim()}>{saving?'Guardando…':'Crear perfil'}</button>{profiles.length>0&&<button className="secondary" type="button" onClick={()=>setCreating(false)}>Cancelar</button>}</div></form>:<div className="profile-picker"><h1>¿Quién está viendo?</h1><div className="profile-grid">{profiles.map(p=><button key={p.id} aria-label={displayText(p.name)} onClick={()=>setSelected(p)}><span className={'profile-tile '+p.kind}><QualityImage src={avatar(p.kind)} eager fallback={false}/>{p.kind==='kids'&&<small>kids</small>}</span><span>{displayText(p.name)}</span></button>)}<button onClick={()=>setCreating(true)}><span className="profile-add"><Plus size={48}/></span><span>Añadir perfil</span></button></div></div>}{exitPrompt&&<Dialog label="Salir de Richiflix" close={()=>setExitPrompt(false)}><div className="dialog-body"><h2>¿Terminamos por hoy?</h2><div className="dialog-actions"><button className="primary" onClick={()=>setExitPrompt(false)}>Seguir viendo</button><button className="secondary" onClick={()=>{window.tizen?.application.getCurrentApplication().exit();setExitPrompt(false);}}>Salir</button></div></div></Dialog>}</div>;
}
const disposeDiagnostics=installFocusPaintDiagnostics();
if(import.meta.hot)import.meta.hot.dispose(disposeDiagnostics);
createRoot(document.getElementById('root')).render(<Boot>{profiles=><ProfileGate initialProfiles={profiles}/>}</Boot>);
