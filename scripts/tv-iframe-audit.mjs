import {connectTV} from './tv-cdp.mjs';
const tv=await connectTV(),contexts=[];try{
 tv.onEvent(message=>{if(message.method==='Runtime.executionContextCreated')contexts.push(message.params.context);});
 await tv.send('Runtime.enable');await new Promise(resolve=>setTimeout(resolve,1000));
 console.log(contexts.map(c=>({id:c.id,origin:c.origin,frame:c.auxData?.frameId})));
 for(const context of contexts.filter(c=>c.origin.includes('youtube'))){const result=await tv.send('Runtime.evaluate',{contextId:context.id,expression:'JSON.stringify({text:document.body.innerText.slice(0,1800),ready:document.readyState,video:[...document.querySelectorAll("video")].map(v=>({paused:v.paused,time:v.currentTime,error:v.error?.code,ready:v.readyState})),state:document.querySelector(".ytp-error-content-wrap")?.textContent})',returnByValue:true});console.log(result.result?.value);}
 console.log(await tv.evaluate(()=>({hidden:document.hidden,trailer:{...document.querySelector('.trailer-preview')?.dataset}, iframe:document.querySelector('.trailer-preview iframe')?.src})));
}finally{tv.close();}
