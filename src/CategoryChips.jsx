import React,{useMemo,useRef} from 'react';
import {Check,Sparkles,Trophy} from 'lucide-react';
import {CategoryPicker} from './CategoryPicker.jsx';
import {displayText} from './displayText.js';
import {scrollViewport,glideViewportBy,viewportRevealDelta} from './virtualViewport.js';
import {restoreVirtualFocus} from './virtualNavigation.js';
import './discovery.css';

export function CategoryChips({categories,collections=[],value,change,title}){
 const strip=useRef(),groups=useMemo(()=>new Map(collections.map(group=>[group.name,group])),[collections]);
 const shown=useMemo(()=>{const ordered=[...new Set(categories)],choices=[...ordered.filter(name=>!groups.has(name)),...ordered.filter(name=>groups.has(name))].slice(0,14);if(value!=='Todas'&&!choices.includes(value))choices.push(value);return ['Todas',...choices.filter(name=>name!=='Todas')];},[categories,value,groups]);
 const reveal=event=>{const target=event.target,root=strip.current;if(!target.matches('button')||!root.contains(target))return;const box=target.getBoundingClientRect(),bounds=root.getBoundingClientRect(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(box.left<bounds.left+8||box.right>bounds.right-8)root.scrollBy({left:box.left<bounds.left?box.left-bounds.left-8:box.right-bounds.right+8,behavior:reduced?'instant':'smooth'});const viewport=scrollViewport(root);if(viewport!==window){const view=viewport.getBoundingClientRect();glideViewportBy(viewport,viewportRevealDelta({top:bounds.top,bottom:bounds.bottom,viewportTop:view.top,height:view.height,margin:12}));}};
 const navigate=event=>{
  const buttons=[...strip.current.querySelectorAll('button')],index=buttons.indexOf(event.target);if(index<0||!event.key.startsWith('Arrow'))return;event.preventDefault();event.stopPropagation();
  if(event.key==='ArrowLeft'||event.key==='ArrowRight'){buttons[index+(event.key==='ArrowRight'?1:-1)]?.focus({preventScroll:true});return;}
  const app=strip.current.closest('.app');if(event.key==='ArrowUp'){(app.querySelector('.has-tv-stage .focus-actions .primary')||app.querySelector('.topbar nav button.active'))?.focus({preventScroll:true});return;}
  const grid=app.querySelector('main .catalog-grid');if(grid){window.dispatchEvent(new CustomEvent('richiflix-catalog-navigation',{detail:{key:'ArrowDown',repeat:event.repeat}}));(restoreVirtualFocus(grid,0)||grid.querySelector('.card-open'))?.focus({preventScroll:true});}
 };
 return <div className="category-chips" role="group" aria-label={`Filtrar ${title} por categoría`} ref={strip} onFocusCapture={reveal} onKeyDownCapture={navigate}>
  <CategoryPicker categories={categories} value={value} change={change} title={title} filterEntry/>
  {shown.map(name=>{const group=groups.get(name),Icon=group?.kind==='ranking'||name.includes('· TMDB')?Trophy:Sparkles;return <button key={name} className={`category-chip ${name===value?'selected':''}`} aria-label={name==='Todas'?'Todas las categorías':displayText(name)} aria-pressed={name===value} title={displayText(name)} onClick={()=>change(name)}>{name===value?<Check aria-hidden="true"/>:group&&<Icon aria-hidden="true"/>}<span>{name==='Todas'?'Todas':displayText(group?.label||name)}</span></button>;})}
 </div>;
}
