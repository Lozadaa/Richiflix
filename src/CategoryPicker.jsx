import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,Check,Search,SlidersHorizontal} from 'lucide-react';
import {createPortal} from 'react-dom';
import {Dialog} from './Dialog.jsx';
import {displayText} from './displayText.js';
const categoryTerm=value=>displayText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function CategoryPicker({categories,value,change,title,compact=false,filterEntry=false}){
 const [opened,setOpened]=useState(false),[query,setQuery]=useState(''),options=useRef(),trigger=useRef(),search=useRef();
 const choices=useMemo(()=>['Todas',...new Set(categories.filter(name=>name!=='Todas'))],[categories]);
 const visible=useMemo(()=>{const term=categoryTerm(query);return term?choices.filter(name=>categoryTerm(name==='Todas'?'Todas las categorías':name).includes(term)):choices;},[choices,query]);
 useEffect(()=>{if(!opened)return;const timer=setTimeout(()=>{const button=options.current?.querySelector('[aria-pressed="true"]');button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',behavior:'instant'});},0);return()=>clearTimeout(timer);},[opened]);
 const navigate=event=>{
  const buttons=[...options.current.querySelectorAll('button')],index=buttons.indexOf(event.target);if(index<0)return;
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[event.key];if(delta===undefined)return;
  if(event.key==='ArrowUp'&&index<3){event.preventDefault();event.stopPropagation();search.current?.focus({preventScroll:true});return;}
  event.preventDefault();event.stopPropagation();
  const next=index+delta;if(next<0||next>=buttons.length)return;
  buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 const searchKeys=event=>{const key=event.key==='Unidentified'?{13:'Enter',40:'ArrowDown',10009:'Escape'}[event.keyCode]:event.key;if(event.nativeEvent.isComposing||!['Enter','ArrowDown','Escape'].includes(key))return;event.preventDefault();event.stopPropagation();if(key==='Escape'){if(query)setQuery('');else setOpened(false);}else options.current?.querySelector('button')?.focus({preventScroll:true});};
 return <><button ref={trigger} className={`category-picker ${filterEntry?'category-filter-entry':''}`} aria-label={`${filterEntry?'Filtrar':'Categorías de'} ${title}${filterEntry?' por categoría':''}`} aria-haspopup="dialog" aria-expanded={opened} onClick={()=>{setQuery('');setOpened(true);}}>{filterEntry&&<SlidersHorizontal aria-hidden="true"/>}<span>{filterEntry?'Filtrar':compact?'Más categorías…':value==='Todas'?'Todas las categorías':displayText(value)}</span><ChevronDown aria-hidden="true"/></button>
 {opened&&createPortal(<Dialog close={()=>setOpened(false)} label={`Categorías de ${title}`}><div className="category-panel"><h2>Filtrar {displayText(title)}</h2><p>Elige una categoría para ver sus títulos. La búsqueda del catálogo conservará este filtro.</p><label className="category-search"><Search aria-hidden="true"/><input ref={search} type="search" data-tv-search="filter" value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={searchKeys} aria-label="Buscar categoría" placeholder="Buscar categoría" autoComplete="off"/></label><div className="category-options" ref={options} onKeyDownCapture={navigate}>{visible.map(name=><button key={name} className="category-option" aria-pressed={name===value} onClick={()=>{change(name);setOpened(false);}}><span>{name==='Todas'?'Todas las categorías':displayText(name)}</span>{name===value&&<Check aria-hidden="true"/>}</button>)}</div>{!visible.length&&<p className="category-no-results" role="status">No hay categorías con ese nombre.</p>}</div></Dialog>,trigger.current?.closest('.app')||document.body)}
 </>;
}
