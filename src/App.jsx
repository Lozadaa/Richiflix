import React,{memo,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Play,Plus,Search,Settings,X,Monitor,ArrowUp,Check,Maximize,Minimize,Shuffle} from 'lucide-react';
import {forProfile,canShowForKids,ratingFor} from './content.js';
import {useContent} from './useContent.js';
import {blockContent} from './contentStore.js';
import {isPornographic} from './contentPolicy.js';
import {xtreamClient} from './xtreamClient.js';
import {XtreamSettings} from './XtreamSettings.jsx';
import {SeriesDetail} from './SeriesDetail.jsx';
import {isTVBuild} from './platform.js';
import {Dialog,Player,PageTitle,Empty} from './components.jsx';
import {Hero,motionAllowed,useReveal} from './interactions.jsx';
import {VirtualCatalogue} from './VirtualCatalogue.jsx';
import {VirtualCarousel} from './VirtualCarousel.jsx';
import {revealRowFor} from './virtualNavigation.js';
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
import {CardTrailerPreview} from './CardTrailerPreview.jsx';
import {MetadataSettings} from './MetadataSettings.jsx';
import {displayText} from './displayText.js';
import {scheduledEventTime,eventDisplayTitle} from './eventTime.js';
import {useEventSchedule} from './useEventSchedule.js';
import {groupLiveEvents,splitLiveEvents,homeLiveEvents,preferredFeed,rememberFeed,liveHubRows,liveChipItems} from './liveEvents.js';
import {LiveHub} from './LiveHub.jsx';
import {useChannelGuide} from './useChannelGuide.js';
import {useLivePhases,useEventPhase} from './EventBadge.jsx';
import {FollowContext} from './ExpandedCard.jsx';
import {followedEventIds,upcomingAlerts,teamLabel,teamAbbreviation} from './followedTeams.js';
import {TEAM_LIMIT} from './libraryStorage.js';
import {composeChannels} from './channelArtwork.js';
import {createPreviewCache} from './previewCache.js';
import {createProactivePreviews} from './proactivePreviews.js';
import {clearPreviewArtwork,preloadPreviewArtwork,previewArtworkStats} from './previewArtwork.js';
import {createArtworkPrefetch,loadPosterArtwork,shownArtwork,tvPrefetchOptions} from './artworkPrefetch.js';
import {warmTrailerAPI} from './TrailerPreview.jsx';
import {AUTO_TRAILERS_KEY,TV_TRAILER_DELAY_MS,readAutoTrailers} from './trailerApi.js';
import {useBannerMotion,useBannerCarousel} from './useBannerMotion.js';
import {useTVBannerVisibility,useTVBannerLayout} from './useTVBannerVisibility.js';
import {recommendedBanner} from './bannerRecommendations.js';
import {usePreviewPlayback} from './previewPlaybackStore.js';
import {useStableEvent} from './useStableEvent.js';
import {createCatalogueIndex} from './catalogueIndex.js';
import {useCatalogueSearch} from './useCatalogueSearch.js';
import {genreAlternatives,catalogueMatch,useTmdbSuggestion} from './searchSuggestions.js';
import {EmptyState} from './EmptyState.jsx';
import {setSelectedCard} from './cardSelectionStore.js';
import {useProfileLibrary} from './useProfileLibrary.js';
import {continueWatchingEntries,WATCHED_FRACTION} from './watchProgress.js';
import {adjacentEpisode} from './episodeWindow.js';
import {loadHlsLibrary} from './hlsLibrary.js';
import {registerPerformanceStats,recordAppRender} from './focusPaintDiagnostics.js';
import {publishMetadata,setMetadataLayer,getMetadata,getPreviewDetails,resetMetadata,setMetadataPriority,getMetadataPriority,metadataStats,trackMetadataPending,useMetadataEntry} from './metadataStore.js';
trackMetadataPending();
import {homeRowsForTV,backTarget,recentlyAdded,isNew,topTen} from './tvHome.js';
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
// G5a: 128 px avatars for the 38-54 px header (the 1254 px originals cost a 1.6 Mpx decode).
const avatar=kind=>`${import.meta.env.BASE_URL}avatars/${kind==='kids'?'kids-kitten':'adult-raccoon'}-128.png`;
const count=number=>number.toLocaleString('es-CL'),isBaseball=item=>/\bmlb\b|baseball|b[eé]isbol/i.test((item.searchText||item.title)+' '+item.genre);
// Fase G: one preconnect per provider origin (URL.origin drops any credentials).
const preconnected=new Set();
export default function App({profile,changeProfile}){
 recordAppRender();
 const isKids=profile.kind==='kids',catalogue=useContent(!isKids);
 const [page,setPage]=useState('Inicio'),[query,setQuery]=useState(''),[collectionView,setCollectionView]=useState(null);
 const {favorites,history,teams,intros,watched,durations,recent,setFavorites,setHistory,setTeams,setIntros,setWatched,setDurations,setRecent}=useProfileLibrary(profile.id);
 const [playing,setPlaying]=useState(null),[details,setDetails]=useState(null),[modal,setModal]=useState(null);
 const [notice,setNotice]=useState(''),[tv,setTv]=useState(isTVBuild||read('rf-tv-mode',true));
 const [autoTrailers,setAutoTrailers]=useState(readAutoTrailers),[cardFocus,setCardFocus]=useState(false),previewPlaying=usePreviewPlayback();
 const [previewItem,setPreviewItem]=useState(null),[previewActive,setPreviewActive]=useState(false),[metadataRevision,setMetadataRevision]=useState(0);
 const previewTimer=useRef(),leaveTimer=useRef(),previewCandidate=useRef(null),previewCard=useRef(null),pointerPosition=useRef({x:null,y:null}),stageMemory=useRef(null),previewContext=useRef(null),lastDirection=useRef('ArrowRight'),warmTimer=useRef();
 const [category,setCategory]=useState('Todas');
 const stageScope=JSON.stringify([page,category,query,collectionView?.title]),previewScope=useRef(null),viewAllPending=useRef(false);
 const mainRef=useRef(),searchRef=useRef(),fullscreenSession=useRef(null),experienceOrigin=useRef(null),playRequest=useRef(0),episodeOrigin=useRef(null),searchSubmitted=useRef(false);
 const banner=useBannerMotion(tv,mainRef,`${page}-${Boolean(query)}-${collectionView?.title||''}`);
 const bannerAtTop=useTVBannerVisibility(tv);
 const previewCache=useMemo(()=>createPreviewCache(item=>xtreamClient().details(item.streamId,item.mediaType,item.sourceId)),[catalogue.connection.revision||catalogue.connection.key,metadataRevision]);
 useEffect(()=>()=>previewCache.dispose(),[previewCache]);
 const [scrolled,setScrolled]=useState(false),[showTop,setShowTop]=useState(false),[fullscreen,setFullscreen]=useState(false);
 const selections=useTmdbSelections(`${catalogue.connection.revision||catalogue.connection.key||''}:${catalogue.updatedAt||''}:${metadataRevision}`,!isKids&&Boolean(catalogue.movies.length||catalogue.shows.length)&&!catalogue.loading);
 // R6.1: selections, cached scores, preview replies and the channel guide go to the metadata store (metadataStore.js);
 // each Card subscribes to its own id, so none of them rerenders App or the rails.
 useEffect(()=>{setMetadataLayer('selection',selections.metadata);},[selections.metadata]);
 useEffect(()=>{let closed=false;setMetadataLayer('score',{});xtreamClient().cachedRatings?.().then(data=>{if(!closed)setMetadataLayer('score',data||{});}).catch(()=>{});return()=>{closed=true;};},[previewCache,catalogue.updatedAt]);
 useEffect(()=>registerPerformanceStats('previews',()=>({...previewCache.stats,...previewArtworkStats(),visibleDetailCache:metadataStats().details})),[previewCache]);
 const movies=useMemo(()=>forProfile(catalogue.movies,profile),[catalogue.movies,profile]);
 const shows=useMemo(()=>forProfile(catalogue.shows,profile),[catalogue.shows,profile]);
 const scheduledChannels=useMemo(()=>!isKids&&catalogue.preparedChannels?forProfile(catalogue.preparedChannels,profile):composeChannels(forProfile(catalogue.channels,profile)).map(item=>{
  const source=(catalogue.sources||catalogue.connection.sources||[]).find(source=>source.id===item.sourceId);
  const timed={...item,eventStartsAt:scheduledEventTime(item,{updatedAt:item.catalogueUpdatedAt||catalogue.updatedAt,host:source?.host})};
  return {...timed,eventDisplayTitle:eventDisplayTitle(timed)};
 }),[catalogue.preparedChannels,isKids,catalogue.channels,catalogue.updatedAt,catalogue.sources,catalogue.connection.sources,profile]);
 const channels=useEventSchedule(scheduledChannels);
 // Fase L1: one card per event (its signals are feeds); lists follow phase changes, not every minute.
 const groupedLive=useMemo(()=>groupLiveEvents(channels),[channels]),livePhases=useLivePhases(groupedLive.events);
 const {events:liveEvents,channels:liveChannels}=useMemo(()=>splitLiveEvents(groupedLive),[groupedLive,livePhases]);
 // Fase L7: events of followed teams sort with Mi lista (only for ordering; Mi lista itself is unchanged).
 const followedIds=useMemo(()=>followedEventIds(liveEvents,isKids?[]:teams),[liveEvents,teams,isKids]),favoritesForLive=useMemo(()=>new Set([...favorites,...followedIds]),[favorites,followedIds]);
 const live=useMemo(()=>[...liveEvents,...liveChannels],[liveEvents,liveChannels]),homeLive=useMemo(()=>[...homeLiveEvents(liveEvents).sort((a,b)=>favoritesForLive.has(b.id)-favoritesForLive.has(a.id)),...liveChannels],[liveEvents,liveChannels,favoritesForLive]);
 const all=useMemo(()=>[...movies,...shows,...live],[movies,shows,live]);
 const featuredBase=useMemo(()=>(movies.length?movies:shows.length?shows:live).slice(0,4),[movies,shows,live]);
 const index=useMemo(()=>createCatalogueIndex(all),[all]);
 const collectionItems=useMemo(()=>collectionView?collectionView.items.map(item=>index.byId.get(item.id)).filter(Boolean):null,[collectionView,index]);
 useEffect(()=>{
  banner.reset();clearTimeout(previewTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;previewScope.current=null;stageMemory.current=null;
  setPreviewItem(null);setPreviewActive(false);setMetadataPriority(null);setSelectedCard(null);
 },[previewCache]);
 const favoriteIds=useMemo(()=>new Set(favorites),[favorites]);
 // D5: one entry per series, with the episode in progress or the next one.
 const continuing=useMemo(()=>continueWatchingEntries(all,history,watched,durations,recent),[all,history,watched,durations,recent]);
 const savedItems=useMemo(()=>all.filter(item=>favoriteIds.has(item.id)),[all,favoriteIds]);
 const featured=featuredBase;// R6: Hero and the stage merge their own metadata from the store.
 const featureKey=featuredBase.map(item=>item.id).join(',');
 const publishPreview=useStableEvent((item,data)=>{if(isPornographic(data)){blockContent(item.id);return;}publishMetadata(item.id,data);});
 const proactive=useMemo(()=>createProactivePreviews({cache:previewCache,publish:(item,data)=>publishPreview(item,data)}),[previewCache]);
 useEffect(()=>()=>proactive.dispose(),[proactive]);
 // G4: a burst no longer renders App on its first key, so the work App paused in that render (proactive previews,
 // prefetch, neighbour warming) is paused here; the settle render (new burst epoch) re-runs the effects that resume it.
 const burstEpoch=useRef(0);
 useEffect(()=>proactive.enable(!banner.moving&&!details&&!playing&&!modal),[proactive,banner.moving,details,playing,modal,burstEpoch.current]);
 // Fase G: rails also hand over their window when far (third argument). 150 ms
 // after a settled move, posters of the next 8 rail cards and the next 2 rows
 // in lastDirection are fetched at card size; never during a burst.
 const railWindows=useRef(new Map());
 // R4.5: the TV only prefetches the next row (tvPrefetchOptions); PC keeps Fase G.
 const prefetch=useMemo(()=>createArtworkPrefetch({load:loadPosterArtwork,done:shownArtwork,...(isTVBuild?tvPrefetchOptions:{})}),[]),prefetchRow=useRef(null);
 const warmWindow=useMemo(()=>(id,items,visible=items)=>{railWindows.current.set(id,visible);const stop=proactive.watch(id,items);return()=>{if(railWindows.current.get(id)===visible)railWindows.current.delete(id);stop();};},[proactive]);
 const prefetchActive=!banner.moving&&!details&&!playing&&!modal;
 useEffect(()=>{
  if(!prefetchActive){prefetch.pause();return;}
  if(isTVBuild){const row=document.activeElement?.closest?.('.catalog-row')||null;if(row!==prefetchRow.current){prefetchRow.current=row;prefetch.clear();}}
  prefetch.resume();
  const timer=setTimeout(()=>{
   const context=previewContext.current,card=document.activeElement?.closest?.('.card'),layoutWidth=card?.querySelector('.poster-art')?.clientWidth;
   if(!context||!layoutWidth)return;
   const key=lastDirection.current,up=key==='ArrowUp',vertical=up||key==='ArrowDown',targets=[];
   const poster=item=>{if(!item||item.kind==='iptv')return null;const merged={...item,...getMetadata(item.id)};return merged.imageGeneric?null:artworkURL(merged.image);};
   const rowSteps=isTVBuild?1:2;
   if(context.kind==='grid'){const {items,index,columns}=context,row=Math.floor(index/columns),column=index%columns;for(let step=1;step<=rowSteps;step++)for(let next=0;next<columns;next++){const position=(row+(up?-step:step))*columns+next;if(position>=0&&position<items.length)targets.push({src:poster(items[position]),distance:step*columns+Math.abs(next-column)});}}
   else{
    if(!isTVBuild)nearbyPreviewItems({...context,key:vertical?'ArrowRight':key,count:8}).forEach((item,step)=>targets.push({src:poster(item),distance:step+1+(vertical?8:0)}));
    const rows=[...document.querySelectorAll('.catalog-row[data-warm-id]')],current=rows.indexOf(card.closest('.catalog-row'));
    for(let step=1;current>=0&&step<=rowSteps;step++)(railWindows.current.get(rows[current+(up?-step:step)]?.dataset.warmId)||[]).forEach((item,position)=>targets.push({src:poster(item),distance:(step-1)*8+position+(vertical?0:8)}));
   }
   prefetch.plan(targets,{layoutWidth,dpr:window.devicePixelRatio||1});
  },150);
  return()=>clearTimeout(timer);
 },[prefetch,prefetchActive,previewItem?.id,cardFocus,burstEpoch.current]);
 useEffect(()=>{if(!tv)return;const pause=()=>{burstEpoch.current++;proactive.enable(false);prefetch.pause();clearTimeout(warmTimer.current);};window.addEventListener('richiflix-catalog-navigation',pause);return()=>window.removeEventListener('richiflix-catalog-navigation',pause);},[tv,proactive,prefetch]);
 useEffect(()=>{const unregister=registerPerformanceStats('artworkPrefetch',prefetch.stats);return()=>{unregister();prefetch.clear();};},[prefetch]);
 useEffect(()=>prefetch.clear(),[prefetch,page,query,category,collectionView]);
 useEffect(()=>{if(!catalogue.connection.configured)return;for(const source of [catalogue.connection,...(catalogue.sources||catalogue.connection.sources||[])]){let origin;try{origin=new URL(source.host).origin;}catch{continue;}if(!/^https?:/.test(origin)||preconnected.has(origin))continue;preconnected.add(origin);const link=document.createElement('link');link.rel='preconnect';link.href=origin;document.head.append(link);}},[catalogue.connection,catalogue.sources]);
 const preparePreview=useStableEvent((item,priority=false,warmArt=false)=>{
  if(!item||!['movie','series'].includes(item.mediaType))return;
  const warmingFor=previewCandidate.current?.id;
  if(priority&&!Object.keys(getPreviewDetails(item.id)||{}).length)setMetadataPriority(item.id);
  previewCache.get(item,priority).then(data=>{
   if(previewCache.disposed)return;
   if(isPornographic(data)){publishPreview(item,data);return;}
   // R4.2: the TV banner never follows the card and its panel uses the poster: no backdrop warming.
   if(warmArt&&!tv&&!banner.moving&&previewCandidate.current?.id===warmingFor)preloadPreviewArtwork({...item,...data});
   publishPreview(item,data);
  }).catch(error=>{
   // Cancelled navigation jobs are unknown, not missing artwork.
   if(!previewCache.disposed&&!['Vista reemplazada','Vista cerrada'].includes(error?.message))publishPreview(item,{});
  }).finally(()=>{if(priority&&!previewCache.disposed&&getMetadataPriority()===item.id)setMetadataPriority(null);});
 });
 useEffect(()=>{resetMetadata();featuredBase.slice(0,2).forEach((item,index)=>preparePreview(item,false,true));},[featureKey,previewCache]);
 useEffect(()=>{if(autoTrailers&&(movies.length||shows.length))warmTrailerAPI();},[autoTrailers,Boolean(movies.length||shows.length)]);
 useEffect(()=>localStorage.setItem('rf-tv-mode',JSON.stringify(tv)),[tv]);
 useEffect(()=>localStorage.setItem(AUTO_TRAILERS_KEY,JSON.stringify(autoTrailers)),[autoTrailers]);
 useEffect(()=>()=>{clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);clearPreviewArtwork();setSelectedCard(null);resetMetadata({layers:true});},[]);
 const commitPreview=useStableEvent(()=>{
  const item=previewCandidate.current;if(!item)return false;
  const focused=document.activeElement?.closest('.card,.focus-stage,.topbar');
  if(tv&&!focused?.classList.contains('focus-stage')&&focused?.dataset.cardId!==previewCard.current&&pointerPosition.current.cardId!==previewCard.current)return false;
  previewScope.current=stageScope;setPreviewItem(previous=>previous?.id===item.id?previous:item);setPreviewActive(true);preparePreview(item,true,true);return true;
 });
 const preview=useStableEvent((item,cardId,context)=>{
  if(context)previewContext.current=context;
  previewCandidate.current=item;previewCard.current=cardId;setSelectedCard(cardId);clearTimeout(leaveTimer.current);clearTimeout(previewTimer.current);
  // G4: the first key of a burst no longer renders App: previewActive turns false only if the settle commit fails.
  clearTimeout(warmTimer.current);if(tv)banner.select(settlePreview);else previewTimer.current=setTimeout(commitPreview,150);
 });
 const settlePreview=useStableEvent(()=>{if(commitPreview())return true;setPreviewActive(false);return false;});
 const keepPreview=useStableEvent(()=>{clearTimeout(leaveTimer.current);if(tv)banner.keep(()=>{if(previewCandidate.current)return commitPreview();setPreviewActive(true);preparePreview(stageBase,true,true);return true;});else setPreviewActive(true);});
 const leavePreview=useStableEvent(()=>{if(document.activeElement?.closest('.card,.card-expansion,.focus-stage,.topbar')||document.querySelector('.card:hover,.card-expansion:hover,.focus-stage:hover'))return;clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);leaveTimer.current=setTimeout(()=>{
  if(document.activeElement?.closest('.card,.card-expansion,.focus-stage,.topbar')||document.querySelector('.card:hover,.card-expansion:hover,.focus-stage:hover'))return;setPreviewActive(false);banner.reset();if(!tv)setPreviewItem(null);
 },250);});
 const navigate=useStableEvent(name=>{if(name==='Inicio'&&page!=='Inicio')discovery.change();banner.reset();clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;previewScope.current=null;stageMemory.current=null;setPreviewItem(null);setSelectedCard(null);setPreviewActive(false);setPage(name);setCollectionView(null);setQuery('');setCategory('Todas');window.scrollTo({top:0,behavior:motionAllowed()?'smooth':'instant'});});
 useEffect(()=>{banner.reset();clearTimeout(previewTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;setPreviewItem(null);setSelectedCard(null);setPreviewActive(false);mainRef.current?.scrollTo({top:0,behavior:'instant'});if(tv&&document.activeElement?.closest('.topbar')){banner.show();setPreviewActive(true);}},[query,category,page,collectionView]);
 useReveal(mainRef,`${page}-${Boolean(query)}-${catalogue.loading}-${category}-${collectionView?.title||''}`);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{const scroll=()=>{setScrolled(window.scrollY>20);setShowTop(window.scrollY>600);};window.addEventListener('scroll',scroll,{passive:true});return()=>window.removeEventListener('scroll',scroll);},[]);
 useEffect(()=>{const search=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'&&!document.querySelector('[role="dialog"]')){e.preventDefault();searchRef.current?.focus();}};window.addEventListener('keydown',search);return()=>window.removeEventListener('keydown',search);},[]);
 useEffect(()=>{let unsubscribe;const sync=()=>setFullscreen(Boolean(document.fullscreenElement));if(window.richiflix?.onFullscreenChange){window.richiflix.getFullscreen().then(setFullscreen);unsubscribe=window.richiflix.onFullscreenChange(setFullscreen);}else document.addEventListener('fullscreenchange',sync);return()=>{unsubscribe?.();document.removeEventListener('fullscreenchange',sync);};},[]);
 useEffect(()=>{if(tv)requestAnimationFrame(()=>document.querySelector('.topbar nav button.active')?.focus());},[tv]);
 useEffect(()=>{if(!tv)return;const header=()=>document.querySelector('.topbar nav button.active')?.focus();const back=event=>{if(event.defaultPrevented||event.key!=='Escape'||document.querySelector('[role="dialog"]'))return;event.preventDefault();const active=document.activeElement,target=backTarget({region:!active||active===document.body||active.closest('.topbar')?'header':active.closest('main .live-hub')&&!active.closest('.catalog-controls')?'live-rows':'content',query,page,collectionView});if(target==='chips')document.querySelector('main .live-hub .category-chip.selected')?.focus({preventScroll:true});else if(target==='header'){setPreviewActive(false);header();}else if(target==='clear-search'){setQuery('');header();}else if(target==='home'){navigate('Inicio');requestAnimationFrame(header);}else changeProfile();};window.addEventListener('keydown',back);return()=>window.removeEventListener('keydown',back);},[tv,page,query,collectionView,changeProfile]);
 const allowed=item=>!isPornographic(item)&&(!isKids||canShowForKids(item));
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
  if(!allowed(item))return;episodeOrigin.current=null;setNotice('');beginExperience();setDetails({...item,...getMetadata(item.id)});
  if(['movie','series'].includes(item.mediaType))previewCache.get(item,true).then(data=>{if(isPornographic(data)){publishPreview(item,data);setDetails(previous=>previous?.id===item.id?null:previous);return;}setDetails(previous=>previous?.id===item.id?{...previous,...data}:previous);}).catch(()=>{});
 });
 const toggle=useStableEvent(item=>{if(allowed(item)){const saved=favorites.includes(item.id);setFavorites(previous=>previous.includes(item.id)?previous.filter(id=>id!==item.id):[...previous,item.id]);setNotice(`${item.title} · ${saved?'Quitado de':'Añadido a'} Mi lista`);}});
 const toggleTeam=useStableEvent(id=>{
  const followed=teams.includes(id);if(!followed&&teams.length>=TEAM_LIMIT){setNotice(`Ya sigues ${TEAM_LIMIT} equipos · deja de seguir uno en Ajustes`);return;}
  setTeams(previous=>followed?previous.filter(team=>team!==id):[...previous,id]);setNotice(followed?`Dejaste de seguir a ${teamLabel(id)}`:`${teamLabel(id)} · Siguiendo`);
 });
 const follow=useMemo(()=>isKids?{teams:[],toggleTeam:null}:{teams,toggleTeam},[isKids,teams,toggleTeam]);
 // Fase L7: in-app alert when a followed game starts in ≤10 min or goes live. The toast's «Ver» takes focus
 // in TV (OK = ver) unless a card or its panel has it: then it reads «Arriba para ver» and Up from the card
 // reaches «Ver» (useRemoteNavigation). Back or an arrow closes it and returns focus to where it was. Notified lives in memory.
 const [followAlert,setFollowAlert]=useState(null),alertOrigin=useRef(null),notified=useRef(new Set());
 const followedEvents=useMemo(()=>liveEvents.filter(event=>followedIds.has(event.id)),[liveEvents,followedIds]);
 const showAlert=useStableEvent(()=>{
  const result=upcomingAlerts({events:followedEvents,teams,now:Date.now(),notified:notified.current}),first=result.alerts[0];notified.current=result.notified;if(!first)return;
  const steal=!(tv&&document.activeElement?.closest('.card,.card-expansion')),text=steal?first.text:first.text.replace('OK para ver','Arriba para ver');
  setFollowAlert({text,event:first.event,steal});setNotice(text);
 });
 const leaveAlert=(close=true)=>{const origin=alertOrigin.current;alertOrigin.current=null;if(close)setNotice('');if(origin?.isConnected)origin.focus({preventScroll:true});};
 useEffect(()=>{if(!notice&&alertOrigin.current&&(document.activeElement===document.body||!document.activeElement))leaveAlert(false);},[notice]);
 const open=useStableEvent(async item=>{
  if(!allowed(item))return;if(item.mediaType==='series'){inspect(item);return;}
  if(!isTVBuild&&item.mediaType==='live')loadHlsLibrary().catch(()=>{});
  // L6: a 24 h channel remembers the list it was opened from, for ChannelUp/ChannelDown in the player.
  const context=previewContext.current,siblings=!item.isEvent&&item.kind==='iptv'&&context?.items?.some(entry=>entry.id===item.id)?{items:context.items}:null;
  const request=++playRequest.current;setNotice('');beginExperience();
  // An event plays its preferred signal; if preparing it fails, the next signal is tried once.
  const first=item.isEvent?preferredFeed(item):null,targets=first?[first,item.feeds.find(feed=>feed.id!==first.id)].filter(Boolean).map(feed=>feed.item):[item];
  try{let url,target;for(const [attempt,candidate] of targets.entries()){try{url=await xtreamClient().playback(candidate);target=candidate;break;}catch(error){if(attempt===targets.length-1||playRequest.current!==request)throw error;}}
   if(playRequest.current!==request)return;setPlaying(item.isEvent?{...target,url,id:item.id,title:item.title,eventDisplayTitle:item.eventDisplayTitle,feedId:target.id,event:item,...(target!==targets[0]&&{trying:true,tried:[targets[0].id]})}:{...item,url,siblings});setDetails(null);}catch{if(playRequest.current===request){if(!details)closeExperience();setNotice('No pudimos preparar la reproducción. Revisa la conexión en Ajustes.');}}
 });
 // L6: another signal of the playing event, or a sibling channel, through the same session: the player dialog stays open.
 // D3: the next/previous episode also goes through here, so the player dialog stays open and history is kept per episode.
 const changeSource=useStableEvent(async({feed,channel,episode,trying=false})=>{
  const current=playing,target=feed?feed.item:channel||episode;if(!current||!target||!allowed(target))return false;
  const request=++playRequest.current;
  try{const url=await xtreamClient().playback(target);if(playRequest.current!==request)return false;
   if(feed){rememberFeed(current.event,feed.id);setPlaying({...target,url,id:current.id,title:current.title,eventDisplayTitle:current.eventDisplayTitle,feedId:feed.id,event:current.event,trying});}
   else if(episode){if(episodeOrigin.current)episodeOrigin.current={...episodeOrigin.current,season:episode.season,episodeId:episode.id};setPlaying({...episode,url});}
   else setPlaying({...target,url,siblings:current.siblings});
   return true;}catch{return false;}
 });
 // D5: playback position per id, plus the known duration, the watched mark (≥ 90 % or the end) and, for an episode, its series' latest episode.
 const savePlayback=useStableEvent((seconds,id,{duration,ended}={})=>{
  setHistory(previous=>({...previous,[id]:seconds}));
  const known=Number.isFinite(duration)&&duration>0?Math.round(duration):0;
  if(known)setDurations(previous=>previous[id]===known?previous:{...previous,[id]:known});
  if(ended||known&&seconds>=known*WATCHED_FRACTION)setWatched(previous=>previous[id]===true?previous:{...previous,[id]:true});
  const origin=episodeOrigin.current,episode=origin?.seasons?.flatMap(group=>group.episodes).find(entry=>entry.id===id);if(!episode)return;
  const next=adjacentEpisode(origin.seasons,id,1),ref=entry=>entry&&{id:entry.id,season:entry.season,episodeNumber:entry.episodeNumber};
  setRecent(previous=>previous[origin.item.id]?.episodeId===id?previous:{...previous,[origin.item.id]:{episodeId:id,season:episode.season,episodeNumber:episode.episodeNumber,next:ref(next),at:Date.now()}});
 });
 const markWatched=useStableEvent((ids,value)=>{setWatched(previous=>({...previous,...Object.fromEntries(ids.map(id=>[id,value]))}));if(!value)setHistory(previous=>Object.fromEntries(Object.entries(previous).filter(([id])=>!ids.includes(id))));});
 const seriesProgress=useMemo(()=>({watched,durations,recent,onMark:markWatched}),[watched,durations,recent,markWatched]);
 const playEpisode=useStableEvent((episode,selection)=>{if(!allowed(episode)||!details)return;episodeOrigin.current={item:details,...selection};open(episode);});
 const destination=item=>item.mediaType==='series'?'Series':item.mediaType==='live'?'TV en vivo':'Películas';
 const rowActionFocus=useStableEvent(()=>{banner.reset();clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;setPreviewActive(false);setSelectedCard(null);});
 const viewAllRow=useStableEvent((title,items)=>{viewAllPending.current=true;const group=smartCollections.find(group=>group.items===items);navigate(items===continuing?'Inicio':destination(items[0]));if(group)setCategory(group.name);else if(items===continuing)setCollectionView({title,items});});
 const pointerPreview=useStableEvent((item,event,cardId,context)=>{const intent=pointerPosition.current;if(!tv||(intent.itemId===item.id&&performance.now()-intent.at<200))preview(item,cardId,context);});
 const previewProps={preview,pointerPreview,leave:leavePreview,tv,warmWindow,profileId:profile.id,kids:isKids};
 const row=(title,items,{variant}={})=>{const visible=index.filter(items,query);return visible.length?<VirtualCarousel title={title} items={visible} open={tv?open:inspect} history={history} favorites={favorites} toggle={toggle} {...previewProps} freshIds={freshIds} variant={variant} viewAll={rowActions.get(items)} actionFocus={rowActionFocus}/>:null;};
 const cards=items=><VirtualCatalogue items={items} open={tv?open:inspect} history={history} favorites={favorites} toggle={toggle} {...previewProps}/>;
 const smartCollections=useMemo(()=>selections.collections.map(group=>({...group,items:group.ids.map(id=>index.byId.get(id)).filter(Boolean)})).filter(group=>group.items.length),[selections.collections,index]);
 // H2-T2: one clock per catalogue (never per key) for «Nuevo esta semana» and the NUEVO badge of every rail card.
 // H2-T3: Top 10 once TMDB_BEST has answered (empty until then, so the row stays hidden). No «Ver todo»: ten titles.
 const top=useMemo(()=>topTen(smartCollections,selections.metadata),[smartCollections,selections.metadata]);
 const {fresh,freshIds}=useMemo(()=>{const now=Date.now(),list=[...movies,...shows];return {fresh:recentlyAdded(list,now),freshIds:new Set(list.filter(item=>isNew(item,now)).map(item=>item.id))};},[movies,shows]);
 const rowActions=useMemo(()=>{const actions=new WeakMap();for(const [title,items]of [['Continuar viendo',continuing],[isKids?'Una gran aventura':'Películas',movies],['Series',shows],['Ahora en vivo',homeLive],...smartCollections.map(group=>[group.name,group.items])])actions.set(items,()=>viewAllRow(title,items));
  // A mixed films+series row opens as a collection view on Inicio (like Continuar viendo).
  actions.set(fresh,()=>{viewAllPending.current=true;navigate('Inicio');setCollectionView({title:'Nuevo esta semana',items:fresh});});
  return actions;},[continuing,isKids,movies,shows,homeLive,smartCollections,viewAllRow,fresh]);
 const discovery=useHomeDiscovery(smartCollections,profile.id);
 // Fase C2: in TV the Inicio banner is a recommendation carousel, independent of
 // the selected card (its information lives in the expanded card). It pauses for
 // key bursts, a focused/expanded card, a playing trailer, dialogs and hidden tabs.
 const bannerSlides=useMemo(()=>tv&&page==='Inicio'&&!query&&!collectionView?recommendedBanner({continuing,collections:smartCollections,featured:featuredBase}):[],[tv,page,query,collectionView,continuing,smartCollections,featuredBase]);
 const nextArt=useRef({}),nextArtChanged=useMemo(()=>(id,state)=>{nextArt.current={id,state};},[]);
 const carousel=useBannerCarousel(bannerSlides.map(item=>item.id),!bannerAtTop||banner.moving||cardFocus||previewPlaying||Boolean(details||playing||modal),next=>nextArt.current.id===bannerSlides[next]?.id&&nextArt.current.state!=='loading');
 const slide=bannerSlides[carousel.index],nextSlide=bannerSlides.length>1?bannerSlides[(carousel.index+1)%bannerSlides.length]:null;
 // Metadata replies rerender matching cards, so they wait until the 320 ms crossfade has ended.
 useEffect(()=>{const timer=setTimeout(()=>{for(const item of [slide,nextSlide])if(item)preparePreview(item);},400);return()=>clearTimeout(timer);},[slide?.id,nextSlide?.id,previewCache]);
 const categoryBundles=useMemo(()=>new Map([movies,shows].map(items=>{const groups=smartCollections.filter(group=>group.type===(items===shows?'series':'movie'));return [items,{groups,names:[...new Set([...groups.map(group=>group.name),...index.categories(items)])]}];})),[movies,shows,smartCollections,index]);
 const smartFor=items=>categoryBundles.get(items)?.groups||[];
 const categoryNames=items=>categoryBundles.get(items)?.names||index.categories(items);
 const categoryControls=(title,items)=>(items===movies||items===shows)?<CategoryChips categories={categoryNames(items)} collections={smartFor(items)} value={category} change={setCategory} title={title}/>:<CategoryPicker categories={categoryNames(items)} value={category} change={setCategory} title={title}/>;
 const categoryItems=items=>smartFor(items).find(group=>group.name===category)?.items;
 const filteredItems=items=>{const chosen=categoryItems(items);return chosen?index.filter(chosen,query):index.filter(items,query,category);};
 // Bloque B: the three categories with most titles, offered only by the empty filter.
 const largestCategories=items=>index.categories(items).filter(name=>name!==category).map(name=>[name,index.filter(items,'',name).length]).filter(([,size])=>size).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([name])=>name);
 const catalogueGrid=(title,items)=>{
  const visible=filteredItems(items);
  return <><PageTitle title={title}/><div className={`catalog-controls ${items===movies||items===shows?'has-category-chips':''}`}><p className="catalog-count">{count(visible.length)} títulos</p>{categoryControls(title,items)}</div>{cards(visible)}{!visible.length&&!catalogue.loading&&<EmptyState tv={tv} art={items===shows?'series':'cinema'} title={isKids?'No hay títulos para esta edad':'Sin títulos en esta categoría'} text={isKids?'No hay títulos con edad verificada de hasta 10 años.':'Prueba otra categoría o mira todo el catálogo.'} actions={category==='Todas'?[{label:'Volver al inicio',primary:true,onClick:()=>navigate('Inicio')}]:[{label:'Ver todas',primary:true,onClick:()=>setCategory('Todas')},...largestCategories(items).map(name=>({label:name,onClick:()=>setCategory(name)}))]}/>}</>;
 };
 const baseballEvents=useMemo(()=>liveEvents.filter(isBaseball),[liveEvents]),baseballChannels=useMemo(()=>liveChannels.filter(isBaseball),[liveChannels]);
 const baseball=useMemo(()=>[...baseballEvents,...baseballChannels],[baseballEvents,baseballChannels]);
 // Fase L3: live pages are rows by phase plus a channel grid; recomputed per catalogue, chip, favourites and phase/day change.
 const livePage=!isKids&&(page==='TV en vivo'||page==='MLB');
 const hub=useMemo(()=>livePage?liveHubRows({events:page==='MLB'?baseballEvents:liveEvents,channels:page==='MLB'?baseballChannels:liveChannels,category,favorites:favoritesForLive,now:Date.now()}):null,[livePage,page,liveEvents,liveChannels,baseballEvents,baseballChannels,category,favoritesForLive,livePhases]);
 const searchSource=collectionItems||(page==='Películas'?movies:page==='Series'?shows:page==='TV en vivo'?live:page==='Mi lista'?savedItems:page==='MLB'?baseball:all);
 const smartSearch=categoryItems(searchSource)||(livePage?liveChipItems(searchSource,category):null);
 const search=useCatalogueSearch(index,smartSearch||searchSource,query,smartSearch?'Todas':category),searchResults=search.items;
 // Bloque B: TMDB is only asked when the catalogue has no exact title and fewer than three approximate ones.
 const tmdbAbsent=useTmdbSuggestion(query,!isKids&&!search.loading&&!searchResults.length&&search.fuzzy.length<3);
 const rail=(title,items)=>items.length?<VirtualCarousel title={title} items={items} open={tv?open:inspect} history={history} favorites={favorites} toggle={toggle} {...previewProps} actionFocus={rowActionFocus}/>:null;
 const searchScoped=page!=='Inicio'||category!=='Todas'||Boolean(collectionItems),searched=query.trim();
 const searchEmpty=()=><EmptyState tv={tv} art={page==='Series'?'series':page==='TV en vivo'?'live':page==='MLB'?'baseball':'cinema'} title={`No encontramos "${searched}"`} text={search.suggestions.length?'¿Quisiste decir…?':'Revisa cómo se escribe o prueba con otro nombre.'}
  actions={[...search.suggestions.map(name=>({label:name,onClick:()=>{searchSubmitted.current=tv;setQuery(name);}})),...(searchScoped?[{label:'Buscar en todo el catálogo',onClick:()=>{searchSubmitted.current=tv;setCollectionView(null);setCategory('Todas');setPage('Inicio');}}]:[]),{label:'Limpiar búsqueda',onClick:()=>{setQuery('');searchRef.current?.focus();}}]}>
  {search.fuzzy.length>0&&<div className="empty-state-extra">{rail(`Parecidos a "${searched}"`,search.fuzzy)}</div>}
  {absentMatch&&<div className="empty-state-extra">{rail(`En tu catálogo: "${displayTitle(absentMatch)}"`,[absentMatch])}</div>}
  {tmdbAbsent&&!absentMatch&&<><div className="tmdb-absent">{tmdbAbsent.poster&&<img src={tmdbAbsent.poster} alt="" loading="lazy" decoding="async"/>}<div><h2>"{tmdbAbsent.title}" no está en tus fuentes</h2><p>{[tmdbAbsent.type==='series'?'Serie':'Película',tmdbAbsent.year,tmdbAbsent.genres.join(', ')].filter(Boolean).join(' · ')}</p></div></div>{absentAlternatives.length>0&&<div className="empty-state-extra">{rail('Del mismo género en tu catálogo',absentAlternatives)}</div>}</>}
 </EmptyState>;
 const absentMatch=useMemo(()=>tmdbAbsent?catalogueMatch(tmdbAbsent,tmdbAbsent.type==='series'?shows:movies):null,[tmdbAbsent,movies,shows]);
 const absentAlternatives=useMemo(()=>{if(!tmdbAbsent||absentMatch)return [];const source=tmdbAbsent.type==='series'?shows:movies;return genreAlternatives({tmdbResult:tmdbAbsent,collections:[...smartCollections.filter(group=>group.type===(source===shows?'series':'movie')),...index.categories(source).map(name=>({name,items:()=>index.filter(source,'',name)}))]});},[tmdbAbsent,absentMatch,movies,shows,smartCollections,index]);
 const submitSearch=useStableEvent(event=>{const key=event.key==='Unidentified'?{13:'Enter',40:'ArrowDown',10009:'Escape'}[event.keyCode]:event.key;if(!tv||event.nativeEvent.isComposing||!['Enter','Escape'].includes(key))return;event.preventDefault();event.stopPropagation();searchRef.current?.blur();if(key==='Escape'){searchSubmitted.current=false;document.querySelector('.topbar nav button.active')?.focus();return;}searchSubmitted.current=true;if(!search.loading){requestAnimationFrame(()=>{searchSubmitted.current=false;(mainRef.current?.querySelector('.empty-state:not([role=alert]) .empty-state-actions button,.card-open')||document.querySelector('.topbar nav button.active'))?.focus({preventScroll:true});});}});
 useEffect(()=>{if(!searchSubmitted.current||search.loading)return;const frame=requestAnimationFrame(()=>{searchSubmitted.current=false;revealRowFor(mainRef.current?.querySelector('.empty-state:not([role=alert]) .empty-state-actions button,.card-open')||document.querySelector('.topbar nav button.active'))?.focus({preventScroll:true});});return()=>cancelAnimationFrame(frame);},[search.loading,searchResults]);
 const sectionFirst=collectionItems?filteredItems(collectionItems)[0]:page==='Películas'?filteredItems(movies)[0]:page==='Series'?filteredItems(shows)[0]:hub?hub.rows[0]?.items[0]||hub.channels[0]:page==='Mi lista'?savedItems[0]:featured[0];
 const stageFirst=query?searchResults[0]:sectionFirst;
 const validStage=item=>item&&index.byId.get(item.id)&&(page!=='Mi lista'||favoriteIds.has(item.id));
 const rememberedStage=stageMemory.current?.scope===stageScope&&validStage(stageMemory.current.item)?index.byId.get(stageMemory.current.item.id):null;
 const selectedStage=previewScope.current===stageScope&&validStage(previewItem)?index.byId.get(previewItem.id):null;
 // TV banners never follow the selected card; PC's pointer stage still does.
 const stageBase=slide||(stageFirst?((!tv&&(selectedStage||rememberedStage))||index.byId.get(stageFirst.id)||stageFirst):null);
 stageMemory.current=stageBase?{scope:stageScope,item:stageBase}:null;
 // Fase L4: «ahora y después» for the focused 24 h channel, its two neighbours in the mounted window
 // (warmWindow) and a channel banner; asked after the settle commit, never during a burst, never in Kids.
 const guideEnabled=!isKids&&(tv||livePage)&&!banner.moving&&!details&&!playing&&!modal;
 const guideChannels=useMemo(()=>{if(!guideEnabled)return [];const channel=item=>item?.kind==='iptv'&&!item.isEvent&&item.streamId,context=previewContext.current,mounted=new Set([...railWindows.current.values()].flat().map(item=>item?.id));
  const near=channel(previewItem)&&context?nearbyPreviewItems({...context,key:lastDirection.current,count:2}).filter(item=>mounted.has(item?.id)):[];
  return [previewItem,...near,previewItem?stageBase:null].filter(channel);},[guideEnabled,previewItem?.id,stageBase?.id]);
 const guide=useChannelGuide(guideChannels,guideEnabled,{scope:catalogue.connection.revision||catalogue.connection.key||'',delay:tv?0:480});
 useEffect(()=>{setMetadataLayer('guide',guide);},[guide]);
 useEffect(()=>{if(stageBase)return;banner.reset();clearTimeout(previewTimer.current);clearTimeout(leaveTimer.current);previewCandidate.current=null;previewCard.current=null;previewContext.current=null;previewScope.current=null;setPreviewItem(null);setPreviewActive(false);setMetadataPriority(null);setSelectedCard(null);},[stageBase?.id]);
 useEffect(()=>{if(tv&&stageBase&&!details&&!playing&&!modal&&document.activeElement?.closest('.topbar')){banner.show();setPreviewActive(true);preparePreview(stageBase,false,true);}},[tv,stageBase?.id,page,details,playing,modal]);
 const headerPreview=useStableEvent(event=>{if(tv&&event.target.closest('.topbar,.focus-stage')){setSelectedCard(null);if(stageBase&&event.target.closest('.topbar')){setPreviewActive(true);banner.show();preparePreview(stageBase,false,true);}}});
 const stageVisible=stageBase&&(tv||previewItem)&&!details&&!playing&&!modal;
 // TV reserves the stage whenever one exists: trailer start/stop never relayouts the scene.
 const tvStage=Boolean(tv&&stageVisible);
 useTVBannerLayout(mainRef,tvStage,bannerAtTop);
 useLayoutEffect(()=>{if(tv)window.dispatchEvent(new Event('richiflix-preview-layout'));},[tv,tvStage]);
 const nearby=useMemo(()=>{
  if(query)return searchResults;
  const source=collectionItems||(page==='Series'?shows:page==='TV en vivo'?live:page==='MLB'?baseball:page==='Mi lista'?savedItems:movies);
  const chosen=smartCollections.find(group=>group.name===category&&group.type===(source===movies?'movie':source===shows?'series':null));
  return chosen?.items||index.filter(source,'',category);
 },[index,query,searchResults,page,shows,live,baseball,savedItems,movies,category,smartCollections,collectionItems]);
 useEffect(()=>{
  if(banner.moving||!previewActive)return;
  const context=previewContext.current;
  const neighbors=context?nearbyPreviewItems({...context,key:lastDirection.current}):nearby.slice(1,3);
  const warm=warmTimer.current=setTimeout(()=>neighbors.forEach(item=>preparePreview(item,false,true)),240);
  return()=>clearTimeout(warm);
 },[previewItem?.id,page,query,category,nearby.length,previewCache,banner.moving,previewActive,burstEpoch.current]);
 useEffect(()=>{if(!viewAllPending.current)return;viewAllPending.current=false;const frame=requestAnimationFrame(()=>revealRowFor(mainRef.current?.querySelector('.catalog-grid .card-open,.live-hub .card-open')||document.querySelector('.topbar nav button.active'))?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame);},[page,category,collectionView]);
 return <FollowContext.Provider value={follow}><div onFocusCapture={event=>{setCardFocus(Boolean(event.target.closest('.card,.card-expansion')));headerPreview(event);}} onKeyDownCapture={event=>{if(event.key.startsWith('Arrow')&&event.target.closest('.card'))lastDirection.current=event.key;pointerPosition.current.itemId=null;pointerPosition.current.cardId=null;}} onMouseMoveCapture={event=>{const previous=pointerPosition.current,moved=event.clientX!==previous.x||event.clientY!==previous.y;event.nativeEvent.richiflixPointerMoved=moved;if(moved){const card=event.target.closest('.card');pointerPosition.current={x:event.clientX,y:event.clientY,itemId:card?.dataset.contentId,cardId:card?.dataset.cardId,at:performance.now()};}}} className={`app ${tv?'tv-mode':''} ${tvStage?'has-tv-stage':''} ${isKids?'kids-space':''} ${page==='Inicio'&&!query&&!collectionView&&featured.length?'scenic':''}`}>
  <header className={`topbar ${scrolled?'is-scrolled':''}`}>
   <a className="brand" href="#" onClick={event=>{event.preventDefault();navigate('Inicio');}}><Brand/></a>
   <nav aria-label="Principal">{(isKids?['Inicio','Películas','Series','Mi lista']:['Inicio','Películas','Series','TV en vivo','MLB','Mi lista']).map(name=><button className={page===name?'active':''} aria-current={page===name?'page':undefined} key={name} onClick={()=>navigate(name)}>{name}</button>)}</nav>
   <div className="header-tools"><div className={`search ${query?'has-query':''}`}><Search size={21}/><input ref={searchRef} aria-label="Buscar títulos y canales" placeholder={page==='Películas'?'Buscar películas':page==='Series'?'Buscar series':'Buscar'} value={query} onChange={event=>setQuery(event.target.value)} data-tv-search={tv?'true':undefined} onKeyDown={event=>{if(tv){submitSearch(event);return;}if(event.key==='Escape'){setQuery('');event.currentTarget.blur();}}}/>{query&&<button aria-label="Limpiar búsqueda" onClick={()=>{setQuery('');searchRef.current?.focus();}}><X size={16}/></button>}</div>
    {!isTVBuild&&<button className={`icon-button ${tv?'selected':''}`} aria-label="Modo TV" aria-pressed={tv} onClick={()=>setTv(!tv)}><Monitor size={21}/></button>}
    <button className={`small-avatar ${isKids?'kids':'adult'}`} aria-label="Cambiar perfil" title={displayText(profile.name)} onClick={changeProfile}><QualityImage src={avatar(profile.kind)} eager fallback={false}/></button>
    <button className="icon-button" aria-label="Ajustes" onClick={()=>setModal('ajustes')}><Settings size={20}/></button>
   </div>
  </header>
  {stageVisible&&autoTrailers&&<CardTrailerPreview delay={tv?TV_TRAILER_DELAY_MS:0}/>}
  {stageVisible&&<StageWithMetadata item={stageBase} visible={bannerAtTop} loadingAllowed={previewActive&&!banner.moving} active={autoTrailers&&!banner.moving&&(tv?bannerAtTop&&!cardFocus:previewActive)} trailerDelay={tv?TV_TRAILER_DELAY_MS:0} moving={banner.moving} next={nextSlide} slide={carousel.index} slides={bannerSlides.length} choose={bannerSlides.length?carousel.go:undefined} onNextArt={nextArtChanged} profileId={profile.id} open={open} inspect={inspect} favorite={favorites.includes(stageBase.id)} toggle={toggle} tv={tv} hover={keepPreview} leave={leavePreview}/>}
  <main ref={mainRef} key={`${page}-${Boolean(query)}-${collectionView?.title||''}`} className="page-scene" data-banner-hidden={tvStage&&!bannerAtTop?'true':undefined}>
   {!tv&&page==='Inicio'&&!query&&!collectionView&&featured.length>0&&<Hero items={featured} prepare={preparePreview} open={open} inspect={inspect}/>}
   <div className={`content ${page==='Inicio'&&!query&&!collectionView&&featured.length?'home-content':''}`}>
    {!isKids&&catalogue.loading&&<p className="catalog-status" role="status">Cargando tus fuentes…</p>}
    {!isKids&&catalogue.error&&<EmptyState tv={tv} alert art="live" title="No pudimos cargar tus fuentes" text={displayText(catalogue.error)} actions={[{label:'Reintentar',primary:true,onClick:()=>catalogue.refresh(true)},{label:'Ajustes',onClick:()=>setModal('ajustes')}]}/>}
    {!isKids&&!catalogue.loading&&!catalogue.connection.configured&&<Empty icon={Settings} title="Conecta eterboxtv" text="Tu login Xtream Codes reúne canales, películas y series." action={()=>setModal('ajustes')} label="Conectar"/>}
    {query?<><PageTitle title={page==='Películas'?'Buscar películas':page==='Series'?'Buscar series':'Resultados'}/><div className={`catalog-controls ${searchSource===movies||searchSource===shows?'has-category-chips':''}`}><p className="catalog-count" role={search.loading?'status':undefined}>{search.loading?'Buscando…':`${count(searchResults.length)} resultados`}</p>{categoryControls(page,searchSource)}</div>{searchResults.length||search.loading?cards(searchResults):searchEmpty()}</>:collectionItems?catalogueGrid(collectionView.title,collectionItems):<>
     {page==='Inicio'&&<>{row('Continuar viendo',continuing)}{row(isKids?'Una gran aventura':'Películas',movies)}{row('Series',shows)}{row('Top 10 en Kingdom',top,{variant:'ranked'})}{row('Nuevo esta semana',fresh)}{!isKids&&row('Ahora en vivo',homeLive)}{(tv?homeRowsForTV(smartCollections):smartCollections.filter(group=>group.name===TMDB_BEST||group.name===TMDB_RECENT).sort((a,b)=>Number(a.name===TMDB_RECENT)-Number(b.name===TMDB_RECENT))).map(group=><React.Fragment key={`${group.type}:${group.name}`}>{row(group.name===TMDB_RECENT?(group.type==='movie'?'Películas recientes mejor valoradas · TMDB':'Series recientes mejor valoradas · TMDB'):(group.type==='movie'?'Películas mejor valoradas · TMDB':'Series mejor valoradas · TMDB'),group.items)}</React.Fragment>)}{discovery.groups.length>0&&<section className="home-discovery" aria-label="Descubre algo diferente"><div className="discovery-heading"><div><h2>Tu próximo mood</h2><p>Historias para descubrir, a tu ritmo.</p></div>{smartCollections.filter(group=>group.kind==='discovery').length>1&&<button className="discovery-refresh" onClick={discovery.change}><Shuffle aria-hidden="true"/>Otra selección</button>}</div>{discovery.groups.map(group=><React.Fragment key={group.key}>{row(group.name,group.items)}</React.Fragment>)}</section>}{isKids&&all.length===0&&<div className="empty-inline kids-empty"><h1>No hay títulos verificados para Kids</h1><p>Solo aparecen contenidos con edad confirmada de hasta 10 años.</p></div>}</>}
     {page==='Películas'&&catalogueGrid('Películas',movies)}
     {page==='Series'&&catalogueGrid('Series',shows)}
     {hub&&<LiveHub chips={page==='MLB'?['Eventos hoy']:undefined} title={page==='MLB'?'MLB · Béisbol en vivo':'TV en vivo'} subtitle={page==='MLB'?`Hoy · ${hub.today} ${hub.today===1?'partido':'partidos'}`:`Horarios de Santiago · Hoy · ${hub.today} ${hub.today===1?'evento':'eventos'}`} hub={hub} categories={categoryNames(page==='MLB'?baseball:live)} category={category} setCategory={setCategory} open={tv?open:inspect} history={history} favorites={favorites} toggle={toggle} {...previewProps} loading={catalogue.loading}/>}
     {page==='Mi lista'&&<><PageTitle title="Mi lista"/>{savedItems.length?cards(savedItems):<EmptyState tv={tv} art="cinema" title="Tu lista está vacía" text="Guarda películas y series con el corazón para encontrarlas aquí." actions={[{label:'Explorar películas',primary:true,onClick:()=>navigate('Películas')}]}><div className="empty-state-extra">{rail('Mejor valoradas',smartCollections.find(group=>group.name===TMDB_BEST&&group.type==='movie')?.items||[])}</div></EmptyState>}</>}
    </>}
   </div>
  </main>
  {details&&allowed(details)&&(details.mediaType==='series'?<SeriesDetail item={details} close={closeExperience} play={playEpisode} favorite={favorites.includes(details.id)} toggle={toggle} history={history} progress={seriesProgress} selection={episodeOrigin.current?.item.id===details.id?episodeOrigin.current:undefined} tv={tv}/>:<Dialog immersive close={closeExperience} label={displayText(details.title)} restoreFocus={experienceOrigin.current}><QualityImage className="detail-image" src={details.kind==='iptv'?(details.imageGeneric?undefined:details.image):artworkURL(details.backdropImage,true)} fit={details.kind==='iptv'?'contain':'cover'} eager position="65% center"/>{details.kind!=='iptv'&&!details.backdropImage&&<QualityImage className="detail-poster" src={artworkURL(details.image)} eager fit="contain" fallback={false}/>}<div className="detail-atmosphere"/><div className="dialog-body detail-copy"><span className="pill">{displayText(details.genre)}{ratingFor(details)&&` · ${ratingFor(details).label}`}</span><h2>{displayTitle(details)}</h2><p>{displayText(details.description)}</p><TitleFacts item={details}/><small>{displayText(details.credit)}{details.kind==='iptv'?' · En vivo':''}</small><div className="dialog-actions">{details.mediaType!=='series'&&<button className="primary" onClick={()=>open(details)}><Play fill="currentColor" size={22}/> Reproducir</button>}<button className={`secondary favorite-action ${favorites.includes(details.id)?'saved':''}`} aria-pressed={favorites.includes(details.id)} onClick={()=>toggle(details)}>{favorites.includes(details.id)?<Check size={20}/>:<Plus size={20}/>} Mi lista</button></div></div></Dialog>)}
  {playing&&allowed(playing)&&<Player tvMode={tv} item={playing} start={watched[playing.id]===true?0:history[playing.id]||0} save={(seconds,id=playing.id,extra)=>savePlayback(seconds,id,extra)} close={closeExperience} change={changeSource} seasons={playing.mediaType==='episode'?episodeOrigin.current?.seasons:undefined} series={playing.mediaType==='episode'?episodeOrigin.current?.item:undefined} intros={intros} setIntros={setIntros} fullscreen={fullscreen} toggleFullscreen={toggleFullscreen} restoreFocus={experienceOrigin.current}/>}
  {modal&&<Dialog immersive utility label="Ajustes" close={()=>setModal(null)}><div className="dialog-body settings-body"><span className="pill">TU KINGDOM</span><h2>Ajustes</h2><p>{displayText(profile.name)} · {isKids?'Kids · hasta 10 años':'Adulto'}</p>{!isKids&&<><XtreamSettings catalogue={catalogue}/><MetadataSettings changed={()=>setMetadataRevision(previous=>previous+1)}/></>}{!isKids&&teams.length>0&&<section className="followed-teams" aria-label="Equipos seguidos"><h3>Equipos seguidos</h3>{teams.map(id=><button key={id} className="secondary" aria-label={`Dejar de seguir a ${teamLabel(id)}`} onClick={event=>{const list=event.currentTarget.parentElement;toggleTeam(id);requestAnimationFrame(()=>(list.isConnected&&list.querySelector('button')||document.querySelector('.profile-settings-actions button'))?.focus({preventScroll:true}));}}>{teamAbbreviation(id)} · {teamLabel(id)} · Dejar de seguir</button>)}</section>}<div className="profile-settings-actions">{!isTVBuild&&<button className="secondary" onClick={toggleFullscreen}>{fullscreen?<Minimize/>:<Maximize/>}{fullscreen?'Salir de pantalla completa':'Pantalla completa'}</button>}<button className="secondary" onClick={changeProfile}>Cambiar perfil</button><button className="secondary" aria-pressed={autoTrailers} onClick={()=>setAutoTrailers(!autoTrailers)}>Tráilers automáticos: {autoTrailers?'activados':'desactivados'}</button>{!isTVBuild&&<button className="secondary" onClick={()=>setTv(!tv)}><Monitor/>Modo TV: {tv?'activado':'desactivado'}</button>}<button className="secondary" onClick={()=>{setHistory({});setFavorites([]);setNotice('Historial y lista de este perfil eliminados.');}}>Borrar historial y Mi lista</button></div>{isKids&&<p className="small-print">El contenido sin clasificación confirmada se oculta.</p>}</div></Dialog>}
  {showTop&&!details&&!playing&&!modal&&<button className="back-top circle" aria-label="Volver arriba" onClick={()=>window.scrollTo({top:0,behavior:motionAllowed()?'smooth':'instant'})}><ArrowUp size={21}/></button>}
  {!isKids&&followedEvents.length>0&&<FollowAlerts events={followedEvents} paused={Boolean(details||playing||modal)} check={showAlert}/>}
  {notice&&<div key={notice} className="toast" role="status" onKeyDown={followAlert?.text===notice?event=>{if(['Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();event.stopPropagation();leaveAlert();}}:undefined} onFocus={followAlert?.text===notice?event=>{if(!alertOrigin.current&&event.relatedTarget)alertOrigin.current=event.relatedTarget;}:undefined}><Check size={18}/>{displayText(notice)}{followAlert?.text===notice&&<button className="toast-action" ref={button=>{if(button&&tv&&followAlert.steal&&!alertOrigin.current&&document.activeElement!==button){alertOrigin.current=document.activeElement;button.focus({preventScroll:true});}}} onClick={()=>{const event=followAlert.event;leaveAlert();open(event);}}>Ver</button>}<button aria-label="Cerrar aviso" onClick={()=>setNotice('')}><X size={16}/></button></div>}
 </div></FollowContext.Provider>;
}
// R6.1: the banner merges its current and next slide with their store entries; a metadata reply rerenders this, not App.
const isMedia=item=>Boolean(item&&['movie','series'].includes(item.mediaType));
const StageWithMetadata=memo(function StageWithMetadata({item,next,loadingAllowed,...props}){
 const current=useMetadataEntry(item.id),upcoming=useMetadataEntry(next?.id);
 const merged=useMemo(()=>current.metadata?{...item,...current.metadata}:item,[item,current.metadata]);
 const mergedNext=useMemo(()=>next&&upcoming.metadata?{...next,...upcoming.metadata}:next,[next,upcoming.metadata]);
 return <FocusStage {...props} item={merged} metadataPending={isMedia(item)&&(!current.resolved||current.priority)} loading={loadingAllowed&&current.priority} next={mergedNext} nextPending={isMedia(next)&&!upcoming.resolved}/>;
});
// Fase L7: rerenders on EventBadge's shared minute clock (through the first followed game), so App never does.
const FollowAlerts=memo(function FollowAlerts({events,paused,check}){useEventPhase(events[0]);useEffect(()=>{if(!paused)check();});return null;});
