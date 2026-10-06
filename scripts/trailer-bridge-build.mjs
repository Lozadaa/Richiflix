import {loadEnv} from 'vite';
import {normalizeTrailerBridgeURL} from '../src/trailerBridge.js';

export function buildTrailerBridge(root){
 return normalizeTrailerBridgeURL(loadEnv('tizen',root,'VITE_').VITE_TRAILER_BRIDGE_URL);
}
export function allowTrailerBridgeFrame(html,url){
 if(!url)return html;
 const origin=new URL(url).origin;
 return html.replace(/frame-src ([^;"<]*)/g,(_match,sources)=>`frame-src ${sources} ${origin}`);
}
