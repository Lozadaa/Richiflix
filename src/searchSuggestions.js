import {useEffect,useState} from 'react';
import {normalizeQuery} from './fuzzySearch.js';
import {xtreamClient} from './xtreamClient.js';
// «Del mismo género en tu catálogo»: items of the existing genre collections whose name
// matches a genre of the TMDB result, taken in turns so every matching genre shows up.
// `items` may be a function so category groups are only filtered when their name matches.
const genreKey=name=>normalizeQuery(name).replace(/^lo mejor de /,'').replace(/ tmdb$/,'');
export function genreAlternatives({tmdbResult,collections=[],limit=12}={}){
 const wanted=new Set((tmdbResult?.genres||[]).flatMap(name=>[name,...String(name).split('&')]).map(genreKey).filter(Boolean));if(!wanted.size)return [];
 const lists=collections.filter(group=>[group.name,group.label].some(name=>name&&wanted.has(genreKey(name)))).map(group=>(typeof group.items==='function'?group.items():group.items)||[]),out=[],seen=new Set();
 for(let position=0;out.length<limit&&lists.some(list=>position<list.length);position++)for(const list of lists){const item=list[position];if(item&&!seen.has(item.id)&&out.length<limit){seen.add(item.id);out.push(item);}}
 return out;
}
// The best TMDB match for a search the catalogue cannot answer: 500 ms after the last
// keystroke, one request at a time, remembered per normalized query (50 at most).
const answers=new Map();let inFlight=null;
export function useTmdbSuggestion(query,enabled){
 const key=normalizeQuery(query),[state,setState]=useState({key:'',result:null});
 useEffect(()=>{
  if(!enabled||key.length<3)return;
  if(answers.has(key)){setState({key,result:answers.get(key)});return;}
  let active=true;const timer=setTimeout(async()=>{
   while(inFlight)await inFlight;if(!active)return;
   const mine=inFlight=Promise.resolve().then(()=>xtreamClient().tmdbSearch(query)).catch(()=>[]),found=await mine;if(inFlight===mine)inFlight=null;
   if(answers.size>=50)answers.delete(answers.keys().next().value);answers.set(key,found[0]||null);if(active)setState({key,result:found[0]||null});
  },500);
  return()=>{active=false;clearTimeout(timer);};
 },[key,enabled]);
 return enabled&&state.key===key?state.result:null;
}
