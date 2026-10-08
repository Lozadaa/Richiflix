import {useEffect,useState} from 'react';
import {xtreamClient} from './xtreamClient.js';

// Spanish TMDB episode data per season: the selected season first, then the
// rest, two at a time. Answers after the series closes are ignored.
// ponytail: without item.tmdbId nothing is fetched; resolve by title+year once tmdbSearch (B2) exists.
export function useSeasonMetadata(item,seasons,selectedSeason){
 const [state,setState]=useState(()=>({bySeason:new Map(),pending:new Set()})),tmdbId=item?.tmdbId,key=seasons.join('|');
 useEffect(()=>{
  if(!tmdbId||!seasons.length)return;
  let active=true;const queue=[...seasons].sort((a,b)=>(String(b)===String(selectedSeason))-(String(a)===String(selectedSeason)));
  setState({bySeason:new Map(),pending:new Set(queue)});
  const worker=async()=>{while(active&&queue.length){const season=queue.shift(),episodes=await xtreamClient().season(tmdbId,season).catch(()=>[]);if(!active)return;setState(previous=>{const pending=new Set(previous.pending);pending.delete(season);return {bySeason:new Map(previous.bySeason).set(season,episodes),pending};});}};
  worker();worker();
  return()=>{active=false;};
 },[tmdbId,key]);
 return state;
}
