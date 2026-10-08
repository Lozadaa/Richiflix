import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ArrowRight,Keyboard,ArrowLeft} from 'lucide-react';
import {isTVBuild} from './platform.js';
import {isTextField,inputReturnHint,nextInputControl,textInputAction} from './tvTextInput.js';
import './tvTextInput.css';
let inputBoundary;
export function installTVInputBoundary(){
 const key=event=>inputBoundary?.(event);
 window.addEventListener('keydown',key,true);window.addEventListener('keyup',key,true);
 return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('keyup',key,true);};
}

// Independent of App, forms and catalogue navigation: native IME owns typing;
// this boundary owns finishing it. No scans or React updates on text input.
export function TVTextInput(){
 const [field,setField]=useState(null),active=useRef(null),finish=useRef(),bypass=useRef(new WeakSet());
 useEffect(()=>{
  const enabled=element=>isTextField(element)&&!element.disabled&&!element.readOnly&&(isTVBuild||Boolean(element.closest('.tv-mode')));
  let consumed=null;
  const exit=(element,done)=>{
   if(!element?.isConnected)return;
   active.current=null;setField(null);
   if(done&&element.dataset.tvSearch){
    // Reuse the existing asynchronous search/filter completion and focus rules.
    const event=new KeyboardEvent('keydown',{key:'Enter',keyCode:13,which:13,bubbles:true,cancelable:true});bypass.current.add(event);element.dispatchEvent(event);
    if(document.activeElement===element){element.blur();nextInputControl(element)?.focus({preventScroll:true});}
    return;
   }
   element.blur();
   if(done)nextInputControl(element)?.focus({preventScroll:true});
   else{const scope=element.closest('[role="dialog"],form');(scope?.querySelector('button:not(:disabled)')||document.querySelector('.topbar nav button.active,.profile-grid button'))?.focus({preventScroll:true});}
  };
  finish.current=done=>exit(active.current,done);
  const focus=event=>{
   if(event.target.closest?.('.tv-input-actions'))return;
   const element=event.target;
   if(enabled(element)){element.setAttribute('enterkeyhint',inputReturnHint(element));active.current=element;setField(element);}
   else{active.current=null;setField(null);}
  };
  const key=event=>{
   if(bypass.current.has(event))return;
   const action=textInputAction(event),code=event.keyCode||event.key;
   // A held/released Return must not escape into a dialog or the app after blur.
   if(consumed&&consumed.code===code&&(event.type==='keyup'||event.repeat)&&performance.now()-consumed.at<600){event.preventDefault();event.stopImmediatePropagation();if(event.type==='keyup')consumed=null;return;}
   if(event.type!=='keydown'||!action||!enabled(event.target))return;
   event.preventDefault();event.stopImmediatePropagation();consumed={code,at:performance.now()};exit(event.target,action==='done');
  };
  inputBoundary=key;window.addEventListener('focusin',focus,true);
  return()=>{finish.current=null;if(inputBoundary===key)inputBoundary=null;window.removeEventListener('focusin',focus,true);};
 },[]);
 if(!field?.isConnected)return null;
 const search=Boolean(field.dataset.tvSearch),next=inputReturnHint(field)==='next';
 return createPortal(<div className="tv-input-actions" role="group" aria-label="Terminar de escribir"><span className="tv-input-hint"><Keyboard aria-hidden="true"/><span>{search?'Escribe y elige Listo para buscar':'Elige Listo en el teclado para continuar'}</span></span><button className="tv-input-done" onPointerDown={event=>event.preventDefault()} onClick={()=>finish.current?.(true)}>{search?<ArrowRight aria-hidden="true"/>:<Check aria-hidden="true"/>}{search?'Ver resultados':next?'Siguiente campo':'Listo'}</button><button className="tv-input-leave" onPointerDown={event=>event.preventDefault()} onClick={()=>finish.current?.(false)}><ArrowLeft aria-hidden="true"/>Terminar edición</button></div>,document.body);
}
