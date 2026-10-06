import {useEffect,useState} from 'react';
const empty=[];
export function useCatalogueSearch(index,items,query,category='Todas'){
 const [result,setResult]=useState({query:'',source:items,category,items:empty,loading:false});
 useEffect(()=>{
  if(!query){setResult({query:'',source:items,category,items:empty,loading:false});return;}
  const controller=new AbortController();setResult({query,source:items,category,items:empty,loading:true});
  const timer=setTimeout(()=>index.search(items,query,{signal:controller.signal,category}).then(found=>{if(!controller.signal.aborted)setResult({query,source:items,category,items:found,loading:false});}).catch(error=>{if(error.name!=='AbortError'&&!controller.signal.aborted)setResult({query,source:items,category,items:empty,loading:false});}),60);
  return()=>{clearTimeout(timer);controller.abort();};
 },[index,items,query,category]);
 return query?(result.query===query&&result.source===items&&result.category===category?result:{query,items:empty,loading:true}):{query:'',source:items,category,items:empty,loading:false};
}
