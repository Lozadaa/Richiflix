import {displayText} from './displayText.js';
// H2-T4: the card's static facts line, «2026 · Drama · 1 h 49 min», with whatever exists; '' when nothing does
// (never a loose «·»). Genre: the first TMDB genre, else the first of the provider's list.
export function cardFacts(item){
 const year=/^\d{4}$/.test(String(item?.year??''))?String(item.year):'';
 const genre=displayText(item?.tmdbGenres?.[0]||String(item?.contentGenre||'').split(/[,/|]/)[0]).trim();
 const seconds=Number(item?.durationSeconds),minutes=Number.isFinite(seconds)&&seconds>0?Math.round(seconds/60):0;
 const length=minutes?minutes<60?`${minutes} min`:`${Math.floor(minutes/60)} h${minutes%60?` ${minutes%60} min`:''}`:'';
 return [year,genre,length].filter(Boolean).join(' · ');
}
