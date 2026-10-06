import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Play,Plus,Search,Heart,Settings,ChevronRight,X,Monitor,ArrowUp,Check,Maximize,Minimize,Shuffle} from 'lucide-react';
import {forProfile,canShowForKids,ratingFor} from './content.js';
import {useContent} from './useContent.js';
import {xtreamClient} from './xtreamClient.js';
import {XtreamSettings} from './XtreamSettings.jsx';
import {SeriesDetail} from './SeriesDetail.jsx';
import {isTVBuild} from './platform.js';
import {Dialog,Player,PageTitle,Empty} from './components.jsx';
import {Hero,motionAllowed,useReveal} from './interactions.jsx';
import {VirtualCatalogue} from './VirtualCatalogue.jsx';
import {VirtualCarousel} from './VirtualCarousel.jsx';
import {CategoryPicker} from './CategoryPicker.jsx';
import {CategoryChips} from './CategoryChips.jsx';
import {useHomeDiscovery} from './useHomeDiscovery.js';
import {TMDB_BEST,TMDB_RECENT} from './tmdbSelections.js';
import {useTmdbSelections} from './useTmdbSelections.js';
import {nearbyPreviewItems} from './nearbyPreview.js';
import {TitleFacts} from './UserScore.jsx';
import {Brand} from './Brand.jsx';
import {QualityImage} from './QualityImage.jsx';
import {artworkURL,displayTitle} from './artwork.js';
import {FocusStage} from './FocusStage.jsx';
import {MetadataSettings} from './MetadataSettings.jsx';
import {displayText} from './displayText.js';
import {scheduledEventTime,eventDisplayTitle} from './eventTime.js';
import {useEventSchedule} from './useEventSchedule.js';
import {composeChannels} from './channelArtwork.js';
import {createPreviewCache} from './previewCache.js';
import {createProactivePreviews} from './proactivePreviews.js';
import {clearPreviewArtwork,preloadPreviewArtwork,previewArtworkStats} from './previewArtwork.js';
import {warmTrailerAPI} from './TrailerPreview.jsx';
import {useBannerMotion} from './useBannerMotion.js';
import {useStableEvent} from './useStableEvent.js';
import {createCatalogueIndex} from './catalogueIndex.js';
import {useCatalogueSearch} from './useCatalogueSearch.js';
import {setSelectedCard} from './cardSelectionStore.js';
import {useProfileLibrary} from './useProfileLibrary.js';
import {loadHlsLibrary} from './hlsLibrary.js';
import {registerPerformanceStats} from './focusPaintDiagnostics.js';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const avatar=kind=>`${import.meta.env.BASE_URL}avatars/${kind==='kids'?'kids-kitten':'adult-raccoon'}.png`;
const count=number=>number.toLocaleString('es-CL');
export default function App({profile,changeProfile}){
 const isKids=profile.kind==='kids',catalogue=useContent(!isKids);
 const [page,setPage]=useState('Inicio'),[query,setQuery]=useState('');
 const {favorites,history,setFavorites,setHistory}=useProfileLibrary(profile.id);
 const [playing,setPlaying]=useState(null),[details,setDetails]=useState(null),[modal,setModal]=useState(null);
 const [notice,setNotice]=useState(''),[tv,setTv]=useState(isTVBuild||read('rf-tv-mode',true));
 const [previewItem,setPreviewItem]=useState(null),[previewActive,setPreviewActive]=useState(false),[previewPendingId,setPreviewPendingId]=useState(null),[metadataRevision,setMetadataRevision]=useState(0);
 const previewTimer=useRef(),leaveTimer=useRef(),previewCandidate=useRef(null),previewCard=useRef(null),pointerPosition=useRef({x:null,y:null}),stageMemory=useRef(null),previewContext=useRef(null),lastDirection=useRef('ArrowRight');
 const [category,setCategory]=useState('Todas');
 const stageScope=JSON.stringify([page,category,query]),previewScope=useRef(null);
 const mainRef=useRef(),searchRef=useRef(),fullscreenSession=useRef(null),experienceOrigin=useRef(null),playRequest=useRef(0),episodeOrigin=useRef(null),searchSubmitted=useRef(false);
 const banner=useBannerMotion(tv,mainRef,`${page}-${Boolean(query)}`);
 const previewCache=useMemo(()=>createPreviewCache(item=>xtreamClient().details(item.streamId,item.mediaType,item.sourceId)),[catalogue.connection.revision||catalogue.connection.key,metadataRevision]);
 useEffect(()=>()=>previewCache.dispose(),[previewCache]);
 const [scrolled,setScrolled]=useState(false),[showTop,setShowTop]=useState(false),[fullscreen,setFullscreen]=useState(false),[featureDetails,setFeatureDetails]=useState({});
 const selections=useTmdbSelections(`${catalogue.connection.revision||catalogue.connection.key||''}:${catalogue.updatedAt||''}:${metadataRevision}`,!isKids&&Boolean(catalogue.movies.length||catalogue.shows.length)&&!catalogue.loading);
 const [cachedScores,setCachedScores]=useState({});
 useEffect(()=>{let closed=false;setCachedScores({});xtreamClient().cachedRatings?.().then(data=>{if(!closed)setCachedScores(data);}).catch(()=>{});return()=>{closed=true;};},[previewCache,catalogue.updatedAt]);
 const metadataMerges=useRef(new WeakMap());
 const cardMetadata=useMemo(()=>{const next=Object.assign(Object.create(cachedScores),selections.metadata);for(const [id,data]of Object.entries(featureDetails)){const base=selections.metadata[id]||cachedScores[id];if(!base){next[id]=data;continue;}const cached=metadataMerges.current.get(data);if(cached?.base===base){next[id]=cached.value;continue;}const value=data.tmdbId&&data.tmdbId!==base.tmdbId?{...data}: {...base,...data};metadataMerges.current.set(data,{base,value});next[id]=value;}return next;},[selections.metadata,featureDetails,cachedScores]);
 const detailsCount=useRef(0);detailsCount.current=Object.keys(featureDetails).length;
 useEffect(()=>registerPerformanceStats('previews',()=>({...previewCache.stats,...previewArtworkStats(),visibleDetailCache:detailsCount.current})),[previewCache]);
 const movies=useMemo(()=>forProfile(catalogue.movies,profile),[catalogue.movies,profile]);
 const shows=useMemo(()=>forProfile(catalogue.shows,profile),[catalogue.shows,profile]);
 const scheduledChannels=useMemo(()=>!isKids&&catalogue.preparedChannels?catalogue.preparedChannels:composeChannels(forProfile(catalogue.channels,profile)).map(item=>{
  const source=(catalogue.sources||catalogue.connection.sources||[]).find(source=>source.id===item.sourceId);
  const timed={...item,eventStartsAt:scheduledEventTime(item,{updatedAt:item.catalogueUpdatedAt||catalogue.updatedAt,host:source?.host})};
  return {...timed,eventDisplayTitle:eventDisplayTitle(timed)};
 }),[catalogue.preparedChannels,isKids,catalogue.channels,catalogue.updatedAt,catalogue.sources,catalogue.connection.sources,profile]);
 const channels=useEventSchedule(scheduledChannels);
 const all=useMemo(()=>[...movies,...shows,...channels],[movies,shows,channels]);
 const featuredBase=useMemo(()=>(movies.length?movies:shows.length?shows:channels).slice(0,4),[movies,shows,channels]);
 const index=useMemo(()=>createCatalogueIndex(all),[all]);
 useEffect(()=>{
  banner.reset();clearTimeout(previewTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;previewScope.current=null;stageMemory.current=null;
  setPreviewItem(null);setPreviewActive(false);setPreviewPendingId(null);setSelectedCard(null);
 },[previewCache]);
 const favoriteIds=useMemo(()=>new Set(favorites),[favorites]);
 const continuing=useMemo(()=>all.filter(item=>history[item.id]>0),[all,history]);
 const savedItems=useMemo(()=>all.filter(item=>favoriteIds.has(item.id)),[all,favoriteIds]);
 const featured=useMemo(()=>featuredBase.map(item=>({...item,...cardMetadata[item.id]})),[featuredBase,cardMetadata]);
 const featureKey=featuredBase.map(item=>item.id).join(',');
 const publishPreview=useStableEvent((item,data)=>setFeatureDetails(previous=>{
  if(previous[item.id]===data)return previous;
  const next={...previous};delete next[item.id];next[item.id]=data;
  const keep=new Set([...featuredBase.map(item=>item.id),item.id,previewItem?.id]);
  const ids=Object.keys(next);let retained=ids.length;
  for(const id of ids){if(retained<=80)break;if(!keep.has(id)){delete next[id];retained--;}}
  return next;
 }));
 const proactive=useMemo(()=>createProactivePreviews({cache:previewCache,publish:(item,data)=>publishPreview(item,data)}),[previewCache]);
 useEffect(()=>()=>proactive.dispose(),[proactive]);
 useEffect(()=>proactive.enable(!banner.moving&&!details&&!playing&&!modal),[proactive,banner.moving,details,playing,modal]);
 const warmWindow=useMemo(()=>(id,items)=>proactive.watch(id,items),[proactive]);
 const resolvedMetadata=useMemo(()=>new Set(Object.keys(featureDetails)),[featureDetails]);
 const preparePreview=useStableEvent((item,priority=false,warmArt=false)=>{
  if(!item||!['movie','series'].includes(item.mediaType))return;
  const warmingFor=previewCandidate.current?.id;
  if(priority&&(!featureDetails[item.id]||!Object.keys(featureDetails[item.id]).length))setPreviewPendingId(item.id);
  previewCache.get(item,priority).then(data=>{
   if(previewCache.disposed)return;
   if(warmArt&&!banner.moving&&previewCandidate.current?.id===warmingFor)preloadPreviewArtwork({...item,...data});
   publishPreview(item,data);
  }).catch(error=>{
   // Cancelled navigation jobs are unknown, not missing artwork.
   if(!previewCache.disposed&&!['Vista reemplazada','Vista cerrada'].includes(error?.message))publishPreview(item,{});
  }).finally(()=>{if(priority&&!previewCache.disposed)setPreviewPendingId(previous=>previous===item.id?null:previous);});
 });
 useEffect(()=>{setFeatureDetails({});featuredBase.slice(0,2).forEach((item,index)=>preparePreview(item,false,true));},[featureKey,previewCache]);
 useEffect(()=>{if(movies.length||shows.length)warmTrailerAPI();},[Boolean(movies.length||shows.length)]);
 useEffect(()=>localStorage.setItem('rf-tv-mode',JSON.stringify(tv)),[tv]);
 useEffect(()=>()=>{clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);clearPreviewArtwork();setSelectedCard(null);},[]);
 const commitPreview=useStableEvent(()=>{
  const item=previewCandidate.current;if(!item)return false;
  const focused=document.activeElement?.closest('.card,.focus-stage,.topbar');
  if(tv&&!focused?.classList.contains('focus-stage')&&focused?.dataset.cardId!==previewCard.current&&pointerPosition.current.cardId!==previewCard.current)return false;
  previewScope.current=stageScope;setPreviewItem(previous=>previous?.id===item.id?previous:item);setPreviewActive(true);preparePreview(item,true,true);return true;
 });
 const preview=useStableEvent((item,cardId,context)=>{
  if(context)previewContext.current=context;
  previewCandidate.current=item;previewCard.current=cardId;setSelectedCard(cardId);clearTimeout(leaveTimer.current);clearTimeout(previewTimer.current);
  if(tv){setPreviewActive(false);banner.select(commitPreview);}else previewTimer.current=setTimeout(commitPreview,150);
 });
 const keepPreview=useStableEvent(()=>{clearTimeout(leaveTimer.current);if(tv)banner.keep(()=>{if(previewCandidate.current)return commitPreview();setPreviewActive(true);preparePreview(stageItem,true,true);return true;});else setPreviewActive(true);});
 const leavePreview=useStableEvent(()=>{if(document.activeElement?.closest('.card,.focus-stage,.topbar')||document.querySelector('.card:hover,.focus-stage:hover'))return;clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);leaveTimer.current=setTimeout(()=>{
  if(document.activeElement?.closest('.card,.focus-stage,.topbar')||document.querySelector('.card:hover,.focus-stage:hover'))return;setPreviewActive(false);banner.reset();if(!tv)setPreviewItem(null);
 },250);});
 const navigate=useStableEvent(name=>{if(name==='Inicio'&&page!=='Inicio')discovery.change();banner.reset();clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;previewScope.current=null;stageMemory.current=null;setPreviewItem(null);setSelectedCard(null);setPreviewActive(false);setPage(name);setQuery('');setCategory('Todas');window.scrollTo({top:0,behavior:motionAllowed()?'smooth':'instant'});});
 useEffect(()=>{banner.reset();clearTimeout(previewTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;setPreviewItem(null);setSelectedCard(null);setPreviewActive(false);mainRef.current?.scrollTo({top:0,behavior:'instant'});if(tv&&document.activeElement?.closest('.topbar')){banner.show();setPreviewActive(true);}},[query,category,page]);
 useReveal(mainRef,`${page}-${Boolean(query)}-${catalogue.loading}-${category}`);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{const scroll=()=>{setScrolled(window.scrollY>20);setShowTop(window.scrollY>600);};window.addEventListener('scroll',scroll,{passive:true});return()=>window.removeEventListener('scroll',scroll);},[]);
 useEffect(()=>{const search=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'&&!document.querySelector('[role="dialog"]')){e.preventDefault();searchRef.current?.focus();}};window.addEventListener('keydown',search);return()=>window.removeEventListener('keydown',search);},[]);
 useEffect(()=>{let unsubscribe;const sync=()=>setFullscreen(Boolean(document.fullscreenElement));if(window.richiflix?.onFullscreenChange){window.richiflix.getFullscreen().then(setFullscreen);unsubscribe=window.richiflix.onFullscreenChange(setFullscreen);}else document.addEventListener('fullscreenchange',sync);return()=>{unsubscribe?.();document.removeEventListener('fullscreenchange',sync);};},[]);
 useEffect(()=>{if(tv)requestAnimationFrame(()=>document.querySelector('.topbar nav button.active')?.focus());},[tv]);
 useEffect(()=>{if(!tv)return;const back=event=>{if(event.defaultPrevented||event.key!=='Escape'||document.querySelector('[role="dialog"]'))return;event.preventDefault();if(document.activeElement?.closest('.card,.focus-stage,.catalog-controls')){setPreviewActive(false);document.querySelector('.topbar nav button.active')?.focus();}else if(query){setQuery('');document.querySelector('.topbar nav button.active')?.focus();}else if(page!=='Inicio')navigate('Inicio');else changeProfile();};window.addEventListener('keydown',back);return()=>window.removeEventListener('keydown',back);},[tv,page,query,changeProfile]);
 const allowed=item=>!isKids||canShowForKids(item);
 function beginExperience(){
  clearTimeout(previewTimer.current);banner.reset();setPreviewActive(false);
  if(isTVBuild||fullscreenSession.current)return;
  experienceOrigin.current=document.activeElement;
  const session={original:Boolean(document.fullscreenElement),ready:null};fullscreenSession.current=session;
  if(window.richiflix?.setFullscreen)session.ready=window.richiflix.getFullscreen().then(previous=>{session.original=previous;return window.richiflix.setFullscreen(true);}).catch(()=>{});
  else session.ready=(document.fullscreenElement?Promise.resolve():document.documentElement.requestFullscreen?.())?.catch(()=>{})||Promise.resolve();
 }
 function closeExperience(){
  if(playing?.mediaType==='episode'&&episodeOrigin.current){playRequest.current++;setPlaying(null);setDetails(episodeOrigin.current.item);return;}
  episodeOrigin.current=null;
  playRequest.current++;setDetails(null);setPlaying(null);const session=fullscreenSession.current;fullscreenSession.current=null;
  session?.ready.then(()=>{if(fullscreenSession.current)return;if(window.richiflix?.setFullscreen)window.richiflix.setFullscreen(session.original).catch(()=>{});else if(!session.original&&document.fullscreenElement)document.exitFullscreen().catch(()=>{});else if(session.original&&!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});});
 }
 const toggleFullscreen=()=>{if(window.richiflix?.setFullscreen)window.richiflix.setFullscreen(!fullscreen).catch(()=>{});else if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else document.documentElement.requestFullscreen?.().catch(()=>{});};
 const inspect=useStableEvent(item=>{
  if(!allowed(item))return;episodeOrigin.current=null;setNotice('');beginExperience();setDetails({...item,...cardMetadata[item.id]});
  if(['movie','series'].includes(item.mediaType))previewCache.get(item,true).then(data=>setDetails(previous=>previous?.id===item.id?{...previous,...data}:previous)).catch(()=>{});
 });
 const toggle=useStableEvent(item=>{if(allowed(item)){const saved=favorites.includes(item.id);setFavorites(previous=>previous.includes(item.id)?previous.filter(id=>id!==item.id):[...previous,item.id]);setNotice(`${item.title} · ${saved?'Quitado de':'Añadido a'} Mi lista`);}});
 const open=useStableEvent(async item=>{
  if(!allowed(item))return;if(item.mediaType==='series'){inspect(item);return;}
  if(!isTVBuild&&item.mediaType==='live')loadHlsLibrary().catch(()=>{});
  const request=++playRequest.current;setNotice('');beginExperience();
  try{const url=await xtreamClient().playback(item);if(playRequest.current!==request)return;setPlaying({...item,url});setDetails(null);}catch{if(playRequest.current===request){if(!details)closeExperience();setNotice('No pudimos preparar la reproducción. Revisa la conexión en Ajustes.');}}
 });
 const playEpisode=useStableEvent((episode,selection)=>{if(!allowed(episode)||!details)return;episodeOrigin.current={item:details,...selection};open(episode);});
 const destination=item=>item.mediaType==='series'?'Series':item.mediaType==='live'?'TV en vivo':'Películas';
 const moreButtons=useMemo(()=>Object.fromEntries(['Películas','Series','TV en vivo'].map(name=>[name,<button className="row-more" onClick={()=>navigate(name)}>Ver todo <ChevronRight size={15}/></button>])),[navigate]);
 const pointerPreview=useStableEvent((item,event,cardId,context)=>{const intent=pointerPosition.current;if(!tv||(intent.itemId===item.id&&performance.now()-intent.at<200))preview(item,cardId,context);});
 const previewProps={preview,pointerPreview,leave:leavePreview,tv,warmWindow,resolvedMetadata};
 const row=(title,items)=>{const visible=index.filter(items,query);return visible.length?<VirtualCarousel title={title} items={visible} open={tv?open:inspect} metadata={cardMetadata} history={history} favorites={favorites} toggle={toggle} {...previewProps} more={visible.length>40&&moreButtons[destination(visible[0])]}/>:null;};
 const cards=items=><VirtualCatalogue items={items} metadata={cardMetadata} open={tv?open:inspect} history={history} favorites={favorites} toggle={toggle} {...previewProps}/>;
 const smartCollections=useMemo(()=>selections.collections.map(group=>({...group,items:group.ids.map(id=>index.byId.get(id)).filter(Boolean)})).filter(group=>group.items.length),[selections.collections,index]);
 const discovery=useHomeDiscovery(smartCollections,profile.id);
 const categoryBundles=useMemo(()=>new Map([movies,shows].map(items=>{const groups=smartCollections.filter(group=>group.type===(items===shows?'series':'movie'));return [items,{groups,names:[...new Set([...groups.map(group=>group.name),...index.categories(items)])]}];})),[movies,shows,smartCollections,index]);
 const smartFor=items=>categoryBundles.get(items)?.groups||[];
 const categoryNames=items=>categoryBundles.get(items)?.names||index.categories(items);
 const categoryControls=(title,items)=>(items===movies||items===shows)?<CategoryChips categories={categoryNames(items)} collections={smartFor(items)} value={category} change={setCategory} title={title}/>:<CategoryPicker categories={categoryNames(items)} value={category} change={setCategory} title={title}/>;
 const categoryItems=items=>smartFor(items).find(group=>group.name===category)?.items;
 const filteredItems=items=>{const chosen=categoryItems(items);return chosen?index.filter(chosen,query):index.filter(items,query,category);};
 const catalogueGrid=(title,items)=>{
  const visible=filteredItems(items);
  return <><PageTitle title={title}/><div className={`catalog-controls ${items===movies||items===shows?'has-category-chips':''}`}><p className="catalog-count">{count(visible.length)} títulos</p>{categoryControls(title,items)}</div>{cards(visible)}{!visible.length&&!catalogue.loading&&<p className="empty-inline">{isKids?'No hay títulos con edad verificada de hasta 10 años.':'Sin títulos en esta categoría.'}</p>}</>;
 };
 const baseball=useMemo(()=>channels.filter(item=>/\bmlb\b|baseball|b[eé]isbol/i.test(item.title+' '+item.genre)),[channels]);
 const searchSource=page==='Películas'?movies:page==='Series'?shows:page==='TV en vivo'?channels:page==='Mi lista'?savedItems:page==='MLB'?baseball:all;
 const smartSearch=categoryItems(searchSource);
 const search=useCatalogueSearch(index,smartSearch||searchSource,query,smartSearch?'Todas':category),searchResults=search.items;
 const submitSearch=useStableEvent(event=>{const key=event.key==='Unidentified'?{13:'Enter',40:'ArrowDown',10009:'Escape'}[event.keyCode]:event.key;if(!tv||event.nativeEvent.isComposing||!['Enter','Escape'].includes(key))return;event.preventDefault();event.stopPropagation();searchRef.current?.blur();if(key==='Escape'){searchSubmitted.current=false;document.querySelector('.topbar nav button.active')?.focus();return;}searchSubmitted.current=true;if(!search.loading){requestAnimationFrame(()=>{searchSubmitted.current=false;(mainRef.current?.querySelector('.card-open')||document.querySelector('.topbar nav button.active'))?.focus({preventScroll:true});});}});
 useEffect(()=>{if(!searchSubmitted.current||search.loading)return;const frame=requestAnimationFrame(()=>{searchSubmitted.current=false;(mainRef.current?.querySelector('.card-open')||document.querySelector('.topbar nav button.active'))?.focus({preventScroll:true});});return()=>cancelAnimationFrame(frame);},[search.loading,searchResults]);
 const sectionFirst=page==='Películas'?filteredItems(movies)[0]:page==='Series'?filteredItems(shows)[0]:page==='TV en vivo'?index.filter(channels,'',category)[0]:page==='MLB'?index.filter(baseball,'',category)[0]:page==='Mi lista'?savedItems[0]:featured[0];
 const stageFirst=query?searchResults[0]:sectionFirst;
 const validStage=item=>item&&index.byId.get(item.id)&&(page!=='Mi lista'||favoriteIds.has(item.id));
 const rememberedStage=stageMemory.current?.scope===stageScope&&validStage(stageMemory.current.item)?index.byId.get(stageMemory.current.item.id):null;
 const selectedStage=previewScope.current===stageScope&&validStage(previewItem)?index.byId.get(previewItem.id):null;
 const stageBase=stageFirst?(selectedStage||rememberedStage||index.byId.get(stageFirst.id)||stageFirst):null;
 stageMemory.current=stageBase?{scope:stageScope,item:stageBase}:null;
 const stageItem=useMemo(()=>stageBase?{...stageBase,...cardMetadata[stageBase.id]}:null,[stageBase,cardMetadata[stageBase?.id]]);
 useEffect(()=>{if(stageItem)return;banner.reset();clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;previewScope.current=null;setPreviewItem(null);setPreviewActive(false);setPreviewPendingId(null);setSelectedCard(null);},[stageItem?.id]);
 const stageMetadataPending=stageItem&&['movie','series'].includes(stageItem.mediaType)&&(!Object.hasOwn(featureDetails,stageItem.id)||previewPendingId===stageItem.id);
 useEffect(()=>{if(tv&&stageItem&&!details&&!playing&&!modal&&document.activeElement?.closest('.topbar')){banner.show();setPreviewActive(true);preparePreview(stageItem,false,true);}},[tv,stageItem?.id,page,details,playing,modal]);
 const headerPreview=useStableEvent(event=>{if(tv&&stageItem&&event.target.closest('.topbar')){setPreviewActive(true);banner.show();preparePreview(stageItem,false,true);}});
 const stageVisible=stageItem&&(tv||previewItem)&&!details&&!playing&&!modal;
 const nearby=useMemo(()=>{
  if(query)return searchResults;
  const source=page==='Series'?shows:page==='TV en vivo'?channels:page==='MLB'?baseball:page==='Mi lista'?savedItems:movies;
  const chosen=smartCollections.find(group=>group.name===category&&group.type===(source===movies?'movie':source===shows?'series':null));
  return chosen?.items||index.filter(source,'',category);
 },[index,query,searchResults,page,shows,channels,baseball,savedItems,movies,category,smartCollections]);
 useEffect(()=>{
  if(banner.moving||!previewActive)return;
  const context=previewContext.current;
  const neighbors=context?nearbyPreviewItems({...context,key:lastDirection.current}):nearby.slice(1,3);
  const warm=setTimeout(()=>neighbors.forEach(item=>preparePreview(item,false,true)),240);
  return()=>clearTimeout(warm);
 },[previewItem?.id,page,query,category,nearby.length,previewCache,banner.moving,previewActive]);
 return <div onFocusCapture={headerPreview} onKeyDownCapture={event=>{if(event.key.startsWith('Arrow')&&event.target.closest('.card'))lastDirection.current=event.key;pointerPosition.current.itemId=null;pointerPosition.current.cardId=null;}} onMouseMoveCapture={event=>{const previous=pointerPosition.current,moved=event.clientX!==previous.x||event.clientY!==previous.y;event.nativeEvent.richiflixPointerMoved=moved;if(moved){const card=event.target.closest('.card');pointerPosition.current={x:event.clientX,y:event.clientY,itemId:card?.dataset.contentId,cardId:card?.dataset.cardId,at:performance.now()};}}} className={`app ${tv?'tv-mode':''} ${tv&&stageItem?'has-tv-stage':''} ${banner.collapsed?'stage-collapsed':''} ${banner.moving?'is-browsing-rows':''} ${isKids?'kids-space':''} ${page==='Inicio'&&!query&&featured.length?'scenic':''}`}>
  <header className={`topbar ${scrolled?'is-scrolled':''}`}>
   <a className="brand" href="#" onClick={event=>{event.preventDefault();navigate('Inicio');}}><Brand/></a>
   <nav aria-label="Principal">{(isKids?['Inicio','Películas','Series','Mi lista']:['Inicio','Películas','Series','TV en vivo','MLB','Mi lista']).map(name=><button className={page===name?'active':''} aria-current={page===name?'page':undefined} key={name} onClick={()=>navigate(name)}>{name}</button>)}</nav>
   <div className="header-tools"><div className={`search ${query?'has-query':''}`}><Search size={21}/><input ref={searchRef} aria-label="Buscar títulos y canales" placeholder={page==='Películas'?'Buscar películas':page==='Series'?'Buscar series':'Buscar'} value={query} onChange={event=>setQuery(event.target.value)} data-tv-search={tv?'true':undefined} onKeyDown={event=>{if(tv){submitSearch(event);return;}if(event.key==='Escape'){setQuery('');event.currentTarget.blur();}}}/>{query&&<button aria-label="Limpiar búsqueda" onClick={()=>{setQuery('');searchRef.current?.focus();}}><X size={16}/></button>}</div>
    {!isTVBuild&&<button className={`icon-button ${tv?'selected':''}`} aria-label="Modo TV" aria-pressed={tv} onClick={()=>setTv(!tv)}><Monitor size={21}/></button>}
    <button className={`small-avatar ${isKids?'kids':'adult'}`} aria-label="Cambiar perfil" title={displayText(profile.name)} onClick={changeProfile}><QualityImage src={avatar(profile.kind)} eager fallback={false}/></button>
    <button className="icon-button" aria-label="Ajustes" onClick={()=>setModal('ajustes')}><Settings size={20}/></button>
   </div>
  </header>
  {stageVisible&&<FocusStage item={stageItem} metadataPending={stageMetadataPending} active={previewActive&&!banner.moving} loading={previewPendingId===stageItem.id&&previewActive&&!banner.moving} collapsed={banner.collapsed} moving={banner.moving} open={open} inspect={inspect} favorite={favorites.includes(stageItem.id)} toggle={toggle} tv={tv} hover={keepPreview} leave={leavePreview}/>}
  <main ref={mainRef} key={`${page}-${Boolean(query)}`} className="page-scene">
   {!tv&&page==='Inicio'&&!query&&featured.length>0&&<Hero items={featured} metadata={featureDetails} prepare={preparePreview} open={open} inspect={inspect}/>}
   <div className={`content ${page==='Inicio'&&!query&&featured.length?'home-content':''}`}>
    {!isKids&&catalogue.loading&&<p className="catalog-status" role="status">Cargando tus fuentes…</p>}
    {!isKids&&catalogue.error&&<p role="alert">{displayText(catalogue.error)}</p>}
    {!isKids&&!catalogue.loading&&!catalogue.connection.configured&&<Empty icon={Settings} title="Conecta tu IPTV" text="Tu login Xtream Codes reúne canales, películas y series." action={()=>setModal('ajustes')} label="Conectar"/>}
    {query?<><PageTitle title={page==='Películas'?'Buscar películas':page==='Series'?'Buscar series':'Resultados'}/><div className={`catalog-controls ${searchSource===movies||searchSource===shows?'has-category-chips':''}`}><p className="catalog-count" role={search.loading?'status':undefined}>{search.loading?'Buscando…':`${count(searchResults.length)} resultados`}</p>{categoryControls(page,searchSource)}</div>{cards(searchResults)}{!searchResults.length&&!search.loading&&<p className="empty-inline">Sin resultados.</p>}</>:<>
     {page==='Inicio'&&<>{row('Continuar viendo',continuing)}{row(isKids?'Una gran aventura':'Películas',movies)}{row('Series',shows)}{!isKids&&row('En vivo',channels)}{smartCollections.filter(group=>group.name===TMDB_BEST||group.name===TMDB_RECENT).sort((a,b)=>Number(a.name===TMDB_RECENT)-Number(b.name===TMDB_RECENT)).map(group=><React.Fragment key={`${group.type}:${group.name}`}>{row(group.name===TMDB_RECENT?(group.type==='movie'?'Películas recientes mejor valoradas · TMDB':'Series recientes mejor valoradas · TMDB'):(group.type==='movie'?'Películas mejor valoradas · TMDB':'Series mejor valoradas · TMDB'),group.items)}</React.Fragment>)}{discovery.groups.length>0&&<section className="home-discovery" aria-label="Descubre algo diferente"><div className="discovery-heading"><div><h2>Tu próximo mood</h2><p>Historias para descubrir, a tu ritmo.</p></div>{smartCollections.filter(group=>group.kind==='discovery').length>1&&<button className="discovery-refresh" onClick={discovery.change}><Shuffle aria-hidden="true"/>Otra selección</button>}</div>{discovery.groups.map(group=><React.Fragment key={group.key}>{row(group.name,group.items)}</React.Fragment>)}</section>}{isKids&&all.length===0&&<div className="empty-inline kids-empty"><h1>No hay títulos verificados para Kids</h1><p>Solo aparecen contenidos con edad confirmada de hasta 10 años.</p></div>}</>}
     {page==='Películas'&&catalogueGrid('Películas',movies)}
     {page==='Series'&&catalogueGrid('Series',shows)}
     {page==='TV en vivo'&&!isKids&&catalogueGrid('TV en vivo',channels)}
     {page==='MLB'&&!isKids&&catalogueGrid('MLB · Béisbol en vivo',baseball)}
     {page==='Mi lista'&&<><PageTitle title="Mi lista"/>{savedItems.length?cards(savedItems):<Empty icon={Heart} title="Tu lista está vacía" text="Guarda tus favoritos." action={()=>navigate('Películas')} label="Explorar"/>}</>}
    </>}
   </div>
  </main>
  {details&&allowed(details)&&(details.mediaType==='series'?<SeriesDetail item={details} close={closeExperience} play={playEpisode} favorite={favorites.includes(details.id)} toggle={toggle} history={history} selection={episodeOrigin.current?.item.id===details.id?episodeOrigin.current:undefined} tv={tv}/>:<Dialog immersive close={closeExperience} label={displayText(details.title)} restoreFocus={experienceOrigin.current}><QualityImage className="detail-image" src={details.kind==='iptv'?(details.imageGeneric?undefined:details.image):artworkURL(details.backdropImage,true)} fit={details.kind==='iptv'?'contain':'cover'} eager position="65% center"/>{details.kind!=='iptv'&&!details.backdropImage&&<QualityImage className="detail-poster" src={artworkURL(details.image)} eager fit="contain" fallback={false}/>}<div className="detail-atmosphere"/><div className="dialog-body detail-copy"><span className="pill">{displayText(details.genre)}{ratingFor(details)&&` · ${ratingFor(details).label}`}</span><h2>{displayTitle(details)}</h2><p>{displayText(details.description)}</p><TitleFacts item={details}/><small>{displayText(details.credit)}{details.kind==='iptv'?' · En vivo':''}</small><div className="dialog-actions">{details.mediaType!=='series'&&<button className="primary" onClick={()=>open(details)}><Play fill="currentColor" size={22}/> Reproducir</button>}<button className={`secondary favorite-action ${favorites.includes(details.id)?'saved':''}`} aria-pressed={favorites.includes(details.id)} onClick={()=>toggle(details)}>{favorites.includes(details.id)?<Check size={20}/>:<Plus size={20}/>} Mi lista</button></div></div></Dialog>)}
  {playing&&allowed(playing)&&<Player tvMode={tv} item={playing} start={history[playing.id]||0} save={seconds=>setHistory(previous=>({...previous,[playing.id]:seconds}))} close={closeExperience} fullscreen={fullscreen} toggleFullscreen={toggleFullscreen} restoreFocus={experienceOrigin.current}/>}
  {modal&&<Dialog immersive utility label="Ajustes" close={()=>setModal(null)}><div className="dialog-body settings-body"><span className="pill">TU RICHIFLIX</span><h2>Ajustes</h2><p>{displayText(profile.name)} · {isKids?'Kids · hasta 10 años':'Adulto'}</p>{!isKids&&<><XtreamSettings catalogue={catalogue}/><MetadataSettings changed={()=>setMetadataRevision(previous=>previous+1)}/></>}<div className="profile-settings-actions">{!isTVBuild&&<button className="secondary" onClick={toggleFullscreen}>{fullscreen?<Minimize/>:<Maximize/>}{fullscreen?'Salir de pantalla completa':'Pantalla completa'}</button>}<button className="secondary" onClick={changeProfile}>Cambiar perfil</button>{!isTVBuild&&<button className="secondary" onClick={()=>setTv(!tv)}><Monitor/>Modo TV: {tv?'activado':'desactivado'}</button>}<button className="secondary" onClick={()=>{setHistory({});setFavorites([]);setNotice('Historial y lista de este perfil eliminados.');}}>Borrar historial y Mi lista</button></div>{isKids&&<p className="small-print">El contenido sin clasificación confirmada se oculta.</p>}</div></Dialog>}
  {showTop&&!details&&!playing&&!modal&&<button className="back-top circle" aria-label="Volver arriba" onClick={()=>window.scrollTo({top:0,behavior:motionAllowed()?'smooth':'instant'})}><ArrowUp size={21}/></button>}
  {notice&&<div key={notice} className="toast" role="status"><Check size={18}/>{displayText(notice)}<button aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={16}/></button></div>}
 </div>;
}
