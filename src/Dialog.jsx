import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,X} from 'lucide-react';
import {motionAllowed} from './interactions.jsx';
import {revealRowFor} from './virtualNavigation.js';
function Dialog({close,children,immersive=false,label='Kingdom',player=false,utility=false,chromeHidden=false,restoreFocus,onKeyDownCapture,tvMode=false,className=''}){
 const ref=useRef(),timer=useRef(),dismissRef=useRef();const [closing,setClosing]=useState(false);
 const dismiss=()=>{if(closing)return;if(!motionAllowed()){close();return;}setClosing(true);timer.current=setTimeout(close,180);};
 dismissRef.current=dismiss;
 useEffect(()=>{
  const back=event=>{if(event.key!=='Escape'||event.defaultPrevented||ref.current!==[...document.querySelectorAll('[role="dialog"]')].pop())return;event.preventDefault();dismissRef.current();};
  window.addEventListener('keydown',back);return()=>window.removeEventListener('keydown',back);
 },[]);
 useEffect(()=>{
  const dialog=ref.current,previous=restoreFocus||document.activeElement,overflow=document.body.style.overflow;
  const backgrounds=[...document.querySelectorAll('.app>.topbar,.app>main')].map(element=>({element,inert:element.inert,hidden:element.getAttribute('aria-hidden')}));
  backgrounds.forEach(({element})=>{element.inert=true;});document.body.style.overflow='hidden';dialog.querySelector(player?'video':'button')?.focus({preventScroll:true});backgrounds.forEach(({element})=>element.setAttribute('aria-hidden','true'));
  const trap=e=>{if(e.key!=='Tab')return;const elements=[...dialog.querySelectorAll('button,input,textarea,select,a,video')].filter(el=>!el.disabled&&!el.closest('[inert]')&&el.getBoundingClientRect().width>0);if(e.shiftKey&&document.activeElement===elements[0]){e.preventDefault();elements[elements.length-1]?.focus();}else if(!e.shiftKey&&document.activeElement===elements[elements.length-1]){e.preventDefault();elements[0]?.focus();}};
  dialog.addEventListener('keydown',trap);
  return()=>{clearTimeout(timer.current);dialog.removeEventListener('keydown',trap);document.body.style.overflow=overflow;backgrounds.forEach(({element,inert,hidden})=>{element.inert=inert;if(hidden===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',hidden);});if(previous?.isConnected)revealRowFor(previous).focus({preventScroll:true});};
 },[]);
 return <div className={`overlay ${immersive?'immersive-overlay':''} ${closing?'is-closing':''}`} onMouseDown={e=>{if(e.target===e.currentTarget)dismiss();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();}}}><div className={`dialog ${immersive?'immersive-dialog':''} ${player?'player-dialog':''} ${player&&tvMode?'tv-player':''} ${utility?'utility-dialog':''} ${chromeHidden?'chrome-hidden':''} ${className}`} role="dialog" aria-modal="true" aria-label={label} ref={ref} onKeyDownCapture={onKeyDownCapture}><button className={`dialog-close ${immersive?'back-button':'circle'}`} aria-label="Cerrar" inert={chromeHidden} onClick={dismiss}>{immersive?<><ArrowLeft size={22}/>{!player&&<span>Volver</span>}</>:<X/>}</button>{children}</div></div>;
}

export {Dialog};
