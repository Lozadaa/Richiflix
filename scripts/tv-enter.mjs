import {pathToFileURL} from 'node:url';
const {connectTV}=await import(pathToFileURL('C:/Users/richa/Documents/ChatGPT/Richiflix/scripts/tv-cdp.mjs').href);
const tv=await connectTV(9227);
try{
 const state=await tv.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  for(let i=0;i<40&&!document.querySelector('.profile-grid button,.app');i++)await sleep(500);
  const buttons=[...document.querySelectorAll('.profile-grid > button')];
  const adult=buttons.find(b=>b.querySelector('.profile-tile.adult'))||buttons[0];
  if(adult&&!document.querySelector('.app'))adult.click();
  for(let i=0;i<60&&!document.querySelector('.app .card-open');i++)await sleep(500);
  await sleep(1500);
  return {profile:adult?.getAttribute('aria-label')||null,app:Boolean(document.querySelector('.app')),cards:document.querySelectorAll('.card').length,images:document.querySelectorAll('.card img').length,dpr:window.devicePixelRatio,inner:[window.innerWidth,window.innerHeight],screen:[screen.width,screen.height],ua:navigator.userAgent.slice(0,160),dialog:Boolean(document.querySelector('[role="dialog"]')),video:Boolean(document.querySelector('video')),active:document.activeElement?.className?.slice(0,40)};
 });
 console.log(JSON.stringify(state));
}finally{tv.close();}
