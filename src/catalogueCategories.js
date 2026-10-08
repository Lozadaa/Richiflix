const translations={action:'Acción',adventure:'Aventura',animation:'Animación',comedy:'Comedia',crime:'Crimen',documentary:'Documental',drama:'Drama',family:'Familia',fantasy:'Fantasía',history:'Historia',horror:'Terror',music:'Música',mystery:'Misterio',romance:'Romance','science fiction':'Ciencia ficción',thriller:'Suspenso',war:'Guerra',western:'Western'};
// Provider groups remain available. Extra genres use supplied metadata only.
export function catalogueCategories(item){
 const names=[...(item.genres||[item.genre]),...(typeof item.contentGenre==='string'?item.contentGenre.split(/[,/|;]/):[])];
 return [...new Set(names.filter(name=>typeof name==='string').map(name=>name.trim()).filter(Boolean).map(name=>Object.hasOwn(translations,name.toLowerCase())?translations[name.toLowerCase()]:name))];
}
