export function artworkCategory(item){
 const words=`${item.contentGenre||''} ${item.genre||''} ${item.category||''} ${item.title||''}`.toLocaleLowerCase('es');
 if(/\bmlb\b|b[eé]isbol|baseball/.test(words))return {key:'baseball',label:'Béisbol'};
 if(/terror|horror|suspenso|thriller/.test(words))return {key:'horror',label:'Suspenso'};
 if(/infantil|kids|animaci[oó]n|animation|cartoon|boomerang|disney|nickelodeon/.test(words))return {key:'animation',label:'Animación'};
 if(/documental|documentary|discovery|national geographic|naturaleza/.test(words))return {key:'documentary',label:'Documentales'};
 if(/acci[oó]n|action|aventura|adventure|sci.fi|ciencia ficci[oó]n/.test(words))return {key:'action',label:'Acción y aventura'};
 if(item.mediaType==='series'||/\bseries\b/.test(words))return {key:'series',label:'Series'};
 if(item.kind==='iptv'&&!/\bcine\b|cinema|movie|pel[ií]cula/.test(words))return {key:'live',label:'En vivo'};
 return {key:'cinema',label:'Cine'};
}
