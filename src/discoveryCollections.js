import {catalogueCategories} from './catalogueCategories.js';
import {cooperativeForEach} from './cooperativeWork.js';

const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function releaseYear(item,metadata={},currentYear=new Date().getUTCFullYear()){
 const candidate=String(metadata.year||item.year||item.title?.match(/\((\d{4})\)/)?.[1]||'').slice(0,4),value=Number(candidate);
 return /^\d{4}$/.test(candidate)&&value>=1888&&value<=currentYear?value:null;
}
const themes=[
 {key:'new',name:'Recién llegadas',series:'Series de ahora',label:'Novedades',test:entry=>entry.year>=entry.currentYear-1,sort:(a,b)=>b.year-a.year},
 {key:'action',name:'Adrenalina y grandes aventuras',series:'Series con pura adrenalina',label:'Adrenalina',test:entry=>/\baccion\b|\baction\b|aventura|adventure/.test(entry.genres)},
 {key:'mystery',name:'Una noche de misterio',series:'Un capítulo más de misterio',label:'Misterio',test:entry=>/misterio|mystery|suspens[oe]|thriller|crimen|crime/.test(entry.genres)},
 {key:'laugh',name:'Modo buen humor',series:'Series para desconectar',label:'Buen humor',test:entry=>/comedia|comedy/.test(entry.genres)},
 {key:'worlds',name:'Viajes a otros mundos',series:'Universos para perderse',label:'Otros mundos',test:entry=>/ciencia ficcion|science fiction|sci.fi|fantasia|fantasy/.test(entry.genres)},
 {key:'animated',name:'Mucho más que animación',series:'Historias animadas',label:'Animación',test:entry=>/animacion|animation/.test(entry.genres)},
 {key:'romance',name:'Historias que enamoran',series:'Amor en capítulos',label:'Romance',test:entry=>/romance|romantica|romantic/.test(entry.genres)},
 {key:'fright',name:'Luces fuera',series:'Series para ver con la luz encendida',label:'Terror',test:entry=>/terror|horror/.test(entry.genres)},
 {key:'real',name:'El mundo es una historia',series:'Historias reales por descubrir',label:'Documentales',test:entry=>/documental|documentary/.test(entry.genres)},
 {key:'drama',name:'Historias que se quedan contigo',series:'Personajes que dejan huella',label:'Drama',test:entry=>/\bdrama\b/.test(entry.genres)},
 {key:'classic',name:'Clásicos que siempre vuelven',series:'Series que hicieron historia',label:'Clásicos',test:entry=>entry.year!==null&&entry.year<2000,sort:(a,b)=>b.score-a.score},
 {key:'twenties',name:'Lo que nos dejó esta década',series:'La década de las grandes series',label:'Esta década',test:entry=>entry.year>=2020,sort:(a,b)=>b.year-a.year},
 {key:'ninety',name:'Volvemos a los 90',series:'Series con nostalgia de los 90',label:'Los 90',test:entry=>entry.year>=1990&&entry.year<=1999},
 {key:'short',name:'Una peli y a dormir',label:'Menos de 100 min',movieOnly:true,test:entry=>entry.duration>0&&entry.duration<=100*60},
];

// Runs in the catalogue worker / Electron backend. One cooperative pass builds
// the small collection pools; focusing cards never rescans the catalogue.
export async function buildDiscoveryCollections(catalogue,metadata={},now=Date.now(),options={batchSize:128,budget:2}){
 const currentYear=new Date(now).getUTCFullYear(),collections=[];
 for(const [key,type]of [['movies','movie'],['shows','series']]){
  const recipes=themes.filter(theme=>!theme.movieOnly||type==='movie'),pools=new Map(recipes.map(theme=>[theme.key,[]])),seen=new Set();
  await cooperativeForEach(catalogue[key]||[],item=>{
   if(item.mediaType!==type)return;const data=metadata[item.id]||{},year=releaseYear(item,data,currentYear),identity=data.tmdbId||item.tmdbId;
   // Only an exact metadata ID deduplicates quality variants. Ambiguous names
   // and different provider streams remain present in the complete catalogue.
   if(identity&&seen.has(String(identity)))return;if(identity)seen.add(String(identity));
   const entry={id:item.id,year,currentYear,score:Number(data.tmdbScore)||0,duration:Number(item.durationSeconds)||0,genres:clean([...catalogueCategories(item),...(data.tmdbGenres||[])].join(' '))};
   for(const theme of recipes)if(theme.test(entry))pools.get(theme.key).push(entry);
  },options);
  for(const theme of recipes){const pool=pools.get(theme.key);if(pool.length<3)continue;if(theme.sort)pool.sort(theme.sort);collections.push({key:`discovery:${type}:${theme.key}`,kind:'discovery',name:type==='series'?theme.series:theme.name,label:theme.label,type,ids:pool.slice(0,80).map(item=>item.id)});}
 }
 return collections;
}

const hash=value=>{let result=2166136261;for(const character of value)result=Math.imul(result^character.charCodeAt(0),16777619);return result>>>0;};
export function rotateDiscovery(collections,seed,revision=0,limit=4){
 const available=collections.filter(group=>group.kind==='discovery');
 const order=available.map(group=>({group,weight:hash(`${seed}:${group.key}`)})).sort((a,b)=>a.weight-b.weight||a.group.key.localeCompare(b.group.key));
 const offset=order.length?revision*(order.length>limit?limit:1)%order.length:0;
 return [...order.slice(offset),...order.slice(0,offset)].slice(0,limit).map(({group})=>group);
}
