import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Trace arguments may contain source addresses. This report deliberately reads
// only thread labels, event names, times, event types and numeric paint bounds.
const root=resolve(import.meta.dirname,'..'),input=process.argv[2]||resolve(root,'artifacts/tv-trace-navigation.json'),output=resolve(root,'artifacts/tv-trace-navigation-summary.json');
const trace=JSON.parse(await readFile(input,'utf8')),events=Array.isArray(trace)?trace:trace.traceEvents;
const main=events.find(event=>event.name==='thread_name'&&['Chrome_InProcRendererThread','CrRendererMain'].includes(event.args?.name));
if(!main)throw Error('The trace does not identify a renderer main thread.');
const complete=events.filter(event=>event.ph==='X'&&Number.isFinite(event.dur));
const mainEvents=complete.filter(event=>event.pid===main.pid&&event.tid===main.tid).sort((a,b)=>a.ts-b.ts||b.dur-a.dur);
const nodes=[],stack=[];
for(const event of mainEvents){
 while(stack.length&&(event.ts>=stack.at(-1).event.ts+stack.at(-1).event.dur||event.ts+event.dur>stack.at(-1).event.ts+stack.at(-1).event.dur))stack.pop();
 const node={event,children:[],parent:stack.at(-1)};node.parent?.children.push(node);nodes.push(node);stack.push(node);
}
const milliseconds=value=>Math.round(value)/1000;
function unionDuration(intervals){
 const sorted=intervals.map(event=>({start:event.ts,end:event.ts+event.dur})).sort((a,b)=>a.start-b.start);let total=0,start=-Infinity,end=-Infinity;
 for(const interval of sorted){if(interval.start>end){if(Number.isFinite(start))total+=end-start;start=interval.start;end=interval.end;}else end=Math.max(end,interval.end);}
 return total+(Number.isFinite(start)?end-start:0);
}
const totals=(source,name)=>{const selected=source.filter(event=>event.name===name);return {count:selected.length,inclusiveMs:milliseconds(selected.reduce((sum,event)=>sum+event.dur,0)),maxMs:milliseconds(Math.max(0,...selected.map(event=>event.dur)))};};
const mainTasks=mainEvents.filter(event=>event.name==='RunTask');
const leafTasks=nodes.filter(node=>node.event.name==='RunTask'&&!node.children.some(child=>child.event.name==='RunTask'));
const longTasks=leafTasks.filter(node=>node.event.dur>=50000).map(node=>{
 const {event,children}=node;let cursor=event.ts,maxGap=0;
 for(const child of children){maxGap=Math.max(maxGap,child.event.ts-cursor);cursor=Math.max(cursor,child.event.ts+child.event.dur);}maxGap=Math.max(maxGap,event.ts+event.dur-cursor);
 const overlappingRaster=complete.filter(other=>other.name==='RasterTask'&&other.ts<event.ts+event.dur&&other.ts+other.dur>event.ts);
 return {durationMs:milliseconds(event.dur),uninstrumentedMs:milliseconds(event.dur-unionDuration(children.map(child=>child.event))),largestUninstrumentedGapMs:milliseconds(maxGap),children:children.map(child=>({name:child.event.name,offsetMs:milliseconds(child.event.ts-event.ts),durationMs:milliseconds(child.event.dur)})),overlappingRasterCount:overlappingRaster.length,overlappingRasterInclusiveMs:milliseconds(overlappingRaster.reduce((sum,other)=>sum+other.dur,0))};
});
const paintDimensions=[];
for(const event of events.filter(event=>event.name==='Paint')){
 const clip=event.args?.data?.clip;if(!Array.isArray(clip)||clip.length!==8||!clip.every(value=>typeof value==='number'&&Math.abs(value)<1e6))continue;
 const x=clip.filter((_value,index)=>index%2===0),y=clip.filter((_value,index)=>index%2===1);
 paintDimensions.push({width:Math.max(...x)-Math.min(...x),height:Math.max(...y)-Math.min(...y)});
}
const report={measurement:'Samsung browser trace event durations; not a native CPU stack profile',mainThread:main.args.name,mainRunTaskUnionMs:milliseconds(unionDuration(mainTasks)),mainRunTaskInclusiveMs:milliseconds(mainTasks.reduce((sum,event)=>sum+event.dur,0)),nestedRunTaskWarning:'Inclusive RunTask totals contain nested scheduler scopes and must not be counted as independent JavaScript work.',main:{functionCall:totals(mainEvents,'FunctionCall'),v8CallFunction:totals(mainEvents,'v8.callFunction'),eventDispatch:totals(mainEvents,'EventDispatch'),keydown:totals(mainEvents.filter(event=>event.args?.data?.type==='keydown'),'EventDispatch'),layerize:totals(mainEvents,'Layerize'),layoutTree:totals(mainEvents,'UpdateLayoutTree'),paint:totals(mainEvents,'Paint')},raster:totals(complete,'RasterTask'),decode:totals(complete,'ImageDecodeTask'),longLeafMainTasks:longTasks,paintDimensions,inference:'Long frame-lifecycle gaps overlap raster workers while instrumented JavaScript is short. Raster/compositor synchronization is consistent with these timings; the trace alone does not identify the native blocking call.'};
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
