const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function expandedCardPlacement(anchor,viewport,{tv=false,live=false,alignStart=false,margin=16}={}){
 const availableWidth=viewport.width-2*margin,availableHeight=viewport.height-2*margin;
 if(anchor.width<=0||anchor.height<=0||availableWidth<200||availableHeight<240||anchor.bottom<=viewport.top||anchor.top>=viewport.top+viewport.height)return null;
 const width=Math.min(availableWidth,Math.min(tv?1120:620,Math.max(tv?1000:420,anchor.width*(tv?2.8:1.95))));
 const height=Math.min(availableHeight,Math.min(520,Math.max(live?270:tv?430:390,anchor.height*1.12)));
 const left=clamp(alignStart?anchor.left:anchor.left+(anchor.width-width)/2,viewport.left+margin,viewport.left+viewport.width-margin-width);
 const top=clamp(anchor.top+(anchor.height-height)/2,viewport.top+margin,viewport.top+viewport.height-margin-height);
 return {left,top,width,height,originX:clamp((anchor.left+anchor.width/2-left)/width*100,0,100),originY:clamp((anchor.top+anchor.height/2-top)/height*100,0,100),scaleX:Math.min(1,anchor.width/width),scaleY:Math.min(1,anchor.height/height)};
}
export function createCardPress({short,long,delay=500,schedule=setTimeout,cancel=clearTimeout}){
 let timer,pressed=false,held=false;
 return {down(){if(pressed)return;pressed=true;held=false;timer=schedule(()=>{timer=undefined;if(pressed){held=true;long();}},delay);},up(){if(!pressed)return false;cancel(timer);timer=undefined;pressed=false;const wasHeld=held;held=false;if(!wasHeld)short();return true;},cancel(){cancel(timer);timer=undefined;pressed=false;held=false;},get pressed(){return pressed;}};
}
