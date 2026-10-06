import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist-tizen');
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');if(url.pathname.includes('$WEBAPIS')){res.setHeader('Content-Type','text/javascript');res.end('/* PC TV simulation */');return;}const file=resolve(dist,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(dist+sep))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1920,height:1080}}),page=await context.newPage(),errors=[],forbiddenImages=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('forbidden-policy-image'))forbiddenImages.push(request.url());});
 await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
 await context.addInitScript(()=>{
  localStorage.setItem('rf-profiles',JSON.stringify([{id:'policy-adult',name:'Adulto',kind:'adult'}]));
  localStorage.setItem('rf-favorites-policy-adult',JSON.stringify(['flagged','hidden-live','tmdb-adult']));
  localStorage.setItem('rf-history-policy-adult',JSON.stringify({flagged:10,'hidden-live':10,'tmdb-adult':10}));
  const safe={id:'safe',sourceId:'fixture',streamId:'1',mediaType:'movie',kind:'vod',title:'Aventura permitida',genre:'Aventura',url:'xtream://fixture/movie/1.mp4',image:location.origin+'/artwork/categories/animation.png'};
  const forbidden=location.origin+'/forbidden-policy-image.png';
  const catalogue={movies:[safe,{...safe,id:'flagged',streamId:'2',title:'Blocked neutral title',adult:'1',image:forbidden},{...safe,id:'tmdb-adult',streamId:'3',title:'Neutral pending verification'}],shows:[{...safe,id:'hidden-series',streamId:'4',mediaType:'series',category:'XXX',title:'Hidden series',image:forbidden}],channels:[{...safe,id:'hidden-live',streamId:'5',kind:'iptv',mediaType:'live',category:'Adultos',title:'Hidden channel',image:forbidden}],connection:{configured:true,key:'fixture',sources:[]},sources:[],updatedAt:new Date().toISOString()};
  window.__policyPlayback=[];
  window.richiflix={xtreamStatus:async()=>catalogue.connection,xtreamCatalogue:async()=>catalogue,xtreamRecommendations:async()=>({collections:[],metadata:{}}),xtreamCachedRatings:async()=>({}),xtreamDetails:async id=>id==='3'?{isPornographic:true}:{description:'Una aventura para disfrutar.',backdropImage:safe.image},metadataStatus:async()=>({configured:false}),getFullscreen:async()=>true,setFullscreen:async()=>true,onFullscreenChange:()=>()=>{},xtreamPlayback:async item=>{window.__policyPlayback.push(item.id);return location.origin+'/safe-video.mp4';}};
  window.tizen={application:{getCurrentApplication:()=>({exit(){}})},tvinputdevice:{getSupportedKeys:()=>[],registerKey(){}}};
 });
 await page.goto(origin);await page.getByRole('button',{name:'Adulto',exact:true}).click();
 await expect(page.locator('.cards[aria-label="Películas"]')).toHaveAttribute('data-virtual-item-count','1');
 await expect(page.locator('[data-content-id="flagged"],[data-content-id="tmdb-adult"],[data-content-id="hidden-series"],[data-content-id="hidden-live"]')).toHaveCount(0);
 await expect(page.locator('.focus-stage')).not.toContainText('Neutral pending verification');
 await page.getByRole('button',{name:'Películas',exact:true}).click();await expect(page.locator('.catalog-grid')).toHaveAttribute('data-virtual-count','1');
 await page.getByRole('textbox',{name:'Buscar títulos y canales'}).fill('Blocked neutral title');await expect(page.locator('.catalog-grid .card')).toHaveCount(0);
 await page.getByRole('button',{name:'Mi lista',exact:true}).click();await expect(page.locator('.catalog-grid .card')).toHaveCount(0);
 await page.getByRole('button',{name:'TV en vivo',exact:true}).click();await expect(page.locator('.catalog-grid .card')).toHaveCount(0);
 assert.deepEqual(forbiddenImages,[]);assert.deepEqual(await page.evaluate(()=>window.__policyPlayback),[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,checks:['global adult profile filtering','TMDB exclusion clears cards and banner','blocked favorites and history','search excludes blocked titles','blocked images never requested','no blocked playback']}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
