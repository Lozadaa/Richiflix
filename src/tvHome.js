import {TMDB_BEST,TMDB_RECENT} from './tmdbSelections.js';
// Fixed per session (module load): the TV home never reshuffles while open.
const SESSION_DAY=Math.floor(Date.now()/864e5);
// TV home keeps at most six rows before «Tu próximo mood»: the fixed rows plus
// two TMDB rows, alternating by day between best rated and recent (movie, series).
// A missing selection is filled with the other kind, so there are two when possible.
export function homeRowsForTV(collections,day=SESSION_DAY){
 const [first,second]=day%2?[TMDB_RECENT,TMDB_BEST]:[TMDB_BEST,TMDB_RECENT],pick=(name,type)=>collections.find(group=>group.name===name&&group.type===type);
 return [pick(first,'movie'),pick(first,'series'),pick(second,'movie'),pick(second,'series')].filter(Boolean).slice(0,2);
}
// Back (Escape / Tizen 10009) in TV (nothing focused counts as header): content (cards and their expanded panel, banner,
// filters, empty-state actions) -> header; header -> clear search -> Inicio -> profiles.
// The panel's action buttons (long press) first return to their card (ExpandedCard).
// Live pages (Fase L3): their rows and channel grid return to the chips first, and the chips to the header.
export function backTarget({region,query,page,collectionView}){
 if(region==='live-rows')return 'chips';
 if(region!=='header')return 'header';
 if(query)return 'clear-search';
 if(page!=='Inicio'||collectionView)return 'home';
 return 'profiles';
}
