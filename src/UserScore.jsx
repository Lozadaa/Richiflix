import React from 'react';
import {Star,Trophy} from 'lucide-react';
import {titleFacts} from './artwork.js';
// Ola 4: toLocaleString with options builds an Intl formatter per call (≈ 90 ms in 20 keys on the TV): built once.
const scoreFormat=new Intl.NumberFormat('es-CL',{minimumFractionDigits:1,maximumFractionDigits:1}),countFormat=new Intl.NumberFormat('es-CL'),compactFormat=new Intl.NumberFormat('es-CL',{notation:'compact',maximumFractionDigits:1});
export function UserScore({item,compact=false}){
 const score=Number(item.tmdbScore),votes=Number(item.tmdbVotes);
 if(!Number.isFinite(score)||score<=0||score>10||!Number.isSafeInteger(votes)||votes<=0)return null;
 const label=scoreFormat.format(score);
 return <span className={`user-score ${compact?'score-compact':''}`} aria-label={`Puntuación de usuarios TMDB: ${label} de 10, ${countFormat.format(votes)} votos`}><Star fill="currentColor" aria-hidden="true"/><strong>{label}</strong>{!compact&&<><span className="score-source">TMDB</span><small>{compactFormat.format(votes)} votos</small></>}</span>;
}
export function TitleFacts({item}){
 const facts=titleFacts(item),rank=Number(item.tmdbRank);
 if(item.kind==='iptv'||(!facts&&!item.tmdbScore&&!rank))return null;
 return <div className="title-facts"><UserScore item={item}/>{facts&&<span>{facts}</span>}{Number.isInteger(rank)&&rank>0&&<span className="tmdb-rank"><Trophy aria-hidden="true"/>#{rank} TMDB</span>}</div>;
}
