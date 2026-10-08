// D4 · level 2: the intro learned per series and season from the viewer's own forward jumps.
// A jump from the first 5 minutes covering 30–150 s is a sample; the window is the mean of the last 3.
// A window starting in minute 0 is offered as «Saltar resumen».
const round=value=>Math.round(value*10)/10;
export const introKey=({seriesId,season})=>`${seriesId}:${season}`;
export function learnIntro(marks,{seriesId,season,from,to}){
 if(!seriesId||!(from>=0&&from<300&&to-from>=30&&to-from<=150))return marks;
 const key=introKey({seriesId,season}),samples=[...(marks[key]?.samples||[]),{start:round(from),end:round(to)}].slice(-3);
 const mean=field=>round(samples.reduce((sum,sample)=>sum+sample[field],0)/samples.length);
 return {...marks,[key]:{start:mean('start'),end:mean('end'),samples}};
}
export function introWindow(marks,where){const mark=marks?.[introKey(where)];return mark?{start:mark.start,end:mark.end,kind:mark.start<60?'recap':'intro'}:null;}
export function discardIntro(marks,key){if(!marks?.[key])return marks;const {[key]:_,...rest}=marks;return rest;}
// Offered from 15 s before the window until 1 s before its end, for at most 10 s, unless dismissed.
export const shouldOffer=({position,window,dismissed=false,shownAt=null,now=Date.now()})=>Boolean(window)&&!dismissed&&position>=Math.max(0,window.start-15)&&position<=window.end-1&&(shownAt===null||now-shownAt<=10000);
