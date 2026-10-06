const budget=240;
const resourceReaders=new Map();let diagnosticsActive=false,cardRenders=0;
export function registerPerformanceStats(name,read){resourceReaders.set(name,read);return()=>{if(resourceReaders.get(name)===read)resourceReaders.delete(name);};}
export function recordCardRender(){if(diagnosticsActive)cardRenders++;}
const resources=()=>{
 const measures=performance.getEntriesByName('richiflix-boot'),boot=measures[measures.length-1];
 return {boot:{phase:document.querySelector('.boot-screen')?.dataset.bootStage||((document.querySelector('.profile-screen,.app'))?'ready':'pending'),durationMs:boot?Math.round(boot.duration):null},...Object.fromEntries([...resourceReaders].map(([name,read])=>{try{return[name,read()];}catch{return[name,{unavailable:true}];}}))};
};
const percentile=(values,fraction)=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*fraction)-1)]*10)/10;};
// The second RAF is a presentation-boundary proxy, not proof of GPU/compositor paint.
// Opt-in only, bounded samples, no content titles, credentials or source URLs.
export function installFocusPaintDiagnostics(){
 if(diagnosticsActive)return()=>{};
 if(!import.meta.env.DEV&&new URLSearchParams(location.search).get('diagnostics')!=='1'&&import.meta.env.VITE_PERFORMANCE_DIAGNOSTICS!=='1')return()=>{};
 diagnosticsActive=true;
 const keyToFrame=[],frameGaps=[],longTasks=[];let active=true,frame,lastFrame=0,pending=0;
 const append=(array,value)=>{array.push(value);if(array.length>budget)array.shift();};
 const key=event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||document.hidden)return;
  const started=performance.now(),before=document.activeElement;pending++;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{pending--;if(active)append(keyToFrame,{ms:performance.now()-started,moved:document.activeElement!==before});}));
 };
 const tick=now=>{if(!active)return;if(lastFrame&&!document.hidden)append(frameGaps,now-lastFrame);lastFrame=now;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
 let observer;try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())append(longTasks,entry.duration);});observer.observe({type:'longtask',buffered:false});}catch{}
 const old=window.__richiflixPerformance;
 window.__richiflixPerformance={snapshot(){const moved=keyToFrame.filter(sample=>sample.moved).map(sample=>sample.ms);return {measurement:'keydown to second requestAnimationFrame; presentation proxy, not measured compositor paint',focusSamples:keyToFrame.length,focusMoved:moved.length,focusPending:pending,keyToFrameP95:percentile(moved,.95),keyToFrameMax:Math.max(0,...moved),frameP95:percentile(frameGaps,.95),frameOver32ms:frameGaps.filter(ms=>ms>32).length,longTaskCount:longTasks.length,longTaskMax:Math.max(0,...longTasks),cardRenders,resources:resources(),mountedCards:document.querySelectorAll('.card').length,mountedImages:document.querySelectorAll('.card img').length,virtualWindows:[...document.querySelectorAll('[data-virtual-kind]')].map(element=>({kind:element.dataset.virtualKind,total:Number(element.dataset.virtualCount),mounted:element.querySelectorAll('.card').length}))};},reset(){keyToFrame.length=0;frameGaps.length=0;longTasks.length=0;lastFrame=0;cardRenders=0;}};
 // Optional local measurement build when the TV inspector is unavailable.
 // Only aggregates are sent; the sink is never configured in regular builds.
 const sink=import.meta.env.VITE_DIAGNOSTICS_ENDPOINT;let reports=0,reporting=false,reportTimer;
 if(sink){
  reportTimer=setInterval(async()=>{
   if(reporting||document.hidden||reports>=60)return;
   const sample=window.__richiflixPerformance.snapshot();if(sample.resources.boot.phase!=='ready')return;
   reporting=true;reports++;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),800);
   const aggregate={measurement:sample.measurement,at:Date.now(),focusSamples:sample.focusSamples,focusMoved:sample.focusMoved,keyToFrameP95:sample.keyToFrameP95,keyToFrameMax:sample.keyToFrameMax,frameP95:sample.frameP95,frameOver32ms:sample.frameOver32ms,longTaskCount:sample.longTaskCount,longTaskMax:sample.longTaskMax,mountedCards:sample.mountedCards,mountedImages:sample.mountedImages,workerMode:sample.resources.catalogueWorker?.mode||'idle',bootMs:sample.resources.boot.durationMs,bannerState:document.querySelector('.focus-stage')?.dataset.stageState||'absent',trailerState:document.querySelector('.focus-stage .trailer-preview')?.dataset.trailerState||'absent',trailerErrorKind:document.querySelector('.focus-stage .trailer-preview')?.dataset.trailerErrorKind||null};
   try{await fetch(sink,{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(aggregate),signal:controller.signal});}catch{}finally{clearTimeout(timeout);reporting=false;if(reports>=60)clearInterval(reportTimer);}
  },5000);
 }
 window.addEventListener('keydown',key,{capture:true});
 return()=>{active=false;diagnosticsActive=false;clearInterval(reportTimer);cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('keydown',key,{capture:true});if(window.__richiflixPerformance?.snapshot)window.__richiflixPerformance=old;};
}
