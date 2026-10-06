import React,{useState} from 'react';
import {RefreshCw,KeyRound,Check,Plus,Trash2,RotateCcw,Pin} from 'lucide-react';
import {displayText} from './displayText.js';
import {xtreamClient} from './xtreamClient.js';
import {defaultSource} from './sourceDefaults.js';
const blank={sourceId:'',name:'',host:'',username:'',password:''};
export function XtreamSettings({catalogue}){
 const [form,setForm]=useState({...blank,name:defaultSource?.name||'Mi IPTV',host:defaultSource?.host||''}),[editing,setEditing]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const sources=catalogue.sources||catalogue.connection.sources||[],configured=catalogue.connection.configured;
 const edit=source=>{setForm({...blank,sourceId:source.id,name:source.name,host:source.host});setError('');setEditing(true);};
 async function action(work){setSaving(true);setError('');try{await work();setForm(blank);setEditing(false);await catalogue.refresh(true);}catch(error){setError(error.message||'No se pudo guardar la fuente.');}finally{setSaving(false);}}
 const submit=event=>{event.preventDefault();action(()=>xtreamClient().save({...form,sourceId:configured?form.sourceId:'eterboxtv'}));};
 return <section className="xtream-settings" aria-labelledby="xtream-title">
  <div className="sources-heading"><div><h3 id="xtream-title">Tus fuentes</h3><span className="settings-eyebrow">Xtream Codes API</span></div><button className="secondary" disabled={saving} onClick={()=>{setForm(blank);setError('');setEditing(true);}}><Plus size={20}/> Agregar fuente</button></div>
  {sources.map(source=><article className="xtream-source" key={source.id} data-source-id={source.id}>
   <div className="sources-heading"><h4>{displayText(source.name)}</h4><span className="source-badge">{source.pinned?<><Pin size={17}/> Principal</>:'Login guardado'}</span></div>
   <p className="xtream-host">{source.host}</p>
   {source.channels!==undefined&&<p className="xtream-counts">{source.channels.toLocaleString('es-CL')} canales · {source.movies.toLocaleString('es-CL')} películas · {source.shows.toLocaleString('es-CL')} series</p>}
   {source.error&&<p role="alert" className="source-error">{displayText(source.error)}</p>}
   <div className="dialog-actions"><button className="secondary" disabled={saving} onClick={()=>edit(source)}><KeyRound size={18}/> Cambiar login</button>{source.pinned?(defaultSource&&<button className="secondary" disabled={saving} onClick={()=>action(()=>xtreamClient().restore())}><RotateCcw size={18}/> Restaurar eterboxtv</button>):<button className="secondary" disabled={saving} onClick={()=>action(()=>xtreamClient().remove(source.id))}><Trash2 size={18}/> Quitar fuente</button>}</div>
  </article>)}
  {(error||catalogue.error)&&<p role="alert" className="source-error">{displayText(error||catalogue.error)}</p>}
  {catalogue.loading&&<p role="status">Cargando tus fuentes…</p>}
  {editing||!configured?<form className="source-editor" onSubmit={submit}>
   <label>Nombre<input required aria-label="Nombre Xtream" value={form.name} maxLength={80} onChange={event=>setForm({...form,name:event.target.value})}/></label>
   <label>Servidor<input required type="url" aria-label="Servidor Xtream" value={form.host} onChange={event=>setForm({...form,host:event.target.value})}/></label>
   <label>Usuario<input required autoComplete="off" aria-label="Usuario Xtream" value={form.username} onChange={event=>setForm({...form,username:event.target.value})}/></label>
   <label>Contraseña<input required type="password" autoComplete="new-password" aria-label="Contraseña Xtream" value={form.password} onChange={event=>setForm({...form,password:event.target.value})}/></label>
   <div className="dialog-actions"><button className="primary" disabled={saving} type="submit"><Check size={18}/>{saving?'Conectando…':'Conectar'}</button>{configured&&<button className="secondary" type="button" disabled={saving} onClick={()=>{setEditing(false);setForm(blank);}}>Cancelar</button>}</div>
  </form>:<div className="dialog-actions"><button className="secondary" disabled={catalogue.loading||saving} onClick={()=>catalogue.refresh(true)}><RefreshCw size={18}/> Actualizar catálogo</button></div>}
 </section>;
}
