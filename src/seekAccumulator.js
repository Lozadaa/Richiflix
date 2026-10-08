// D1: one burst of Left/Right (or MediaRewind/FastForward) grows 10 → 30 → 60 → 120 s per press and
// seeks once, `applyMs` after the last press. Holding counts one press every 250 ms of `repeat` events.
// The burst keeps its starting position, so `flush()` (immediate apply) never compounds the delta.
export function createSeekAccumulator({steps=[10,30,60,120],windowMs=600,applyMs=400,repeatMs=250,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=id=>clearTimeout(id),now=()=>Date.now()}={}){
 let burst=null,timer=null,listener=()=>{},lastTarget=null;
 const apply=()=>{timer=null;if(burst&&!burst.applied){burst.applied=true;lastTarget=burst.target;listener(burst.target,burst);}};
 return {
  press(direction,{position,duration,repeat=false}){
   const at=now();
   if(repeat&&burst&&burst.direction===direction&&at-burst.at<repeatMs)return null;
   // The video reports the old position until AVPlay finishes the previous seek: a new burst starts from the last target.
   if(!burst||burst.direction!==direction||at-burst.at>windowMs)burst={direction,from:lastTarget??position,presses:0,delta:0};
   burst.delta+=steps[Math.min(burst.presses,steps.length-1)];burst.presses++;burst.at=at;burst.applied=false;
   burst.target=Math.max(0,Math.min(Math.max(0,duration-1),burst.from+direction*burst.delta));
   if(timer!==null)cancel(timer);timer=schedule(apply,applyMs);
   return {target:burst.target,delta:burst.delta,step:steps[Math.min(burst.presses-1,steps.length-1)]};
  },
  onApply(fn){listener=fn;},
  pending(){return burst&&!burst.applied?{target:burst.target,delta:burst.delta,direction:burst.direction}:null;},
  flush(){if(timer!==null){cancel(timer);apply();}},
  cancel(){if(timer!==null)cancel(timer);timer=null;burst=null;},
  // The video confirmed the seek (`seeked`): its own position is the truth again.
  settle(){lastTarget=null;},
 };
}
// The next-episode card follows playback into the last `lead` seconds; a seek landing there does not count.
export const naturalCross=({previous,position,duration,lead=30})=>duration>lead&&previous<duration-lead&&position>=duration-lead&&position-previous<=2;
