import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,Check} from 'lucide-react';
import {createPortal} from 'react-dom';
import {Dialog} from './Dialog.jsx';
import {displayText} from './displayText.js';
export function CategoryPicker({categories,value,change,title,compact=false}){
 const [opened,setOpened]=useState(false),options=useRef(),trigger=useRef();
 useEffect(()=>{if(!opened)return;const timer=setTimeout(()=>{const button=options.current?.querySelector('[aria-pressed="true"]');button?.focus({preventScroll:true});button?.scrollIntoView({block:'nearest',behavior:'instant'});},0);return()=>clearTimeout(timer);},[opened]);
 const navigate=event=>{
  const buttons=[...options.current.querySelectorAll('button')],index=buttons.indexOf(event.target);if(index<0)return;
  const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[event.key];if(delta===undefined)return;
  if(event.key==='ArrowUp'&&index<3)return;
  event.preventDefault();event.stopPropagation();
  const next=index+delta;if(next<0||next>=buttons.length)return;
  buttons[next].focus({preventScroll:true});buttons[next].scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 };
 return <><button ref={trigger} className="category-picker" aria-label={`Categorías de ${title}`} aria-haspopup="dialog" aria-expanded={opened} onClick={()=>setOpened(true)}><span>{compact?'Más categorías':value==='Todas'?'Todas las categorías':displayText(value)}</span><ChevronDown aria-hidden="true"/></button>
 {opened&&createPortal(<Dialog close={()=>setOpened(false)} label={`Categorías de ${title}`}><div className="category-panel"><h2>{displayText(title)}</h2><p>Elige tu próxima historia</p><div className="category-options" ref={options} onKeyDownCapture={navigate}>{['Todas',...categories.filter(name=>name!=='Todas')].map(name=><button key={name} className="category-option" aria-pressed={name===value} onClick={()=>{change(name);setOpened(false);}}><span>{name==='Todas'?'Todas las categorías':displayText(name)}</span>{name===value&&<Check aria-hidden="true"/>}</button>)}</div></div></Dialog>,trigger.current?.closest('.app')||document.body)}
 </>;
}
