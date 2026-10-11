import {createAndroidAVPlay} from './androidAVPlay.js';
import {isTextField} from './tvTextInput.js';
export const isTizen=typeof window!=='undefined'&&Boolean(window.tizen?.application);
// Android TV / Google TV: the app's native shell (android/) exposes KingdomNative (ExoPlayer, remote keys).
export const isAndroidTV=typeof window!=='undefined'&&Boolean(window.KingdomNative);
export const isTVBuild=import.meta.env?.MODE==='tizen'||import.meta.env?.MODE==='android'||isTizen||isAndroidTV;
// Video plays in the TV's own player (Samsung AVPlay, Android ExoPlayer) behind the page, not in <video>.
export const nativePlayback=isTizen||isAndroidTV;
// Android: the same AVPlay-shaped API Player.jsx already drives on Samsung.
if(isAndroidTV&&!window.webapis?.avplay)window.webapis={...window.webapis,avplay:createAndroidAVPlay(window.KingdomNative)};

// Leave the TV app (the profile screen's «Salir»).
export function exitApp(){
 if(isTizen)window.tizen.application.getCurrentApplication().exit();
 else if(isAndroidTV)window.KingdomNative.exit?.();
}
export function uuid(){
 if(globalThis.crypto.randomUUID)return globalThis.crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export async function fetchPlaylist(url){
 const address=new URL(url);if(!['http:','https:'].includes(address.protocol))throw Error('Usa una URL HTTP o HTTPS.');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);let reader;
 try{
  const response=await fetch(address.href,{signal:controller.signal});if(!response.ok)throw Error(`HTTP ${response.status}`);
  reader=response.body.getReader();const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8*1024*1024)throw Error('La lista supera los 8 MB.');chunks.push(value);}
  const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(data);
 }finally{clearTimeout(timeout);await reader?.cancel().catch(()=>{});}
}

export function openTVSource(url){
 return new Promise((resolve,reject)=>{
  try{const address=new URL(url);if(!['http:','https:'].includes(address.protocol))throw Error('Dirección no válida.');
   const control=new window.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view',address.href);
   window.tizen.application.launchAppControl(control,null,resolve,reject);
  }catch(error){reject(error);}
 });
}

export const mediaKeyNames=['MediaPlay','MediaPause','MediaPlayPause','MediaStop','MediaRewind','MediaFastForward'];
export const remoteKeys={37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',13:'Enter',10009:'Escape',415:'MediaPlay',19:'MediaPause',10252:'MediaPlayPause',413:'MediaStop',412:'MediaRewind',417:'MediaFastForward',427:'ChannelUp',428:'ChannelDown'};
export function registerRemote(device){
 if(!device)return;
 const supported=new Set(device.getSupportedKeys().map(key=>key.name));
 // ChannelUp/ChannelDown switch signal or channel in the player (Fase L6); registered only when the firmware lists them.
 for(const name of [...mediaKeyNames,'ChannelUp','ChannelDown'])if(supported.has(name)){try{device.registerKey(name);}catch{ /* Some firmware omits optional media keys. */ }}
}

// One remote key, Samsung keyCode numbering (remoteKeys). Returns true when the page handled it.
function handleRemoteKey({keyCode,target,repeat=false}){
 const key=remoteKeys[keyCode];if(!key)return false;
 if(target.tagName==='SELECT'&&[37,39,13].includes(keyCode)){
  const select=target;
  if(keyCode!==13){
   const next=Math.max(0,Math.min(select.options.length-1,select.selectedIndex+(keyCode===39?1:-1)));
   select.selectedIndex=next;select.dispatchEvent(new Event('change',{bubbles:true}));
  }else{
   const scope=select.closest('[role="dialog"]')||document;
   const targets=Array.from(scope.querySelectorAll('button,input,textarea,select,a')).filter(element=>!element.disabled&&!element.closest('[inert]')&&element.getBoundingClientRect().width>0);
   (targets[targets.indexOf(select)+1]||targets[0])?.focus();
  }return true;
 }
 if(keyCode===10009&&target.dataset.tvSearch==='true'){target.blur();document.querySelector('.topbar nav button.active')?.focus();return true;}
 if(keyCode===10009&&target.dataset.tvSearch==='filter'){
  const back=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});Object.defineProperty(back,'richiflixRemote',{value:true});target.dispatchEvent(back);return true;
 }
 if(keyCode===10009&&['INPUT','TEXTAREA'].includes(target.tagName)&&target.type!=='range'){
  target.blur();(target.closest('form,[role="dialog"],.topbar')?.querySelector('button:not(:disabled)'))?.focus();return true;
 }
 const normalized=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,repeat});
 const dialog=document.querySelector('[role="dialog"]');
 const destination=dialog&&['BODY','HTML'].includes(target.tagName)?dialog.querySelector('video,button:not(:disabled)')||dialog:target;
 if(destination!==target)destination.focus();
 Object.defineProperty(normalized,'richiflixRemote',{value:true});destination.dispatchEvent(normalized);
 if(key==='Enter'&&!normalized.defaultPrevented&&destination.matches('button,a'))destination.click();
 return normalized.defaultPrevented;
}
// Android shell → page: Back and the media/channel keys arrive as names (D-pad and OK reach the WebView natively).
const ANDROID_KEYS={Back:10009,MediaPlay:415,MediaPause:19,MediaPlayPause:10252,MediaStop:413,MediaRewind:412,MediaFastForward:417,ChannelUp:427,ChannelDown:428};

