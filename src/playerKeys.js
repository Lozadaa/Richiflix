// D2: the TV player keeps focus on the video or on the button row, never on the progress bar.
// Media seek keys apply at once (`now`); arrows accumulate (D1). `null` = the key is not the player's.
const SEEK={ArrowLeft:-1,ArrowRight:1},MEDIA_SEEK={MediaRewind:-1,MediaFastForward:1};
export function playerKeyAction({key,focus,repeat=false,seekable=false,chromeVisible=false}){
 if(MEDIA_SEEK[key])return seekable?{type:'seek',direction:MEDIA_SEEK[key],repeat,now:true}:null;
 if(focus==='video'){
  if(SEEK[key])return seekable?{type:'seek',direction:SEEK[key],repeat}:null;
  if(key==='ArrowDown')return {type:'focusButtons'};
  if(key==='Enter')return chromeVisible?{type:'focusButtons',togglePlay:true}:{type:'focusButtons'};
  return key==='Escape'?{type:'close'}:null;
 }
 if(focus==='buttons'){
  if(SEEK[key])return {type:'moveButton',direction:SEEK[key]};
  return key==='ArrowUp'||key==='Escape'?{type:'focusVideo'}:null;
 }
 return key.startsWith('Arrow')||key==='Enter'?{type:'focusVideo'}:null;
}
