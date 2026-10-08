import {connectTV} from './tv-cdp.mjs';
const tv=await connectTV();try{
 await tv.send('Performance.enable');
 console.log(await tv.evaluate(()=>{document.querySelector('.card-open')?.focus();return {hidden:document.hidden,trailer:document.querySelector('.trailer-preview')?.dataset,src:document.querySelector('.trailer-preview iframe')?.src,api:!!window.YT?.Player,cardCount:document.querySelectorAll('.card').length};}));
 await new Promise(resolve=>setTimeout(resolve,5000));
 console.log(await tv.evaluate(()=>({hidden:document.hidden,trailer:document.querySelector('.trailer-preview')?.dataset,src:document.querySelector('.trailer-preview iframe')?.src,api:!!window.YT?.Player,heading:document.querySelector('.focus-stage h1')?.textContent,resources:performance.getEntriesByType('resource').filter(e=>/youtube|ytimg/.test(e.name)).map(e=>({host:new URL(e.name).hostname,duration:Math.round(e.duration)}))})));
 console.log((await tv.send('Performance.getMetrics')).metrics.filter(n=>/Duration|Nodes|Heap|LayoutCount|RecalcStyleCount/.test(n.name)));
}finally{tv.close();}
