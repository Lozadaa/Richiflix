export const isTizen=typeof window!=='undefined'&&Boolean(window.tizen?.application);
export const isTVBuild=import.meta.env?.MODE==='tizen'||isTizen;

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
export const remoteKeys={37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',13:'Enter',10009:'Escape',415:'MediaPlay',19:'MediaPause',10252:'MediaPlayPause',413:'MediaStop',412:'MediaRewind',417:'MediaFastForward'};
export function registerRemote(device){
 if(!device)return;
 const supported=new Set(device.getSupportedKeys().map(key=>key.name));
 for(const name of mediaKeyNames)if(supported.has(name)){try{device.registerKey(name);}catch{ /* Some firmware omits optional media keys. */ }}
}

export function installTVPlatform(){
 if(!isTVBuild)return;
 document.documentElement.classList.add('samsung-tv');
 if(isTizen){
  try{registerRemote(window.tizen.tvinputdevice);}catch{}
  // Preserve Samsung's volume and power keys: the TV handles those itself.
  window.addEventListener('keydown',event=>{
   if(event.richiflixRemote)return;
   const key=remoteKeys[event.keyCode];if(!key)return;
   if(event.target.tagName==='SELECT'&&[37,39,13].includes(event.keyCode)){
    event.preventDefault();event.stopImmediatePropagation();const select=event.target;
    if(event.keyCode!==13){
     const next=Math.max(0,Math.min(select.options.length-1,select.selectedIndex+(event.keyCode===39?1:-1)));
     select.selectedIndex=next;select.dispatchEvent(new Event('change',{bubbles:true}));
    }else{
     const scope=select.closest('[role="dialog"]')||document;
     const targets=Array.from(scope.querySelectorAll('button,input,textarea,select,a')).filter(element=>!element.disabled&&!element.closest('[inert]')&&element.getBoundingClientRect().width>0);
     (targets[targets.indexOf(select)+1]||targets[0])?.focus();
    }return;
   }
   if(event.keyCode===10009&&event.target.dataset.tvSearch==='true'){event.preventDefault();event.stopImmediatePropagation();event.target.blur();document.querySelector('.topbar nav button.active')?.focus();return;}
   if(event.keyCode===10009&&['INPUT','TEXTAREA'].includes(event.target.tagName)&&event.target.type!=='range'){
    event.preventDefault();event.stopImmediatePropagation();event.target.blur();
    (event.target.closest('form,[role="dialog"],.topbar')?.querySelector('button:not(:disabled)'))?.focus();return;
   }
   // Text fields must keep native arrow/Enter handling for Samsung's IME.
   if(event.keyCode!==10009&&['INPUT','TEXTAREA'].includes(event.target.tagName)&&event.target.type!=='range'&&!key.startsWith('Media'))return;
   event.preventDefault();event.stopImmediatePropagation();
   const normalized=new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,repeat:event.repeat});
   const dialog=document.querySelector('[role="dialog"]');
   const target=dialog&&['BODY','HTML'].includes(event.target.tagName)?dialog.querySelector('video,button:not(:disabled)')||dialog:event.target;
   if(target!==event.target)target.focus();
   Object.defineProperty(normalized,'richiflixRemote',{value:true});target.dispatchEvent(normalized);
   if(key==='Enter'&&!normalized.defaultPrevented&&target.matches('button,a'))target.click();
  },true);
 }
}
