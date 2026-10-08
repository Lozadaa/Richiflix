// Frases del reino para los loaders (arranque y reproductor). Máx. 44 caracteres: caben en una línea a 24 px en el TV.
export const LOADER_PHRASES=[
 'Puliendo la corona…',
 'Despertando a los heraldos…',
 'Encendiendo las antorchas de la sala…',
 'Desenrollando los pergaminos del catálogo…',
 'Afinando los laúdes…',
 'Convocando a los bufones…',
 'Abriendo las puertas del castillo…',
 'Colocando los tronos en primera fila…',
 'Avisando al cronista de palacio…',
 'Sacudiendo las alfombras rojas…',
 'Contando las joyas de la cámara…',
 'Izando los estandartes…',
 'Sirviendo el hidromiel de la función…',
 'Afilando las espadas de utilería…',
 'Buscando al dragón del proyector…',
];
// tick es un contador ≥ 0; un valor negativo o inválido vuelve a la primera frase.
export const loaderPhrase=tick=>LOADER_PHRASES[Math.max(0,Math.floor(Number(tick)||0))%LOADER_PHRASES.length];
