import {createContext,useSyncExternalStore} from 'react';

// Trailers start muted. The viewer's choice (the speaker button on the card panel or the banner) is remembered per
// device; with sound on, every trailer fades in from silence to 40 % over 1.5 s instead of starting at full volume.
const KEY='rf-trailer-sound',TARGET=40,RAMP_MS=1500,STEP_MS=100;
let on=false;try{on=JSON.parse(localStorage.getItem(KEY))===true;}catch{}
const listeners=new Set(),ramps=new WeakMap();
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const useTrailerSound=()=>useSyncExternalStore(subscribe,()=>on,()=>false);
export function setTrailerSound(value){on=Boolean(value);try{localStorage.setItem(KEY,JSON.stringify(on));}catch{}for(const listener of listeners)listener();}
export const trailerSoundOn=()=>on;
// YouTube IFrame player: muted, or unmuted with a volume ramp (restarted on each call, cancelled when muting).
export function applyTrailerAudio(player){
 if(!player)return;clearInterval(ramps.get(player));ramps.delete(player);
 if(!on){player.mute?.();return;}
 let volume=0;player.setVolume?.(0);player.unMute?.();
 const step=TARGET/(RAMP_MS/STEP_MS),timer=setInterval(()=>{volume=Math.min(TARGET,volume+step);try{player.setVolume?.(Math.round(volume));}catch{clearInterval(timer);}if(volume>=TARGET){clearInterval(timer);ramps.delete(player);}},STEP_MS);
 ramps.set(player,timer);
}
export function stopTrailerAudio(player){if(player){clearInterval(ramps.get(player));ramps.delete(player);}}

// Automatic trailers (Ajustes) or, with them off, the one the viewer asked for with «Tráiler» (by title id).
export const TrailerContext=createContext({auto:true,manual:null,playManual:null});
