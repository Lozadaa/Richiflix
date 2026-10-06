// These poster variants were verified against TMDB /configuration on 2026-10-05.
// Backdrops keep their original size and vectors remain untouched.
const posterWidths=[342,500,780];
export function responsivePosterArtwork(src,width,dpr=1){
 let url;try{url=new URL(src);}catch{return null;}
 if(url.hostname!=='image.tmdb.org'||!/^\/t\/p\/w\d+\/[^/]+\.(?:jpg|png|webp)$/i.test(url.pathname))return null;
 const replace=size=>{const candidate=new URL(url);candidate.pathname=candidate.pathname.replace(/^\/t\/p\/[^/]+\//,`/t/p/${size}/`);return candidate.href;};
 if(!width)return {pending:true};
 // Reserve the focus scale before fetching, avoiding another download when the
 // same card expands. A selected src keeps intrinsic pixel dimensions honest
 // for the quality guard, including screens with a density greater than one.
 const size=Math.ceil(width*1.08),required=size*Math.max(1,dpr),variant=posterWidths.find(value=>value>=required);
 return variant?{src:replace('w'+variant)}:{src:replace('original')};
}
