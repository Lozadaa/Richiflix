import test from 'node:test';
import assert from 'node:assert/strict';
import {expandedCardPlacement,anchorBoxFromLayout,cellAnchorBox,createCardPress,okHint,remainingLabel,neighbourShifts,expansionViewportTop,expansionAlignFor,neighbourMotions,neighbourDurations,createExpansionHub} from './cardExpansion.js';
import {reserveCardExpansion} from './cardExpansionSpace.js';
// R1.1 fakes: cells record their Web Animations; nothing else on them (no classList, no setProperty) may be touched.
const animatedCell=(index,parentElement)=>({dataset:{virtualIndex:String(index)},style:{left:`${index*240}px`,width:'210px',transform:'',transition:'',willChange:''},parentElement,animations:[],animate(keyframes,options){const animation={keyframes,options,state:'running',cancel(){this.state='cancelled';},reverse(){this.state='reversed';}};this.animations.push(animation);return animation;}});
const motion=cell=>cell.animations.map(({keyframes,options})=>[keyframes.at(-1).transform??`opacity ${keyframes.at(-1).opacity}`,options.duration]);
const states=cells=>[...new Set(cells.flatMap(cell=>cell.animations.map(animation=>animation.state)))];
test('expanded cards grow horizontally without exceeding the visible catalogue or header',()=>{
 const viewport={left:0,top:500,width:1920,height:580};
 for(const left of [0,200,900,1720])for(const top of [490,550,850,1050]){
  const anchor={left,top,width:210,height:380,bottom:top+380},result=expandedCardPlacement(anchor,viewport,{tv:true});
  assert.ok(result.width/anchor.width>result.height/anchor.height);
  assert.ok(result.left>=16&&result.left+result.width<=1904);
  assert.ok(result.top>=516&&result.top+result.height<=1064);
 }
});
test('small screens clamp the complete panel and invisible cards never mount it',()=>{
 const viewport={left:0,top:100,width:400,height:420},anchor={left:0,top:160,width:130,height:300,bottom:460},panel=expandedCardPlacement(anchor,viewport,{tv:true});
 assert.ok(panel.width<=368&&panel.height<=388);assert.equal(expandedCardPlacement({...anchor,top:-400,bottom:-100},viewport),null);
 assert.equal(expandedCardPlacement(anchor,{...viewport,height:220}),null);
 const live=expandedCardPlacement({...anchor,width:340,height:240}, {...viewport,width:1920,height:900},{tv:true,live:true});assert.ok(live.height<300);assert.equal(expandedCardPlacement({...anchor,width:340,height:240},{...viewport,width:1920,height:900},{tv:true,live:true,tall:true}).height,400,"an event with signal chips gets room for them");
});
test('short OK plays on release; held OK opens actions once and never also plays',()=>{
 const jobs=new Map();let next=0,plays=0,actions=0;
 const gesture=createCardPress({short:()=>plays++,long:()=>actions++,schedule:fn=>{jobs.set(++next,fn);return next;},cancel:id=>jobs.delete(id)});
 gesture.down();gesture.up();assert.equal(plays,1);assert.equal(jobs.size,0);
 gesture.down();gesture.down();assert.equal(jobs.size,1);[...jobs.values()][0]();gesture.up();assert.equal(actions,1);assert.equal(plays,1);
 gesture.down();gesture.cancel();assert.equal(gesture.up(),false);assert.equal(plays,1);
 gesture.down();gesture.up();assert.equal(plays,2);
});
test('anchor box comes from the layout model and a pending rail scroll',()=>{
 assert.deepEqual(anchorBoxFromLayout({trackRect:{left:100,top:300},left:480,top:0,width:210,height:380}),{left:580,top:300,width:210,height:380,right:790,bottom:680});
 assert.deepEqual(anchorBoxFromLayout({trackRect:{left:100,top:50},left:240,top:420,width:210,height:380,scrollDelta:200}),{left:140,top:470,width:210,height:380,right:350,bottom:850});
});
test('cells mid-transition or focus-scaled never move the anchor box or panel',()=>{
 const track={getBoundingClientRect:()=>({left:60,top:400}),clientLeft:0,clientTop:0};
 const cell=(transformX)=>({parentElement:track,matches:()=>true,style:{left:'720px',top:'',width:'210px',transform:`translate3d(${transformX}px,0,0)`},offsetWidth:210,offsetHeight:380,getBoundingClientRect:()=>({left:780+transformX,top:400,width:210,height:380})});
 const viewport={left:0,top:300,width:1920,height:780},placed=[0,231,462,700].map(x=>expandedCardPlacement(cellAnchorBox(cell(x)),viewport,{tv:true,alignStart:true}));
 for(const panel of placed)assert.deepEqual(panel,placed[0]);
 assert.equal(placed[0].left,780);
 const outside={matches:()=>false,parentElement:null,getBoundingClientRect:()=>({left:5,top:6,width:7,height:8})};assert.equal(cellAnchorBox(outside).left,5);
});
test('neighbourShifts: rail keeps the gap and left cells, grid moves only its row and fades what cannot fit',()=>{
 const cell=(index,left,top=0)=>({index,left,top,width:210,height:400});
 const rail=[0,1,2,3,4].map(index=>cell(index,index*240));
 assert.deepEqual(neighbourShifts({cells:rail,anchorIndex:1,panel:{left:240,top:0,width:1000,height:400},kind:'rail',viewportRight:1904}),{shifts:[[2,790],[3,790],[4,790]],faded:[],scroll:0});
 const scrolled=neighbourShifts({cells:rail,anchorIndex:4,panel:{left:784,top:0,width:1120,height:400},kind:'rail',viewportRight:1904});assert.equal(scrolled.scroll,176);assert.deepEqual(scrolled.faded,[],'the scrolled panel never covers its left neighbours');
 const grid=[...[0,1,2,3,4,5,6,7].map(index=>cell(index,index*240)),...[8,9].map(index=>cell(index,(index-8)*240,430))];
 const model=neighbourShifts({cells:grid,anchorIndex:1,panel:{left:240,top:0,width:700,height:400},kind:'grid',columns:8,viewportRight:1920});
 assert.deepEqual(model.shifts,[[2,490],[3,490],[4,490],[5,490]]);assert.deepEqual(model.faded,[6,7],'cells that would cross the grid edge fade instead of moving');
 assert.deepEqual(neighbourShifts({cells:grid,anchorIndex:1,panel:{left:240,top:0,width:700,height:440},kind:'grid',columns:8,viewportRight:1920}).faded,[6,7,9],'a taller panel fades the row it reaches, never moves it');
 assert.deepEqual(neighbourShifts({cells:grid,anchorIndex:7,panel:{left:1100,top:0,width:700,height:400},kind:'grid',columns:8,viewportRight:1920}).faded,[4,5,6],'a clamped grid panel fades the left cells it covers');
 assert.deepEqual(neighbourShifts({cells:grid,anchorIndex:99,panel:{left:0,top:0,width:1,height:1},kind:'grid',viewportRight:1920}),{shifts:[],faded:[],scroll:0});
});
test('the long-press hint shows three times per profile and retires after a real long press',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 const a=okHint('a',storage),b=okHint('b',storage);
 for(let i=0;i<3;i++){assert.equal(a.visible(),true);a.shown();}
 assert.equal(a.visible(),false);a.shown();assert.equal(map.get('rf-ok-hint:a'),'3');
 assert.equal(b.visible(),true);b.mastered();assert.equal(b.visible(),false);
 assert.equal(okHint('c',{getItem(){throw Error('blocked');},setItem(){}}).visible(),false);
});
test('remaining time is rounded up in minutes and hidden without progress',()=>{
 assert.equal(remainingLabel(1800,4320),'Te quedan 42 min');
 assert.equal(remainingLabel(4300,4320),'Te queda 1 min');
 assert.equal(remainingLabel(0,4320),'');assert.equal(remainingLabel(100,0),'');assert.equal(remainingLabel(5000,4320),'');
});
test('grid panels stay below the catalogue controls; rails below their heading',()=>{
 assert.equal(expansionViewportTop({mainTop:553,boxTop:640,gridTop:600,controlsBottom:610}),610,'first grid row: the chips row is lower than the grid top');
 assert.equal(expansionViewportTop({mainTop:553,boxTop:1400,gridTop:900,controlsBottom:700}),900,'a grid below other rows uses its own top');
 assert.equal(expansionViewportTop({mainTop:553,boxTop:300,gridTop:-2000,controlsBottom:-2100}),553,'scrolled away: the visible catalogue');
 assert.equal(expansionViewportTop({mainTop:553,boxTop:700,headingBottom:650}),674);assert.equal(expansionViewportTop({mainTop:0,boxTop:500}),0);
 const panel=expandedCardPlacement({left:100,top:640,width:300,height:250,right:400,bottom:890},{left:0,top:610,width:1920,height:470},{tv:true,live:true,tall:true});
 assert.ok(panel.top>=626,'the clamp moves the panel down instead of covering the chips');
});
test('F2: past the middle a rail panel opens left, with half a card of hysteresis and only when it fits',()=>{
 const at=(index,previous,scrollLeft=0)=>expansionAlignFor({cellLeft:index*240,cellWidth:210,scrollLeft,viewportWidth:1920,previous,panelWidth:1120});
 assert.deepEqual([0,3,4,5,7].map(index=>at(index)),['start','start','end','end','end'],'no memory: the centre decides');
 assert.equal(at(4,'start'),'start','a card just past the middle keeps the previous side');assert.equal(at(5,'start'),'end');
 assert.equal(at(4,'end'),'end');assert.equal(at(4,'end',150),'end','coming back near the middle (within half a card) does not flip');assert.equal(at(4,'start',150),'start');assert.equal(at(3,'end'),'start','more than half a card back flips');
 assert.equal(at(12,'start',1920),'start','the rail scroll is part of the centre');assert.equal(at(14,'start',1920),'end');
 assert.equal(expansionAlignFor({cellLeft:700,cellWidth:210,scrollLeft:0,viewportWidth:1000,panelWidth:1120}),'start','end needs room left of the card');
 // Kingdom A3: TV rails keep the focus at the fixed column (anchoredRailOffset), so the panel always grows right; F2 is PC only.
 assert.equal(expansionAlignFor({cellLeft:7*240,cellWidth:210,scrollLeft:7*240,viewportWidth:1920,previous:'end',tv:true}),'start');
 for(const index of [4,14,39])assert.equal(expansionAlignFor({cellLeft:index*240,cellWidth:210,scrollLeft:0,viewportWidth:1920,previous:'end',panelWidth:1000,tv:true}),'start','TV never flips, even past the middle');
 const viewport={left:0,top:0,width:1920,height:1080},anchor={left:1440,top:300,width:210,height:380,bottom:680},end=expandedCardPlacement(anchor,viewport,{tv:true,align:'end'});
 assert.equal(end.left+end.width,1650,'the right edge sits on the card');assert.deepEqual(expandedCardPlacement(anchor,viewport,{tv:true,alignStart:true}),expandedCardPlacement(anchor,viewport,{tv:true,align:'start'}));
 assert.equal(expandedCardPlacement({...anchor,left:200},viewport,{tv:true,align:'end'}).left,16,'clamped to the viewport');
 const rail=[0,1,2,3,4,5,6,7].map(index=>({index,left:index*240,top:0,width:210,height:400}));
 assert.deepEqual(neighbourShifts({cells:rail,anchorIndex:6,panel:{left:530,top:0,width:1120,height:400},kind:'rail',viewportRight:1904,viewportLeft:16,align:'end'}),{shifts:[[0,-910],[1,-910],[2,-910],[3,-910],[4,-910],[5,-910]],faded:[],scroll:0},'left cells move, right cells stay');
 const scrolled=neighbourShifts({cells:rail,anchorIndex:3,panel:{left:16,top:0,width:1120,height:400},kind:'rail',viewportRight:1904,viewportLeft:16,align:'end'});
 assert.equal(scrolled.scroll,-206,'a panel past the left edge scrolls the rail left once');assert.deepEqual(scrolled.faded,[],'the scrolled panel never covers its right neighbours');assert.ok(scrolled.shifts.every(([index,x])=>index<3&&x===-910));
});
test('R1.1 PC: neighbours move by Web Animations, the track reserves room; instant cleanup cancels, calm cleanup reverses',()=>{
 const track={style:{width:'720px',minWidth:'',minHeight:''}},cells=[0,1,2].map(index=>animatedCell(index,track));
 const group={dataset:{virtualKind:'rail'},scrollLeft:0,getBoundingClientRect:()=>({left:0,right:1920}),querySelector:()=>track,querySelectorAll:()=>cells,scrollTo(){}};
 const anchor={closest:selector=>selector==='[data-virtual-kind]'?group:cells[0]};
 Object.assign(globalThis,{window:{innerWidth:1920},getComputedStyle:()=>({paddingLeft:'0px'})});
 try{
  const box={left:0,right:210,width:210,top:0,bottom:380,height:380},space=reserveCardExpansion(anchor,box,{left:0,top:0,width:1000,height:380});
  assert.equal(space.scroll,0);assert.deepEqual(cells.map(motion),[[],[['translate3d(790px,0px,0)',220]],[['translate3d(790px,0px,0)',220]]]);assert.equal(track.style.minWidth,'1510px');
  assert.equal(cells[1].animations[0].options.fill,'forwards');assert.ok(cells.every(cell=>cell.style.transform===''&&cell.style.transition===''&&cell.style.willChange===''),'no inline writes');
  space.cleanup(true);assert.deepEqual(states(cells),['cancelled']);assert.equal(track.style.minWidth,'');
  const calm=reserveCardExpansion(anchor,box,{left:0,top:0,width:1000,height:380}),last=cells[1].animations.at(-1);calm.cleanup();
  assert.equal(last.state,'reversed');last.onfinish();assert.equal(last.state,'cancelled','a reversed neighbour lets go of its animation when it lands');
 }finally{delete globalThis.window;delete globalThis.getComputedStyle;}
});
test('R1.1 TV rail: later cells slide as one block by Web Animations, off-screen cells stay put (ola 4), cells mounted later join; cleanup cancels',()=>{
 const track={style:{width:'2160px'},clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:-group.scrollLeft,top:500})};
 const cells=[...Array(12).keys()].map(index=>animatedCell(index,track));track.children=cells;
 const group={dataset:{virtualKind:'rail'},scrollLeft:0,getBoundingClientRect:()=>({left:0,right:1920}),scrollTo({left}){this.scrollLeft=left;}};
 const anchorOf=index=>({closest:selector=>selector==='[data-virtual-kind]'?group:cells[index]});let observed;
 Object.assign(globalThis,{window:{innerWidth:1920},MutationObserver:class{constructor(callback){observed={callback,connected:false};}observe(target,options){Object.assign(observed,{target,options,connected:true});}disconnect(){observed.connected=false;}}});
 try{
  const box={left:240,right:450,width:210,top:500,bottom:880,height:380},space=reserveCardExpansion(anchorOf(1),box,{left:240,top:500,width:1120,height:380},true);
  assert.equal(space.scroll,0);assert.deepEqual([cells[0],cells[1]].map(motion),[[],[]],'the anchor and the cells before it stay');
  assert.deepEqual(cells.slice(2).map(cell=>motion(cell)[0]),[2,3,4,5,6,7].map(()=>['translate3d(910px,0px,0)',110]).concat([8,9,10,11].map(()=>undefined)),'visible cells glide (--tv-base); cells never on screen get no animation (no layer)');
  assert.ok(cells.every(cell=>cell.style.transform===''&&cell.style.transition===''&&cell.style.willChange===''),'no inline styles, no layer leases');
  assert.equal(observed.target,track);assert.deepEqual(observed.options,{childList:true});
  const mounted=animatedCell(12,track),before=animatedCell(0,track);observed.callback([{addedNodes:[mounted,before,{nodeType:3}]}]);
  assert.deepEqual(motion(mounted),[['translate3d(910px,0px,0)',0]],'a cell the scroll mounts takes the shift at once');assert.deepEqual(motion(before),[]);
  space.cleanup(true);assert.equal(observed.connected,false);assert.deepEqual(states([...cells,mounted]),['cancelled']);
  const edge=reserveCardExpansion(anchorOf(7),{left:1680,right:1890,width:210,top:500,bottom:880,height:380},{left:784,top:500,width:1120,height:380},true);
  assert.equal(edge.scroll,896,'the rail scrolls once so the panel starts at its card');assert.equal(group.scrollLeft,896);assert.deepEqual(motion(cells[8]),[],'right of the screen before and after: left alone');
  edge.cleanup();
 }finally{delete globalThis.window;delete globalThis.MutationObserver;}
});
test('R1.1 F2: a TV rail opening left slides the earlier cells; reduced motion jumps',()=>{
 const track={style:{width:'2880px'},clientLeft:0,clientTop:0,getBoundingClientRect:()=>({left:-group.scrollLeft,top:500})};
 const cells=[...Array(12).keys()].map(index=>animatedCell(index,track));track.children=cells;
 const group={dataset:{virtualKind:'rail'},scrollLeft:480,getBoundingClientRect:()=>({left:0,right:1920}),scrollTo({left}){this.scrollLeft=left;}};
 Object.assign(globalThis,{window:{innerWidth:1920}});
 try{
  const box={left:960,right:1170,width:210,top:500,bottom:880,height:380},space=reserveCardExpansion({closest:selector=>selector==='[data-virtual-kind]'?group:cells[6]},box,{left:50,top:500,width:1120,height:380},true,'end');
  assert.equal(space.scroll,0);assert.deepEqual(cells.map(cell=>motion(cell)[0]?.[1]??null),[null,null,110,110,110,110,null,null,null,null,null,null],'only the visible left cells glide; unseen ones are left alone');
  assert.equal(motion(cells[3])[0][0],'translate3d(-910px,0px,0)');space.cleanup(true);
  globalThis.matchMedia=query=>({matches:query.includes('reduce')});
  const edge=reserveCardExpansion({closest:selector=>selector==='[data-virtual-kind]'?group:cells[4]},{left:480,right:690,width:210,top:500,bottom:880,height:380},{left:16,top:500,width:1120,height:380},true,'end');
  assert.equal(edge.scroll,-446,'the rail scrolls left once so the panel ends at its card');assert.equal(group.scrollLeft,34);assert.deepEqual(cells.slice(0,4).map(cell=>cell.animations.length),[0,0,2,2],'the left cells seen around the scroll move again');assert.ok([cells[2],cells[3]].every(cell=>cell.animations.at(-1).options.duration===0),'reduced motion: duration 0');edge.cleanup();
 }finally{delete globalThis.window;delete globalThis.matchMedia;}
});
test('R1.1 neighbourMotions: shifts slide, covered cells fade, unseen cells jump; durations follow the F9 knob',()=>{
 assert.deepEqual(neighbourMotions({shifts:[[2,90],[3,90,40]],faded:[5],visible:index=>index!==3,move:110,fade:80}),[
  {index:2,keyframes:[{transform:'none'},{transform:'translate3d(90px,0px,0)'}],duration:110},
  {index:3,keyframes:[{transform:'none'},{transform:'translate3d(90px,40px,0)'}],duration:0},
  {index:5,keyframes:[{opacity:1},{opacity:0}],duration:80}]);
 assert.deepEqual(neighbourDurations({tv:true}),{move:110,fade:80});assert.deepEqual(neighbourDurations({tv:true,samsung:true}),{move:90,fade:60});
 assert.deepEqual(neighbourDurations({tv:false}),{move:220,fade:220});assert.deepEqual(neighbourDurations({tv:true,reduced:true}),{move:0,fade:0});
});
test('R1.2/R1.3 expansion hub: listeners are added once, events reach only registered controllers, hides and retired reservations wait for a frame',()=>{
 const added=[],handlers={},target=name=>({addEventListener(type,handler){added.push(`${name}:${type}`);handlers[type]=handler;}}),frames=[];
 const hub=createExpansionHub({win:target('window'),doc:target('document'),request:callback=>frames.push(callback)});
 const calls=[],controller=name=>({navigate:()=>{calls.push(`${name}:navigate`);hub.schedule();},focus:event=>calls.push(`${name}:focus:${event.id}`),frame:()=>calls.push(`${name}:frame`)});
 const offA=hub.register(controller('a'));offA();const offB=hub.register(controller('b'));hub.register(controller('c'))();
 assert.deepEqual(added,['window:focusin','window:pointermove','window:scroll','window:resize','window:richiflix-catalog-navigation','window:richiflix-preview-layout','document:visibilitychange'],'seven listeners, once, however many cards register');
 assert.equal(hub.size,1);handlers.focusin({id:1});handlers['richiflix-catalog-navigation']();handlers['richiflix-catalog-navigation']();
 assert.deepEqual(calls,['b:focus:1','b:navigate','b:navigate']);assert.equal(frames.length,1,'one frame, however many requests');
 const cleaned=[];hub.retire({cleanup:instant=>cleaned.push(instant)});hub.retire(undefined);assert.deepEqual(cleaned,[],'nothing runs inside the key');assert.equal(frames.length,1);
 frames.shift()();assert.deepEqual(cleaned,[true]);assert.equal(calls.at(-1),'b:frame');
 hub.retire({cleanup:instant=>cleaned.push(instant)});hub.flushRetired();assert.deepEqual(cleaned,[true,true],'an opening applies retired reservations in its own batch');
 frames.shift()();assert.deepEqual(cleaned,[true,true]);offB();assert.equal(hub.size,0);
});
