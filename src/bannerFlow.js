// A single quiet period owns the preview. Movement only changes two booleans;
// intermediate cards never become artwork or video requests.
export function createBannerFlow({onChange=()=>{},onCommit=value=>value?.(),settleMs=480,schedule=setTimeout,cancel=clearTimeout}={}){
 let state={collapsed:true,moving:false},candidate,timer,closed=false;
 const publish=(collapsed,moving)=>{
  if(state.collapsed===collapsed&&state.moving===moving)return;
  state={collapsed,moving};onChange(state);
 };
 const clear=()=>{if(timer!==undefined){cancel(timer);timer=undefined;}};
 const settle=()=>{
  timer=undefined;if(closed)return;
  const selected=candidate;
  if(selected!==undefined&&onCommit(selected)!==false)publish(false,false);
  else publish(true,false);
 };
 const move=()=>{if(closed)return;publish(true,true);clear();timer=schedule(settle,settleMs);};
 return {
  get state(){return state;},
  move,
  select(value){if(closed)return;candidate=value;move();},
  keep(value){if(closed)return;clear();candidate=value;if(onCommit(value)!==false)publish(false,false);else publish(true,false);},
  reset(){if(closed)return;clear();candidate=undefined;publish(true,false);},
  dispose(){closed=true;clear();candidate=undefined;}
 };
}
