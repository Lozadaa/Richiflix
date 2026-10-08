import React,{memo,useEffect,useRef} from 'react';
import {VirtualCarousel} from './VirtualCarousel.jsx';
import {VirtualCatalogue} from './VirtualCatalogue.jsx';
import {CategoryChips} from './CategoryChips.jsx';
import {LIVE_HUB_CHIPS} from './liveEvents.js';
import {restoreVirtualFocus} from './virtualNavigation.js';

// Fase L3: «TV en vivo» and «MLB» as event rows by phase over one virtual grid of 24 h channels.
// Rows come from liveHubRows (memoized in App, which also takes the banner's first title from them).
// Same virtual rails (≤11 cells) and grid (≤40) as the rest of the app; nothing new per second.
// Memoized with flat, stable props: App rerenders on preview/banner state never touch the hub.
export const LiveHub=memo(function LiveHub({title,subtitle,hub,categories,category,setCategory,loading,chips=LIVE_HUB_CHIPS,...props}){
 const root=useRef(),focusedId=useRef();
 // A game that changes phase moves to another row; if its card had focus, focus follows it there (rare, never per key).
 useEffect(()=>{const id=focusedId.current,active=document.activeElement;if(!id||active&&active!==document.body)return;const rails=root.current.querySelectorAll('.catalog-row .cards');hub.rows.forEach((row,index)=>{const at=row.items.findIndex(item=>item.id===id);if(at>=0&&rails[index])restoreVirtualFocus(rails[index],at);});},[hub]);
 return <section className="live-hub" ref={root} onFocus={event=>{const card=event.target.closest('.card');if(card)focusedId.current=card.dataset.contentId;}}>
  <div className="page-title live-hub-title"><h1>{title}</h1><p>{subtitle}</p></div>
  <div className="catalog-controls has-category-chips"><CategoryChips categories={chips} value={category} change={setCategory} title={title} allLabel="Todo" more={categories}/></div>
  {hub.rows.map(row=><div key={row.key} className={row.ended?'live-hub-ended':undefined}><VirtualCarousel title={row.title} items={row.items} {...props}/></div>)}
  {hub.channels.length>0&&<section className="live-hub-channels" aria-label="Canales"><div className="row-heading"><h2>Canales</h2><p className="catalog-count">{hub.channels.length.toLocaleString('es-CL')} {hub.channels.length===1?'canal':'canales'}</p></div><VirtualCatalogue items={hub.channels} instancePrefix="live-channels" {...props}/></section>}
  {!hub.rows.length&&!hub.channels.length&&!loading&&<div className="empty-inline empty-action"><p>Sin señales en esta categoría.</p>{category!=='Todas'&&<button className="secondary" onClick={()=>setCategory('Todas')}>Ver todo</button>}</div>}
 </section>;
});
