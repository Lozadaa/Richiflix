import {connectTV} from './tv-cdp.mjs';
const tv=await connectTV(),messages=[];try{
 tv.onEvent(message=>{if(message.method==='Log.entryAdded')messages.push(message.params.entry);if(message.method==='Network.loadingFailed')messages.push({fail:message.params.errorText,reason:message.params.blockedReason,type:message.params.type});});
 await tv.send('Log.enable');await tv.send('Network.enable');
 console.log(JSON.stringify(await tv.send('Page.getFrameTree')));
 console.log(await tv.evaluate(()=>{const iframe=document.querySelector('.trailer-preview iframe');if(iframe)iframe.src=iframe.src;return {hidden:document.hidden};}));
 await new Promise(resolve=>setTimeout(resolve,3000));
 console.log(messages.filter(entry=>entry.fail||/youtube|iframe|origin|frame/i.test(entry.text||'')).slice(-8).map(entry=>({text:entry.text?.slice(0,900),fail:entry.fail,reason:entry.reason,type:entry.type})));
}finally{tv.close();}
