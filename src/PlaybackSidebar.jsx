import React,{useEffect,useRef} from 'react';
import {Check} from 'lucide-react';
import './playbackSidebar.css';

// E2: right side panel with every playback option as one vertical list of buttons (never <select>: Tizen's remote cannot open it).
// Player routes the keys (playerKeyAction focus 'sidebar'); OK applies an option and the panel stays open.
export function PlaybackSidebar({sections,focusSection,onClose}){
 const panel=useRef();
 useEffect(()=>{const root=panel.current;(root.querySelector(`[data-section="${focusSection}"] [aria-checked="true"]`)||root.querySelector('[aria-checked="true"]')||root.querySelector('[role="radio"]')||root).focus({preventScroll:true});},[]);
 return <div className="playback-sidebar" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <aside ref={panel} className="playback-sidebar-panel" tabIndex={-1} aria-label="Idioma, subtítulos y opciones">
   {sections.map(section=><section key={section.title} data-section={section.title} role="radiogroup" aria-label={section.title}>
    <h3>{section.title}</h3>
    {section.options.map(option=><button key={option.id} className="sidebar-option" role="radio" aria-checked={option.active} onClick={option.onSelect}><span>{option.label}</span>{option.detail&&<small>{option.detail}</small>}{option.active&&<Check aria-hidden="true"/>}</button>)}
   </section>)}
   {!sections.length&&<p>Esta señal usa su calidad original.</p>}
  </aside>
 </div>;
}
