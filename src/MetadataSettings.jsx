import React,{useEffect,useState} from 'react';
import {displayText} from './displayText.js';
import {xtreamClient} from './xtreamClient.js';
import {RotateCcw} from 'lucide-react';
import {defaultMetadataToken} from './metadataDefaults.js';
export function MetadataSettings({changed}){
 const [status,setStatus]=useState({configured:false,isDefault:false}),[token,setToken]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{xtreamClient().metadataStatus().then(setStatus).catch(()=>{});},[]);
 async function saveToken(value){setSaving(true);setError('');try{setStatus(await xtreamClient().metadataSave(value));setToken('');changed();}catch(error){setError(error.message);}finally{setSaving(false);}}
 return <section className="metadata-settings"><h3>Sinopsis en español</h3><p>TMDB completa la información del IPTV en español cuando está disponible.</p><form onSubmit={event=>{event.preventDefault();saveToken(token);}}><label>API key o token de lectura de TMDB<input type="password" autoComplete="off" value={token} onChange={event=>setToken(event.target.value)} aria-label="Token TMDB" placeholder={status.configured?(status.isDefault?'Tu clave preconfigurada':'Guardado'):'Pega tu token'}/></label><div className="dialog-actions"><button className="secondary" disabled={saving||!token.trim()}>{saving?'Comprobando…':'Guardar token'}</button>{status.configured&&<button className="secondary" type="button" disabled={saving} onClick={()=>saveToken('')}>Desconectar TMDB</button>}{defaultMetadataToken&&!status.isDefault&&<button className="secondary" type="button" disabled={saving} onClick={()=>saveToken(defaultMetadataToken)}><RotateCcw size={18}/>Restaurar mi clave</button>}</div></form>{error&&<p role="alert">{displayText(error)}</p>}{status.configured&&<small>{status.isDefault?'Tu clave de TMDB':'TMDB conectado'} · Español preferido</small>}<div className="metadata-credit"><span>TMDB</span><small>This product uses the TMDB API but is not endorsed or certified by TMDB.</small></div></section>;
}
