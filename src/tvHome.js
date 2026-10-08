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
// H2-T2: «Nuevo esta semana» and the NUEVO badge. `now` comes from the caller (App's useMemo per catalogue), never per key.
const DAY=864e5;
export function isNew(item,now,days=7){return Number.isFinite(item?.addedAt)&&item.addedAt>now-days*DAY;}
export function recentlyAdded(items,now=Date.now(),days=7,limit=40){
 return items.filter(item=>isNew(item,now,days)).sort((a,b)=>b.addedAt-a.addedAt).slice(0,limit);
}
// H2-T3: «Top 10 en Kingdom»: TMDB_BEST films and series interleaved by tmdbRank (from the selection metadata, else
// the item, else its place in the list), film first on a tie; copies carry `rank` 1..10. No collection → [].
export function topTen(collections,metadata={}){
 const ranked=type=>(collections.find(group=>group.name===TMDB_BEST&&group.type===type)?.items||[]).map((item,position)=>({item,film:type==='movie',rank:Number(metadata[item.id]?.tmdbRank??item.tmdbRank)||position+1}));
 return [...ranked('movie'),...ranked('series')].sort((a,b)=>a.rank-b.rank||b.film-a.film).slice(0,10).map(({item},index)=>({...item,rank:index+1}));
}
// H2-T4: eyebrow over each Inicio row title (static paint). Discovery rows pass their own («PARA TI»); unknown → ''.
const EYEBROWS={'Películas':'TU CATÁLOGO','Series':'TU CATÁLOGO','Una gran aventura':'TU CATÁLOGO','Continuar viendo':'SIGUE DONDE LO DEJASTE','Top 10 en Kingdom':'TOP 10','Nuevo esta semana':'NOVEDADES'};
export function rowEyebrow(title){
 const text=String(title||'');
 return EYEBROWS[text]||(text.startsWith('Ahora en vivo')?'EN DIRECTO':/· TMDB$/.test(text)?'SELECCIÓN TMDB':'');
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
