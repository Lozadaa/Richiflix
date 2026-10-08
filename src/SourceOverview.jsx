import React from 'react';
import {Radio,Film,Globe,ArrowRight} from 'lucide-react';
import {retainedSources} from './sourceSelection.js';

export function SourceOverview({openLive}){
 return <section className="included-sources" aria-labelledby="included-sources-title">
  <h3 id="included-sources-title">Fuentes incluidas</h3>
  <div className="included-source-list">{retainedSources.map(source=>{
   const Icon=source.type==='playlist'?Radio:source.type==='vod-playlist'?Film:Globe;
   return <article className={`included-source ${source.state}`} key={source.id} aria-label={`Fuente incluida: ${source.name}`}>
    <div className="included-source-heading"><span className="source-icon"><Icon size={24}/></span><div><h4>{source.name}</h4><p>{source.category}</p></div><span className="source-badge">{source.state==='ready'?'Lista disponible':'Pendiente'}</span></div>
    <div className="included-source-targets">{source.targets.map(target=><div key={target.url}><span>{target.name}{source.state==='pending'?` · HTTP ${target.status}`:''}</span><small>{target.url}</small></div>)}</div>
    {source.state==='ready'?<button className="secondary" onClick={openLive}>Ver canales <ArrowRight size={18}/></button>:<p className="source-pending-note">Sin contenido cargado. La dirección necesita actualizarse.</p>}
   </article>;
  })}</div>
 </section>;
}
