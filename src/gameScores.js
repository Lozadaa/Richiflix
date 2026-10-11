import {useSyncExternalStore} from 'react';
// Scores by official game id for MatchupArtwork, which only receives the matchup; a crest rerenders only when its own game changes.
// Each schedule (MLB, football) publishes its own games; ids never collide (`776` vs `futbol:776`).
const sources=new Map(),listeners=new Set();let scores=new Map();
export function publishScores(source,games){
 const previous=sources.get(source)||new Map(),next=new Map();
 for(const game of games)if(game.score){const old=previous.get(game.id);next.set(game.id,JSON.stringify(old)===JSON.stringify(game.score)?old:game.score);}
 if(next.size===previous.size&&[...next].every(([id,score])=>previous.get(id)===score))return;
 sources.set(source,next);scores=new Map([...sources.values()].flatMap(map=>[...map]));
 for(const listener of listeners)listener();
}
const subscribe=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export const useGameScore=id=>useSyncExternalStore(subscribe,()=>id?scores.get(id)||null:null,()=>null);
