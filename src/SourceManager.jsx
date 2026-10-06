import React,{useRef,useState} from 'react';
import {Plus,Link2,Radio,Film,Globe,RefreshCw,Pencil,Trash2,X,ArrowRight} from 'lucide-react';
import {prepareSource} from './manualSources.js';
const blank={name:'',url:'',type:'playlist',image:''};
const types={playlist:{label:'Lista IPTV',icon:Radio},vod:{label:'Vídeo directo',icon:Film},live:{label:'Señal en vivo',icon:Radio},provider:{label:'Plataforma web',icon:Globe}};
export function SourceManager({manager}){
 const {sources,loading,error:loadError,upsert,remove}=manager;
 const [editing,setEditing]=useState(null),[form,setForm]=useState(blank),[busy,setBusy]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const addRef=useRef();
 const edit=source=>{setForm(source?{name:source.name,url:source.url,type:source.type,image:source.image}:blank);setEditing(source?.id||'new');setError('');setSuccess('');};
 const dismiss=()=>{setEditing(null);setError('');requestAnimationFrame(()=>addRef.current?.focus({preventScroll:true}));};
 const submit=async e=>{
  e.preventDefault();setBusy('save');setError('');setSuccess('');
  try{
   const previous=sources.find(source=>source.id===editing),source=await prepareSource(form,previous);
   if(sources.some(item=>item.id!==source.id&&item.url===source.url&&item.type===source.type))throw Error('Esta fuente ya está en tu biblioteca.');
   await upsert(source);dismiss();setSuccess(`${source.name} ${previous?'actualizada':'añadida'}${source.type==='playlist'?` · ${source.items.length.toLocaleString('es-CL')} emisiones`:''}`);
  }catch(e){setError(e.message||'No pudimos guardar la fuente.');}finally{setBusy('');}
 };
 const refresh=async source=>{setBusy(source.id);setError('');setSuccess('');try{const updated=await prepareSource(source,source,true);await upsert(updated);setSuccess(`${source.name} actualizada · ${updated.items.length.toLocaleString('es-CL')} emisiones`);}catch(e){setError(e.message||'No pudimos actualizar la fuente. Se conserva su contenido anterior.');}finally{setBusy('');}};
 const erase=async source=>{setBusy(source.id);setError('');try{await remove(source.id);if(editing===source.id)dismiss();setSuccess(`${source.name} eliminada`);}catch{setError('No pudimos eliminar la fuente.');}finally{setBusy('');}};
 return <section className="source-manager" aria-labelledby="sources-title">
  <div className="sources-heading"><div><h3 id="sources-title">Tus fuentes</h3></div><button className="secondary" ref={addRef} disabled={loading||Boolean(busy)} onClick={()=>edit()}><Plus size={18}/> Añadir fuente</button></div>
  {loading&&<p role="status">Cargando tus fuentes…</p>}
  {(error||loadError)&&<p className="source-error" role="alert">{error||loadError}</p>}
  {success&&<p className="source-success" role="status">{success}</p>}
  {editing&&<form className="source-editor" onSubmit={submit} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!busy)dismiss();}}}>
   <div className="source-editor-heading"><h4>{editing==='new'?'Nueva fuente':'Editar fuente'}</h4><button type="button" className="circle" aria-label="Cancelar edición de fuente" disabled={Boolean(busy)} onClick={dismiss}><X size={18}/></button></div>
   <label>Nombre<input autoFocus required maxLength={80} aria-label="Nombre de la fuente" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Mi colección" disabled={Boolean(busy)}/></label>
   <label>Tipo<select aria-label="Tipo de fuente" value={form.type} onChange={e=>setForm({...form,type:e.target.value})} disabled={Boolean(busy)}><option value="playlist">Lista IPTV · M3U</option><option value="vod">Vídeo directo · MP4, WebM, HLS</option><option value="live">Señal en vivo · HLS</option><option value="provider">Plataforma web</option></select></label>
   <label>Dirección<input required type="url" aria-label="URL de la fuente" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} placeholder={form.type==='playlist'?'https://…/lista.m3u':'https://…'} disabled={Boolean(busy)}/></label>
   {form.type!=='playlist'&&<label>Portada <span>opcional</span><input type="url" aria-label="Portada de la fuente" value={form.image} onChange={e=>setForm({...form,image:e.target.value})} placeholder="https://…/portada.jpg" disabled={Boolean(busy)}/></label>}
   <button className="primary" type="submit" disabled={Boolean(busy)}>{busy==='save'?'Leyendo fuente…':editing==='new'?'Guardar fuente':'Guardar cambios'} <ArrowRight size={18}/></button>
  </form>}
  {!loading&&!sources.length&&!editing&&<div className="sources-empty"><Link2 size={24}/><p>Trae tus listas, vídeos y plataformas.</p></div>}
  <div className="source-list">{sources.map(source=>{const type=types[source.type],Icon=type?.icon||Link2;let host='';try{host=new URL(source.url).host;}catch{}return <article className="source-item" key={source.id} aria-label={`Fuente: ${source.name}`}><span className="source-icon"><Icon size={22}/></span><div className="source-info"><h4>{source.name}</h4><p>{type?.label}{source.type==='playlist'?` · ${source.items.length.toLocaleString('es-CL')} emisiones`:''}</p><small>{host}</small></div><div className="source-actions">{source.type==='playlist'&&<button className={`circle ${busy===source.id?'source-updating':''}`} aria-label={`Actualizar ${source.name}`} disabled={Boolean(busy)} onClick={()=>refresh(source)}><RefreshCw size={17}/></button>}<button className="circle" aria-label={`Editar ${source.name}`} disabled={Boolean(busy)} onClick={()=>edit(source)}><Pencil size={17}/></button><button className="circle" aria-label={`Eliminar ${source.name}`} disabled={Boolean(busy)} onClick={()=>erase(source)}><Trash2 size={17}/></button></div></article>;})}</div>
 </section>;
}
