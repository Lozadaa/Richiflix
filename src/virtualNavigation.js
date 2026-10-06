const controllers=new WeakMap();
export function registerVirtualNavigation(element,controller){controllers.set(element,controller);return()=>controllers.delete(element);}
export const virtualController=element=>controllers.get(element);
export const virtualCardIndex=element=>Number(element?.closest('[data-virtual-index]')?.dataset.virtualIndex??-1);
export function restoreVirtualFocus(group,index){return controllers.get(group)?.focus(index);}
// Spatial fallback is reserved for dialogs and loose controls. Read each box
// once, then choose the closest candidate without sorting the complete scope.
export function directionalTarget(currentRect,candidates,key){
 const horizontal=key==='ArrowLeft'||key==='ArrowRight',sign=key==='ArrowRight'||key==='ArrowDown'?1:-1;
 const x=currentRect.x+currentRect.width/2,y=currentRect.y+currentRect.height/2;
 let target=null,best=Infinity;
 for(const {element,rect}of candidates){
  const a=rect.x+rect.width/2-x,b=rect.y+rect.height/2-y,along=horizontal?a:b,across=horizontal?b:a;
  if(along*sign<=10)continue;
  const score=Math.abs(along)+Math.abs(across)*3;
  if(score<best){best=score;target=element;}
 }
 return target;
}
