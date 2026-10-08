import {useEffect} from 'react';
import {isTVBuild} from './platform.js';
import {virtualController,virtualCardIndex,restoreVirtualFocus,directionalTarget,revealRowFor} from './virtualNavigation.js';
import {installFocusPaintDiagnostics} from './focusPaintDiagnostics.js';
import {nextGridIndex,nextRailIndex} from './virtualWindow.js';
export function useRemoteNavigation(){
 useEffect(()=>{
 const memories=new WeakMap(),gridSizes=new WeakMap(),announced=new WeakSet();let lastCard,lastGroup,lastIndex=-1;
 const announce=event=>{if(announced.has(event))return;announced.add(event);window.dispatchEvent(new CustomEvent('richiflix-catalog-navigation',{detail:{key:event.key,repeat:event.repeat}}));};
 const remember=event=>{
  const target=event.target;
  if(target.closest('.app.tv-mode')){
   // Keep the title candidate and row memory while only the current destination owns a halo. This attribute
   // changes at region boundaries, never per Card; R1.5: it lives on <body>, outside React's root className.
   const region=target.closest('[role="dialog"]')?'dialog':target.closest('.focus-stage')?'banner':target.closest('.card')?'catalogue':target.closest('.topbar')?'header':'controls';
   if(document.body.dataset.focusRegion!==region)document.body.dataset.focusRegion=region;
  }
  if(target.closest('.profile-screen')){lastCard=null;lastGroup=null;lastIndex=-1;}
  else if(target.matches('.card-open')){lastCard=target;const group=target.closest('.cards,.catalog-grid');if(group){lastGroup=group;lastIndex=virtualCardIndex(target);memories.set(group,{element:target,index:lastIndex});}}
 };
 const recalled=(event,group)=>{const memory=memories.get(group);if(memory?.element.isConnected)return memory.element;if(Number(group.dataset.virtualCount)>0)announce(event);return restoreVirtualFocus(group,memory?.index??0)||group.querySelector('.card-open');};
 const move=(event,target)=>{
  event.preventDefault();if(!target||document.activeElement===target)return;
  if(target.matches('.card-open')&&target.closest('.tv-mode')&&!document.querySelector('[role="dialog"]'))announce(event);
  const group=target.closest('.cards,.catalog-grid'),controller=virtualController(group);
  if(controller&&target.matches('.card-open')){controller.focus(virtualCardIndex(target));return;}
  revealRowFor(target).focus({preventScroll:true});const card=target.closest('.card');if(card)card.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});
 };
 function navigation(e){
  if(e.defaultPrevented||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
  const current=document.activeElement,tv=Boolean(document.querySelector('.tv-mode')),dialog=document.querySelector('[role="dialog"]');
  if(['INPUT','TEXTAREA','VIDEO',...(!isTVBuild?['SELECT']:[])].includes(current.tagName))return;
  if(tv&&!dialog){
   if(current.matches('.discovery-refresh')){const discovery=current.closest('.home-discovery'),first=discovery.querySelector('.cards'),rows=[...document.querySelectorAll('.catalog-row .cards')],previous=rows[rows.indexOf(first)-1];if(e.key==='ArrowDown'&&first){move(e,recalled(e,first));return;}if(e.key==='ArrowUp'&&previous){move(e,recalled(e,previous));return;}move(e,null);return;}
   // Down from the header enters the banner; leaving for the catalogue hides it.
   // Up can focus the preserved banner control and reveal the same recommendation again.
   if(e.key==='ArrowDown'&&current.closest('.topbar')){const primary=document.querySelector('.app.has-tv-stage .focus-actions .primary')||document.querySelector('main .catalog-controls button')||document.querySelector('.card-open');if(primary){move(e,primary);return;}}
   if(e.key==='ArrowDown'&&current.closest('.focus-actions')){const filter=document.querySelector('main .category-filter-entry')||document.querySelector('main .live-hub .category-chip.selected');if(filter){move(e,filter);return;}let target=lastCard?.isConnected?lastCard:null;if(!target&&lastGroup?.isConnected){if(Number(lastGroup.dataset.virtualCount)>0)announce(e);target=restoreVirtualFocus(lastGroup,lastIndex);}target??=document.querySelector('.card-open');if(target){move(e,target);return;}}
   if(current.closest('.catalog-controls')){if(e.key==='ArrowUp'){move(e,document.querySelector('.app.has-tv-stage .focus-actions .primary')||document.querySelector('.topbar nav button.active'));return;}if(e.key==='ArrowDown'){const empty=document.querySelector('main .empty-state:not([role=alert]) .empty-state-actions button'),row=document.querySelector('main .catalog-row .cards');move(e,empty||(row?recalled(e,row):lastCard?.isConnected?lastCard:document.querySelector('.card-open')));return;}}
   // Direct banner: Left/Right on the carousel's Play change the slide in FocusStage (bannerKeyAction, which
   // prevents the key); the dots are only an indicator. Up from the actions goes to the header.
   if(e.key==='ArrowUp'&&current.closest('.focus-actions')){move(e,document.querySelector('.topbar nav button.active'));return;}
   const horizontal=e.key==='ArrowLeft'||e.key==='ArrowRight',controlRow=current.closest('.topbar,.focus-actions');
   if(horizontal&&controlRow){
    // These are ordered rows. Spatially scoring every mounted Card is both
    // unnecessary and expensive on Samsung's browser during a held key.
    const controls=[...controlRow.querySelectorAll('button,a,input')].filter(element=>element.tabIndex>=0&&!element.disabled&&!element.closest('[inert]')&&element.getBoundingClientRect().width>0);
    move(e,controls[controls.indexOf(current)+(e.key==='ArrowRight'?1:-1)]);return;
   }
   // Fase L7: a followed-team alert that did not take focus («Arriba para ver») is reached with Up from any card.
   if(e.key==='ArrowUp'&&current.matches('.card-open')){const action=document.querySelector('.toast .toast-action');if(action){move(e,action);return;}}
   if(current.matches('.card-open')){
    const group=current.closest('.cards,.catalog-grid'),controller=virtualController(group),horizontal=e.key==='ArrowLeft'||e.key==='ArrowRight';
    if(controller&&(horizontal||controller.kind==='grid')){
     // Virtual navigate() focuses internally, so announce before calling it,
     // after establishing that this key actually has another card to reach.
     const index=virtualCardIndex(current),count=Number(group.dataset.virtualCount),next=controller.kind==='grid'?nextGridIndex(index,e.key,Number(group.dataset.virtualColumns)||1,count):nextRailIndex(index,e.key,count);
     if(next!==null&&next>=0&&next<count&&next!==index)announce(e);
     const target=controller.navigate(e.key,current);
     if(target){move(e,target);return;}
     if(horizontal){move(e,null);return;}
     // Fase L3: the live channel grid sits under the event rows.
     const rails=e.key==='ArrowUp'&&group.closest('.live-hub')?document.querySelectorAll('main .live-hub .catalog-row .cards'):null;if(rails?.length){move(e,recalled(e,rails[rails.length-1]));return;}
     if(e.key==='ArrowUp'){move(e,document.querySelector('main .catalog-controls .category-chip.selected')||document.querySelector('main .catalog-controls button')||document.querySelector('.app.has-tv-stage .focus-actions .primary')||document.querySelector('.topbar nav button.active'));return;}
     move(e,null);return;
    }
    const cards=controller?[]:[...group.querySelectorAll('.card-open')],index=cards.indexOf(current);
    if(horizontal){
     const target=cards[group.matches('.cards')?nextRailIndex(index,e.key,cards.length):index+(e.key==='ArrowRight'?1:-1)];
     if(group.matches('.cards')||!target||Math.abs(target.getBoundingClientRect().y-current.getBoundingClientRect().y)<20){move(e,target);return;}
     move(e,null);return;
    }
    const down=e.key==='ArrowDown';
    if(group.matches('.catalog-grid')){
     const width=group.clientWidth;let size=gridSizes.get(group);
     if(!size||size.width!==width){size={width,columns:getComputedStyle(group).gridTemplateColumns.split(/\s+/).length};gridSizes.set(group,size);}
     const nextIndex=index+(down?size.columns:-size.columns),target=cards[nextIndex]||(down&&Math.floor(index/size.columns)<Math.floor((cards.length-1)/size.columns)?cards.at(-1):null);
     if(target){move(e,target);return;}
    }else{
     const rows=[...document.querySelectorAll('.catalog-row .cards')],next=rows[rows.indexOf(group)+(down?1:-1)];
     const refresh=document.querySelector('.home-discovery .discovery-refresh'),firstDiscovery=document.querySelector('.home-discovery .cards');if(refresh&&(down&&next===firstDiscovery&&!group.closest('.home-discovery')||!down&&group===firstDiscovery)){move(e,refresh);return;}
     if(next){move(e,recalled(e,next));return;}
     const hub=group.closest('.live-hub');if(hub){const target=down?hub.querySelector('.catalog-grid'):hub.querySelector('.category-chip.selected');if(target){move(e,down?recalled(e,target):target);return;}}
    }
    if(!down){move(e,group.closest('.empty-state')?.querySelector('.empty-state-actions button')||document.querySelector('.app.has-tv-stage .focus-actions .primary')||document.querySelector('.topbar nav button.active'));return;}
    move(e,null);return;
   }
  }
  const scope=dialog||document;
  const candidates=[];
  for(const element of scope.querySelectorAll('button,a,input,textarea,select,video')){
   // The card panel is entered with Tab / held OK and walks itself (ExpandedCard); arrows from outside skip it.
   if(element===current||element.tabIndex<0||element.disabled||element.closest('[inert]')||element.closest('.card-expansion')&&!current.closest('.card-expansion')||(tv&&!dialog&&element.matches('.card-save,.rail-arrow,.row-more')))continue;
   const rect=element.getBoundingClientRect();if(rect.width<=0||getComputedStyle(element).visibility==='hidden')continue;
   candidates.push({element,rect});
  }
  const next=directionalTarget(current.getBoundingClientRect(),candidates,e.key);if(next)move(e,next);
 }
 const removeDiagnostics=installFocusPaintDiagnostics();
 window.addEventListener('focusin',remember);window.addEventListener('keydown',navigation);return()=>{removeDiagnostics();window.removeEventListener('keydown',navigation);window.removeEventListener('focusin',remember);};
 },[]);
}
