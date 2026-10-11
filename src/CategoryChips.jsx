import React,{useCallback,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Sparkles,Trophy} from 'lucide-react';
import {CategoryPicker} from './CategoryPicker.jsx';
import {displayText} from './displayText.js';
import {scrollViewport,glideViewportBy,viewportRevealDelta} from './virtualViewport.js';
import {restoreVirtualFocus,revealRowFor} from './virtualNavigation.js';
import './discovery.css';

// `more` (live pages): fixed chips first, provider categories in the picker as the last chip.
// `preview(name)`: a chip was focused or hovered (the «Fútbol» page warms that competition's table).
export function CategoryChips({categories,collections=[],value,change,title,allLabel='Todas',more,limit=14,preview}){
 const strip=useRef(),groups=useMemo(()=>new Map(collections.map(group=>[group.name,group])),[collections]);
 const shown=useMemo(()=>{const ordered=[...new Set(categories)],choices=[...ordered.filter(name=>!groups.has(name)),...ordered.filter(name=>groups.has(name))].slice(0,limit);if(value!=='Todas'&&!choices.includes(value))choices.push(value);return ['Todas',...choices.filter(name=>name!=='Todas')];},[categories,value,groups,limit]);
 const reveal=event=>{const target=event.target,root=strip.current;if(!target.matches('button')||!root.contains(target))return;const box=target.getBoundingClientRect(),bounds=root.getBoundingClientRect(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(box.left<bounds.left+8||box.right>bounds.right-8)root.scrollBy({left:box.left<bounds.left?box.left-bounds.left-8:box.right-bounds.right+8,behavior:reduced?'instant':'smooth'});const viewport=scrollViewport(root);if(viewport!==window){const view=viewport.getBoundingClientRect();glideViewportBy(viewport,viewportRevealDelta({top:bounds.top,bottom:bounds.bottom,viewportTop:view.top,height:view.height,margin:12}));}};
 const navigate=event=>{
  const buttons=[...strip.current.querySelectorAll('button')],index=buttons.indexOf(event.target);if(index<0||!event.key.startsWith('Arrow'))return;
  // Live rows, empty-state actions or the «Fútbol» league panel below: Down goes to the first of them (useRemoteNavigation owns that memory).
  if(event.key==='ArrowDown'&&strip.current.closest('main')?.querySelector('.catalog-row .cards,.empty-state:not([role=alert]) .empty-state-actions button,.league-stats button'))return;
  event.preventDefault();event.stopPropagation();
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){buttons[index+(event.key==='ArrowRight'?1:-1)]?.focus({preventScroll:true});return;}
  const app=strip.current.closest('.app');if(event.key==='ArrowUp'){(app.querySelector('.has-tv-stage .focus-actions .primary')||app.querySelector('.topbar nav button.active'))?.focus({preventScroll:true});return;}
  const grid=app.querySelector('main .catalog-grid');if(grid){window.dispatchEvent(new CustomEvent('richiflix-catalog-navigation',{detail:{key:'ArrowDown',repeat:event.repeat}}));revealRowFor(restoreVirtualFocus(grid,0)||grid.querySelector('.card-open'))?.focus({preventScroll:true});}
 };
 // Arrows for the pointer when chips overflow: they page the strip and fade in only on the side with hidden chips.
 // Out of the tab order (tabIndex -1): the remote and the keyboard already scroll the strip while walking the chips.
 const [edges,setEdges]=useState({start:false,end:false});
 const measure=useCallback(()=>{const root=strip.current;if(!root)return;const start=root.scrollLeft>4,end=root.scrollLeft+root.clientWidth<root.scrollWidth-4;setEdges(previous=>previous.start===start&&previous.end===end?previous:{start,end});},[]);
 useLayoutEffect(()=>{measure();if(!window.ResizeObserver)return;const observer=new ResizeObserver(measure);observer.observe(strip.current);return()=>observer.disconnect();},[measure,shown]);
 const page=direction=>{const root=strip.current;root.scrollBy({left:direction*Math.max(240,root.clientWidth*0.7),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});};
 return <div className="category-chips-wrap" data-start={edges.start?'':undefined} data-end={edges.end?'':undefined}><div className="category-chips" role="group" aria-label={`Filtrar ${title} por categoría`} ref={strip} onFocusCapture={reveal} onKeyDownCapture={navigate} onScroll={measure}>
  {!more&&<CategoryPicker categories={categories} value={value} change={change} title={title} filterEntry/>}
  {shown.map(name=>{const group=groups.get(name),Icon=group?.kind==='ranking'||name.includes('· TMDB')?Trophy:Sparkles;return <button key={name} className={`category-chip ${name===value?'selected':''}`} aria-label={name==='Todas'?(allLabel==='Todas'?'Todas las categorías':allLabel):displayText(name)} aria-pressed={name===value} title={displayText(name)} onClick={()=>change(name)} onFocus={preview?()=>preview(name):undefined} onMouseEnter={preview?()=>preview(name):undefined}>{name===value?<Check aria-hidden="true"/>:group&&<Icon aria-hidden="true"/>}<span>{name==='Todas'?allLabel:displayText(group?.label||name)}</span></button>;})}
  {more&&<CategoryPicker categories={more} value={value} change={change} title={title} compact/>}
 </div>
  <button className="chips-arrow chips-prev" tabIndex={-1} aria-label="Ver categorías anteriores" onClick={()=>page(-1)}><ChevronLeft aria-hidden="true"/></button>
  <button className="chips-arrow chips-next" tabIndex={-1} aria-label="Ver más categorías" onClick={()=>page(1)}><ChevronRight aria-hidden="true"/></button>
 </div>;
}
