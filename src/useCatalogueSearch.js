import {useEffect,useState} from 'react';
const empty=[];
// Exact matches first; with fewer than five, the worker adds approximate titles and «¿Quisiste decir…?» names.
async function searchWithFuzzy(index,items,query,options){
 const found=await index.search(items,query,options);if(found.length>=5)return {items:found,fuzzy:empty,suggestions:empty};
 const exact=new Set(found),near=await index.fuzzy(items,query,options);
 return {items:found,fuzzy:near.items.filter(item=>!exact.has(item)),suggestions:near.suggestions};
}
export function useCatalogueSearch(index,items,query,category='Todas'){
 const [result,setResult]=useState({query:'',source:items,category,items:empty,fuzzy:empty,suggestions:empty,loading:false});
 useEffect(()=>{
  if(!query){setResult({query:'',source:items,category,items:empty,fuzzy:empty,suggestions:empty,loading:false});return;}
  const controller=new AbortController();setResult({query,source:items,category,items:empty,fuzzy:empty,suggestions:empty,loading:true});
  const timer=setTimeout(()=>searchWithFuzzy(index,items,query,{signal:controller.signal,category}).then(found=>{if(!controller.signal.aborted)setResult({query,source:items,category,...found,loading:false});}).catch(error=>{if(error.name!=='AbortError'&&!controller.signal.aborted)setResult({query,source:items,category,items:empty,fuzzy:empty,suggestions:empty,loading:false});}),60);
  return()=>{clearTimeout(timer);controller.abort();};
 },[index,items,query,category]);
 return query?(result.query===query&&result.source===items&&result.category===category?result:{query,items:empty,fuzzy:empty,suggestions:empty,loading:true}):{query:'',source:items,category,items:empty,fuzzy:empty,suggestions:empty,loading:false};
}
