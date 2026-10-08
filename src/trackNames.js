// E1: audio/subtitle tracks named in Spanish from their ISO code («spa», «es-419», «eng»), never a raw code.
// Intl.DisplayNames does the work; the short table covers firmware without it.
const ALIAS={spa:'es',eng:'en',por:'pt',fra:'fr',fre:'fr',deu:'de',ger:'de',ita:'it',jpn:'ja'};
const LANGUAGES={es:'español',en:'inglés',pt:'portugués',fr:'francés',de:'alemán',it:'italiano',ja:'japonés'},REGIONS={419:'Latinoamérica'};
const UNKNOWN=new Set(['und','mul','zxx','mis','root']);
const display=(type,code)=>{try{const name=new Intl.DisplayNames(['es'],{type,fallback:'none'}).of(code);return name&&name.toLowerCase()!==code.toLowerCase()?name:'';}catch{return '';}};
const capital=text=>text.charAt(0).toUpperCase()+text.slice(1);

export function trackName({language,label,index=0,kind='audio'}){
 const [base='',region='']=String(language||'').trim().replace(/_/g,'-').split('-'),code=ALIAS[base.toLowerCase()]||base.toLowerCase();
 const name=!UNKNOWN.has(code)&&/^[a-z]{2,3}$/.test(code)&&(display('language',code)||LANGUAGES[code]);
 if(name){const place=region&&(display('region',region.toUpperCase())||REGIONS[region]);return capital(place?`${name} (${place})`:name);}
 return String(label||'').trim()||`${kind==='subtitle'?'Subtítulos':'Pista'} ${index+1}`;
}

// Same name twice: the codec tells them apart; if it does not, «(2)», «(3)»…
export function trackNames(tracks,kind){
 const names=tracks.map((track,index)=>trackName({...track,index,kind}));
 const coded=names.map((name,index)=>names.filter(other=>other===name).length>1&&tracks[index].codec?`${name} (${String(tracks[index].codec).toUpperCase()})`:name);
 const seen={};return coded.map(name=>{seen[name]=(seen[name]||0)+1;return seen[name]>1?`${name} (${seen[name]})`:name;});
}
