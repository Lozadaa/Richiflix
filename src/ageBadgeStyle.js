// Visual tones only. The certificate text and Kids eligibility remain unchanged.
export function ageBadgeTone(rating){
 if(!rating)return 'neutral';
 const label=String(rating.label||'').toUpperCase().replace(/\s/g,'');
 if(rating.country==='US'){
  if(['G','TV-G','TV-Y'].includes(label))return 'general';
  if(label==='TV-Y7')return 'family';
  if(['PG','TV-PG','PG-13','TV-14'].includes(label))return 'guidance';
  if(['R','NC-17','TV-MA'].includes(label))return 'mature';
 }
 if(['CL','ES'].includes(rating.country)){
  if(['TE','TP','APTA','A'].includes(label))return 'general';
  const match=label.match(/^(?:TE\+)?(\d{1,2})\+?$/);
  if(match){const age=Number(match[1]);return age===0?'general':age<=12?'family':age<18?'guidance':'mature';}
 }
 return 'neutral';
}
