// Approximate title search for the catalogue worker: pure, no dependencies.
// Typos are scored against the catalogue's distinct words and trigrams through an
// inverted index, so a query costs one pass over the vocabulary plus one over the records.
const ignored=/^(?:s\d+e\d+|\d+x\d+|[set]\d+|ep|hd|fhd|uhd|sd|4k|hevc|h26[45]|lat|latino|eng|spa|sub|subs|dual)$/;
const indexes=new WeakMap();
export const normalizeQuery=text=>String(text??'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const grams=text=>{const padded=`  ${text} `,out=new Set();for(let i=0;i<padded.length-2;i++)out.add(padded.slice(i,i+3));return out;};
// Optimal-string-alignment Damerau-Levenshtein from a to b or to any prefix of b (a typo
// while still typing), in reused rows; gives up as soon as a whole row exceeds max.
let rows=[new Int32Array(64),new Int32Array(64),new Int32Array(64)];
function distance(a,b,max){
 const width=Math.min(b.length,a.length+max);if(a.length-width>max)return max+1;
 if(rows[0].length<=width)rows=rows.map(()=>new Int32Array(width*2+1));let [prev2,prev,row]=rows;
 for(let j=0;j<=width;j++)prev[j]=j;
 for(let i=1;i<=a.length;i++){row[0]=i;let best=i;for(let j=1;j<=width;j++){let value=Math.min(prev[j]+1,row[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]&&prev2[j-2]+1<value)value=prev2[j-2]+1;row[j]=value;if(value<best)best=value;}if(best>max)return max+1;[prev2,prev,row]=[prev,row,prev2];}
 let best=max+1;for(let j=Math.max(0,a.length-max);j<=width;j++)if(prev[j]<best)best=prev[j];return best;
}
const allowed=word=>word.length<=2?0:word.length<=4?1:2;
const queryParts=query=>{const words=normalizeQuery(query).split(' ').filter(word=>word&&!ignored.test(word));return {text:words.join(' '),words};};
function buildIndex(records){
 const vocab=new Map(),words=[],postings=new Map(),rows=records.map((record,position)=>{
  const text=normalizeQuery(record.clean||record.title),ids=[];
  for(const word of text?text.split(' '):[]){let id=vocab.get(word);if(id===undefined){id=words.length;vocab.set(word,id);words.push(word);}ids.push(id);}
  const own=grams(text);for(const gram of own){let list=postings.get(gram);if(!list)postings.set(gram,list=[]);list.push(position);}
  return {text,ids,grams:own.size};
 });
 return {records,rows,words,postings};
}
const indexFor=records=>{let index=indexes.get(records);if(!index){index=buildIndex(records);indexes.set(records,index);}return index;};
// The worker builds this while the user is still typing, so the first approximate query only scores.
export const prepareFuzzyIndex=records=>{indexFor(records);};
// Distance from each query word to every catalogue word: 0 for a prefix, 255 when out of reach.
function wordDistances(word,words){
 const max=allowed(word),out=new Uint8Array(words.length).fill(255);
 for(let id=0;id<words.length;id++){const other=words[id];if(other.startsWith(word)){out[id]=0;continue;}if(!max)continue;const best=distance(word,other,max);if(best<=max)out[id]=best;}
 return out;
}
function scoreRow(q,row,distances,shared,qGrams){
 if(!q.text||!row.text)return 0;if(row.text===q.text)return 1;if(row.text.startsWith(q.text)||row.text.includes(' '+q.text))return 0.8;
 let total=0,prefix=true,fuzzy=true;
 for(const list of distances){let best=255;for(const id of row.ids)if(list[id]<best)best=list[id];if(best===255){fuzzy=false;break;}if(best)prefix=false;total+=best;}
 if(fuzzy)return prefix?0.7:Math.max(0.45,0.6-0.075*total);
 const dice=2*shared/(qGrams+row.grams);return dice>=0.3?Math.min(0.55,dice):0;
}
// One pass gives both the scored matches and the distinct names for «¿Quisiste decir…?».
export function fuzzySearch(query,records,{limit=40,min=0.45,suggestions=5,accept}={}){
 const q=queryParts(query);if(!q.text)return {matches:[],suggestions:[]};
 const index=indexFor(records),distances=q.words.map(word=>wordDistances(word,index.words)),own=grams(q.text),shared=new Uint16Array(records.length);
 for(const gram of own)for(const position of index.postings.get(gram)||[])shared[position]++;
 const found=[];
 for(let position=0;position<records.length;position++){const record=records[position];if(accept&&!accept(record))continue;const score=scoreRow(q,index.rows[position],distances,shared[position],own.size);if(score>=min)found.push({record,score});}
 found.sort((a,b)=>b.score-a.score);const names=new Set();
 for(const {record} of found){if(names.size>=suggestions)break;names.add(record.clean||record.title);}
 return {matches:found.slice(0,limit).map(({record,score})=>({id:record.id,score})),suggestions:[...names]};
}
export const scoreMatch=(query,title)=>fuzzySearch(query,[{id:0,title}],{min:0}).matches[0]?.score||0;
export const fuzzyMatches=(query,records,options)=>fuzzySearch(query,records,options).matches;
export const suggestNames=(query,records,{limit=5,...options}={})=>fuzzySearch(query,records,{...options,suggestions:limit}).suggestions;
