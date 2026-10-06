let pending;
// The desktop HLS decoder is needed only after opening an HLS stream.
// Samsung resolves this import to its tiny stub and plays through AVPlay.
export const loadHlsLibrary=()=>pending??=import('hls.js').then(module=>module.default).catch(error=>{pending=null;throw error;});
