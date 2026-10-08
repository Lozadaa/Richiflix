// One scalar interpolation per viewport; no React updates or card measurements.
// Retargeting is bounded, so held remote keys cannot create a long scroll tail.
export function createScrollGlide({read,write,request,cancel,now,min=140,max=220}){
 let frame=null,target=read(),start=target,lastWritten=target,started=0,duration=0;
 const stop=()=>{if(frame!==null)cancel(frame);frame=null;};
 const tick=time=>{
  frame=null;
  // A wheel, touch, or external scroll takes ownership immediately.
  if(Math.abs(read()-lastWritten)>2)return;
  const progress=Math.min(1,Math.max(0,(time-started)/duration));
  lastWritten=start+(target-start)*(1-Math.pow(1-progress,3));write(lastWritten);lastWritten=read();
  if(progress<1)frame=request(tick);
 };
 return {get moving(){return frame!==null;},to(next,smooth=true){
  const current=read();if(Math.abs(next-current)<1){stop();return;}
  if(frame!==null&&Math.abs(next-target)<1)return;
  stop();target=next;start=lastWritten=current;
  if(!smooth){write(target);lastWritten=read();return;}
  duration=Math.min(max,Math.max(min,Math.abs(target-start)*.2));started=now();frame=request(tick);
 },stop};
}
