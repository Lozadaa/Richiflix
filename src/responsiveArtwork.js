// These poster variants were verified against TMDB /configuration on 2026-10-05.
// Backdrops keep their own size (original on PC, w1280 on the TV) and vectors remain untouched.
const posterWidths=[342,500,780];
const tmdbPath=/^\/t\/p\/(w\d+|original)\/[^/]+\.(?:jpg|png|webp)$/i;
const parse=src=>{try{const url=new URL(src);return url.hostname==='image.tmdb.org'&&tmdbPath.test(url.pathname)?url:null;}catch{return null;}};
// R4.1: w1280 only exists as a backdrop size; it is the TV's screen-sized banner
// art, deliberately shown upscaled (the guard in QualityImage accepts it).
// Ola 4: every card render parsed its poster URL two or three times (new URL ≈ 200 ms per 20 keys on the TV in React's
// background work); answers are memoized per input. ponytail: cleared at 600 entries, an LRU if it ever thrashes.
const memo=(cache,key,make)=>{let value=cache.get(key);if(value===undefined&&!cache.has(key)){if(cache.size>600)cache.clear();value=make();cache.set(key,value);}return value;};
const backdrops=new Map(),responsive=new Map();
export const isScreenBackdrop=src=>memo(backdrops,src,()=>parse(src)?.pathname.startsWith('/t/p/w1280/')||false);
export function posterVariant(src,size){const url=parse(src);if(!url)return src;url.pathname=url.pathname.replace(/^\/t\/p\/[^/]+\//,`/t/p/${size}/`);return url.href;}
// R4.4: the TV panel opens on the URL its card shows (w342 at 1080p, DPR 1) when
// the panel art is that poster; a backdrop fallback or a provider image keeps its own.
export function tvPanelPoster(artwork,poster){const variant=artwork&&artwork===poster?posterVariant(artwork,'w342'):null;return variant&&variant!==artwork?variant:null;}
export function responsivePosterArtwork(src,width,dpr=1){return memo(responsive,`${src}|${width}|${dpr}`,()=>computeResponsive(src,width,dpr));}
function computeResponsive(src,width,dpr){
 const url=parse(src);
 if(!url||!/^\/t\/p\/w\d+\//.test(url.pathname)||isScreenBackdrop(src))return null;
 if(!width)return {pending:true};
 // Reserve the focus scale before fetching, avoiding another download when the
 // same card expands. A selected src keeps intrinsic pixel dimensions honest
 // for the quality guard, including screens with a density greater than one.
 const size=Math.ceil(width*1.08),required=size*Math.max(1,dpr),variant=posterWidths.find(value=>value>=required);
 return {src:posterVariant(src,variant?'w'+variant:'original')};
}
