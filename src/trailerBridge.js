const CHANNEL='richiflix-trailer',VERSION=1;
const VIDEO_ID=/^[a-zA-Z0-9_-]{11}$/;
const SESSION=/^[a-f0-9]{64}$/;
const PLAYER_STATES=new Set([-1,0,1,2,3,5]);

function localHost(hostname){
 const host=hostname.toLowerCase().replace(/^\[|\]$/g,'');
 if(host==='localhost'||host.endsWith('.localhost')||host==='::1')return true;
 // URL normalizes IPv4 spelling before this check, including integer/hex forms.
 const parts=host.split('.');
 if(parts.length===4&&parts.every(part=>/^\d{1,3}$/.test(part)&&Number(part)<=255)){
  const [a,b]=parts.map(Number);
  return a===127||a===10||a===172&&b>=16&&b<=31||a===192&&b===168;
 }
 return /^[fF][cCdD][a-fA-F0-9]{2}:/.test(host)||/^fe[89ab][a-f0-9]:/.test(host);
}

export function normalizeTrailerBridgeURL(raw){
 if(raw===undefined||raw===null||typeof raw==='string'&&!raw.trim())return undefined;
 if(typeof raw!=='string')throw new TypeError('Dirección del puente de tráiler no válida');
 let url;try{url=new URL(raw.trim());}catch{throw new TypeError('Dirección del puente de tráiler no válida');}
 const userinfo=/^https?:\/+[^/?#]*@/i.test(raw.trim().replaceAll('\\','/'));
 if(userinfo||url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&localHost(url.hostname)))throw new TypeError('Dirección del puente de tráiler no permitida');
 return url.href;
}

function validVideoID(id){
 if(typeof id!=='string'||!VIDEO_ID.test(id))throw new TypeError('Identificador de tráiler no válido');
 return id;
}

export function bridgeFrameURL(base,id){
 const normalized=normalizeTrailerBridgeURL(base);
 if(!normalized)throw new TypeError('Falta la dirección del puente de tráiler');
 validVideoID(id);
 // A fragment keeps the session out of HTTP requests and referrer headers.
 const bytes=new Uint8Array(32);globalThis.crypto.getRandomValues(bytes);
 const session=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
 const url=new URL(normalized);url.hash=new URLSearchParams({session,video:id}).toString();return url.href;
}

export class BridgePlayer{
 constructor(frame,{videoId,events={}}={}){
  this._frame=frame;this._videoId=validVideoID(videoId);this._events=events;this._intent=1;this._ready=false;this._destroyed=false;this._queue=[];
  const normalized=normalizeTrailerBridgeURL(frame?.src);
  if(!normalized)throw new TypeError('Falta el iframe del puente de tráiler');
  const url=new URL(normalized),hash=new URLSearchParams(url.hash.slice(1));
  this._session=hash.get('session');this._origin=url.origin;
  if(!SESSION.test(this._session||'')||hash.get('video')!==this._videoId)throw new TypeError('Sesión del puente de tráiler no válida');
  this._window=frame.ownerDocument?.defaultView||globalThis.window;
  if(!this._window?.addEventListener||!frame.contentWindow?.postMessage)throw new TypeError('Iframe del puente de tráiler no disponible');
  this._receive=event=>this._onMessage(event);this._window.addEventListener('message',this._receive);
 }
 _post(command){
  this._frame.contentWindow.postMessage({channel:CHANNEL,version:VERSION,session:this._session,intent:this._intent,videoId:this._videoId,...command},this._origin);
 }
 _command(type,details={}){
  if(this._destroyed)return;
  const command={type,...details};
  if(this._ready){this._post(command);return;}
  // Only four pending controls can exist: latest cue, volume, unmute, transport.
  // Cue resets transport because a previously requested play belongs to its ID.
  if(type==='cue'){
   this._queue=this._queue.filter(entry=>!['cue','play','pause'].includes(entry.type));this._queue.unshift(command);
  }else{
   this._queue=this._queue.filter(entry=>type==='play'||type==='pause'?!['play','pause'].includes(entry.type):entry.type!==type);this._queue.push(command);
  }
 }
 _emit(name,data){
  const callback=this._events?.[name];if(typeof callback==='function')callback(data===undefined?{target:this}:{target:this,data});
 }
 _onMessage(event){
  if(this._destroyed||event.source!==this._frame.contentWindow||event.origin!==this._origin)return;
  const data=event.data;
  if(!data||typeof data!=='object'||Array.isArray(data)||data.channel!==CHANNEL||data.version!==VERSION||data.session!==this._session)return;
  if(data.type==='ready'){
   if(this._ready)return;this._ready=true;
   const commands=this._queue;this._queue=[];for(const command of commands){if(this._destroyed)return;this._post(command);}
   this._emit('onReady');return;
  }
  if(data.videoId!==this._videoId||data.intent!==this._intent)return;
  // Startup failures can precede the API handshake; report their actual cause
  // immediately instead of making the host wait for its generic ready timeout.
  if(data.type==='error'&&(Number.isInteger(data.code)&&data.code>=0||typeof data.code==='string'&&data.code.length>0&&data.code.length<=64))this._emit('onError',data.code);
  else if(this._ready&&data.type==='state'&&PLAYER_STATES.has(data.state))this._emit('onStateChange',data.state);
  else if(this._ready&&data.type==='autoplay-blocked')this._emit('onAutoplayBlocked');
 }
 getVideoData(){return {video_id:this._videoId};}
 getIframe(){return this._frame;}
 cueVideoById(id){if(this._destroyed)return;this._videoId=validVideoID(id);this._intent++;this._command('cue');}
 playVideo(){this._command('play');}
 pauseVideo(){this._command('pause');}
 setVolume(volume){if(this._destroyed)return;if(!Number.isFinite(volume))throw new TypeError('Volumen de tráiler no válido');this._command('volume',{volume:Math.max(0,Math.min(100,volume))});}
 unMute(){this._command('unmute');}
 destroy(){
  if(this._destroyed)return;
  try{if(this._ready)this._post({type:'destroy'});}finally{this._destroyed=true;this._queue=[];this._events=null;this._window.removeEventListener('message',this._receive);this._frame.remove();}
 }
}