export function installTVPlatform(){
 if(!isTVBuild)return;
 // `samsung-tv` is the historical name of the TV-device styling (10-foot sizes, focus ring, short transitions, transparent
 // page over the native video plane): Android TV takes it too, plus `android-tv` for what is only Android's.
 document.documentElement.classList.add('samsung-tv');if(isAndroidTV)document.documentElement.classList.add('android-tv');
 if(isAndroidTV){
  // Text fields: Android opens its keyboard as soon as an editable field takes focus and the keyboard then owns the
  // arrows. Here a field reached with the remote rests (inputmode=none, data-tv-idle) and is walked past like a button;
  // OK starts typing (keyboard shown by the shell); leaving the field puts it back at rest.
  const editable=element=>isTextField(element)&&!element.disabled&&!element.readOnly;
  // On window, capture: installed before React mounts, so it runs ahead of TVTextInput's own focus listener.
  window.addEventListener('focusin',event=>{const field=event.target;if(editable(field)&&field.dataset.tvEditing!=='true'){field.setAttribute('inputmode','none');field.dataset.tvIdle='true';}},true);
  window.addEventListener('focusout',event=>{
   const field=event.target;if(!editable(field))return;
   // «Siguiente campo» moves straight to the next field: it keeps the open keyboard and is edited right away.
   if(field.dataset.tvEditing==='true'&&editable(event.relatedTarget))event.relatedTarget.dataset.tvEditing='true';
   delete field.dataset.tvIdle;delete field.dataset.tvEditing;field.removeAttribute('inputmode');
  },true);
  // Refocus as an editing field (no inputmode=none): the WebView then opens the keyboard and TVTextInput shows its «Listo» bar.
  const startEditing=field=>{field.blur();field.dataset.tvEditing='true';field.focus({preventScroll:true});};
  // The WebView swallows the remote's OK on a text field (no keydown): the shell reports it here.
  // A WebView that does deliver Enter goes through the keydown below.
  // Back closed the keyboard (MainActivity): the field rests again, still focused, and the arrows leave it.
  window.__kingdomKeyboardClosed=()=>{const field=document.activeElement;if(!editable(field)||field.dataset.tvEditing!=='true')return;field.blur();field.focus({preventScroll:true});};
  window.__kingdomOk=()=>{const field=document.activeElement;if(!editable(field)||field.dataset.tvIdle!=='true')return 'none';startEditing(field);return 'editing';};
  window.addEventListener('keydown',event=>{
   const field=event.target;if(!editable(field)||field.dataset.tvIdle!=='true'||(event.key!=='Enter'&&event.keyCode!==13))return;
   event.preventDefault();event.stopImmediatePropagation();startEditing(field);
  },true);
  // 'handled' keeps the app; 'unhandled' Back lets the shell offer «Atrás otra vez para salir».
  window.__kingdomRemote=name=>{
   const keyCode=ANDROID_KEYS[name];if(!keyCode)return 'unhandled';
   const target=document.activeElement||document.body;
   if(handleRemoteKey({keyCode,target})||name!=='Back'||document.querySelector('[role="dialog"]'))return 'handled';
   // Back with nothing left to close: first to the main menu, then (from there) the shell's «Atrás otra vez para salir».
   const menu=document.querySelector('.topbar nav button.active');
   if(menu&&!target.closest?.('.topbar')){menu.focus();window.scrollTo({top:0});return 'handled';}
   return 'unhandled';
  };
 }
 if(isTizen){
  try{registerRemote(window.tizen.tvinputdevice);}catch{}
  // D2: some firmware repeats a held key without `repeat`; a second keydown of the same key within 180 ms (no keyup between) is a repeat.
  let heldKey=0,heldAt=0;window.addEventListener('keyup',event=>{if(event.keyCode===heldKey)heldKey=0;},true);
  // Preserve Samsung's volume and power keys: the TV handles those itself.
  window.addEventListener('keydown',event=>{
   if(event.richiflixRemote)return;
   const key=remoteKeys[event.keyCode];if(!key)return;
   const at=performance.now(),repeat=event.repeat||(event.keyCode===heldKey&&at-heldAt<180);heldKey=event.keyCode;heldAt=at;
   // Text fields must keep native arrow/Enter handling for Samsung's IME.
   const field=['INPUT','TEXTAREA'].includes(event.target.tagName)&&event.target.type!=='range';
   if(field&&event.keyCode!==10009&&!/^(?:Media|Channel)/.test(key))return;
   event.preventDefault();event.stopImmediatePropagation();
   handleRemoteKey({keyCode:event.keyCode,target:event.target,repeat});
  },true);
 }
}
