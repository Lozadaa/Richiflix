import React,{useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {VirtualCatalogue} from '../src/VirtualCatalogue.jsx';
import {VirtualCarousel} from '../src/VirtualCarousel.jsx';
import {useRemoteNavigation} from '../src/useRemoteNavigation.js';
import {setSelectedCard} from '../src/cardSelectionStore.js';
import '../src/style.css';
import '../src/tvCardComposition.css';
import '../src/compositorMotion.css';

const catalogue=Array.from({length:27000},(_,index)=>({id:`fixture-${index}`,streamId:index,kind:'vod',mediaType:'movie',title:`Película de prueba ${index}`,genre:index%2?'Aventura':'Comedia',description:'Datos artificiales de prueba local.',year:2026}));
const history={},metadata={};
// Ola 3-F: an Inicio-like page (10 rails of 40) for layer and vertical-mount census.
const homeRails=['Tendencias','Aventura','Comedia','Drama','Terror','Familia','Documentales','Animación','Clásicos','Estrenos'];
const preview=(_item,cardId)=>setSelectedCard(cardId),pointerPreview=(item,_event,cardId)=>preview(item,cardId),noop=()=>{};
function Fixture(){
 useRemoteNavigation();
 const [items,setItems]=useState(catalogue),[page,setPage]=useState('Grid'),[tv,setTV]=useState(true),[favorites,setFavorites]=useState([]);
 const toggle=useCallback(item=>setFavorites(list=>list.includes(item.id)?list.filter(id=>id!==item.id):[...list,item.id]),[]);
 useEffect(()=>{window.__fixture={mode:setTV,filter(kind){const id=document.activeElement.closest('.card')?.dataset.contentId;setItems(kind==='without-focused'?catalogue.filter(item=>item.id!==id):kind==='odd'?catalogue.filter((_,index)=>index%2):kind==='empty'?[]:catalogue);},count:catalogue.length};return()=>delete window.__fixture;},[]);
 const nav=page=>{setSelectedCard(null);setPage(page);};
 const props={open:item=>{window.__opened=item.id;},toggle,preview,pointerPreview,leave:noop,tv,history,favorites,metadata};
 const railProps={...props,viewAll:()=>nav('Grid'),actionFocus:()=>setSelectedCard(null)};
 return <div className={`app ${tv?'tv-mode has-tv-stage':''}`}><header className="topbar"><nav>{['Grid','Rails','Home'].map(name=><button key={name} className={page===name?'active':''} onClick={()=>nav(name)}>{name}</button>)}</nav></header><div className="focus-stage"><div className="focus-actions"><button className="primary">Seleccionado</button></div></div><main key={page} className="page-scene"><div className="content">{page==='Grid'?<VirtualCatalogue items={items} {...props}/>:page==='Home'?homeRails.map((title,row)=><VirtualCarousel key={title} title={title} items={catalogue.slice(row*100,row*100+40)} {...railProps}/>):<><VirtualCarousel title="Aventura" items={catalogue} {...railProps}/><VirtualCarousel title="Comedia" items={catalogue.slice(0,1000)} {...railProps}/><VirtualCarousel title="Drama" items={catalogue.slice(0,1000)} {...railProps}/></>}</div></main></div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
