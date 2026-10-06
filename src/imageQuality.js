// Decode before revealing pixels. Never enlarge a raster beyond its native size.
export function imagePresentation({width,height,naturalWidth,naturalHeight,dpr=1,fit='cover',vector=false}){
 if(!width||!height||!naturalWidth||!naturalHeight)return {ready:false};
 const density=Math.max(1,dpr);
 if(fit==='contain'){
  const scale=Math.min(width/naturalWidth,height/naturalHeight,vector?Infinity:1/density);
  return {ready:true,width:naturalWidth*scale,height:naturalHeight*scale};
 }
 const scale=Math.max(width/naturalWidth,height/naturalHeight)*density;
 return {ready:vector||scale<=1.01};
}

export function isVectorSource(src){
 try{return new URL(src,'https://richiflix.local/').pathname.toLowerCase().endsWith('.svg');}catch{return false;}
}
