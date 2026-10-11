// TV browsers can be older than the code: Samsung Tizen 6.5 is Chrome 85, and an Android TV whose System WebView has
// not been updated can be Chrome 91. Only what src/ uses and those engines lack: Array/String#at (Chrome 92) and
// Object.hasOwn (Chrome 93). Imported first by main.jsx; a no-op wherever the engine has them.
const at=function(index){const length=this.length,position=Math.trunc(index)||0,target=position<0?length+position:position;return target<0||target>=length?undefined:this[target];};
for(const type of [Array,String])if(!type.prototype.at)Object.defineProperty(type.prototype,'at',{value:at,writable:true,configurable:true});
if(!Object.hasOwn)Object.defineProperty(Object,'hasOwn',{value:(object,key)=>Object.prototype.hasOwnProperty.call(object,key),writable:true,configurable:true});
// Android TV shell (android/): plain-HTTP API calls (IPTV panels) go to the native proxy as https://kingdom.proxy/http/…
// so the WebView never treats them as mixed content (which also logs the full URL, password included, to logcat).
// Applies in the page and in workers alike; the shell maps the URL back before fetching it (NetworkProxy.kt).
if(/KingdomAndroidTV\//.test(globalThis.navigator?.userAgent||'')&&typeof globalThis.fetch==='function'){
 const nativeFetch=globalThis.fetch.bind(globalThis);
 const proxied=url=>typeof url==='string'&&url.startsWith('http://')?'https://kingdom.proxy/http/'+url.slice(7):url;
 globalThis.fetch=(input,init)=>nativeFetch(typeof input==='string'?proxied(input):input instanceof URL?proxied(input.href):input,init);
}
