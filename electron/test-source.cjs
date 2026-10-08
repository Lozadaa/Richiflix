// Isolated Xtream panel used by image/player tests; never added to production.
const {createServer}=require('node:http');
const panels=new WeakMap();
exports.addTestSource=async(page,{name,url,image,live=false,description='',trailerId,tmdbId,category='Fixture',eventStartsAt})=>{
 let panel=panels.get(page);
 if(!panel){
  panel={movies:[],channels:[],targets:new Map(),details:new Map()};
  panel.server=createServer((request,response)=>{
   const address=new URL(request.url,'http://localhost');
   if(address.pathname==='/player_api.php'){
    const action=address.searchParams.get('action');let result={user_info:{auth:1,status:'Active',allowed_output_formats:['m3u8']}};
    if(action?.endsWith('_categories'))result=[{category_id:1,category_name:panel.category}];
    else if(action==='get_vod_streams')result=panel.movies;
    else if(action==='get_live_streams')result=panel.channels;
    else if(action==='get_series')result=[];
    else if(action==='get_vod_info')result={info:panel.details.get(Number(address.searchParams.get('vod_id')))||{}};
    response.setHeader('Content-Type','application/json');response.end(JSON.stringify(result));
   }else{const id=Number(address.pathname.split('/').pop().split('.')[0]),target=panel.targets.get(id);if(target){response.writeHead(302,{Location:target});response.end();}else{response.writeHead(404);response.end();}}
  });await new Promise(resolve=>panel.server.listen(0,'127.0.0.1',resolve));panel.server.unref();panel.host=`http://127.0.0.1:${panel.server.address().port}`;
  page.once('close',()=>panel.server.close());panels.set(page,panel);
 }
 panel.category=category;
 const id=panel.movies.length+panel.channels.length+1;panel.targets.set(id,url);(live?panel.channels:panel.movies).push({stream_id:id,name,category_id:1,stream_icon:image,container_extension:'mp4',event_start:eventStartsAt});
 panel.details.set(id,{plot:description,backdrop_path:image?[image]:[],youtube_trailer:trailerId,tmdb_id:tmdbId});
 await page.getByRole('button',{name:'Ajustes',exact:true}).click();
 if(await page.getByRole('button',{name:'Actualizar catálogo',exact:true}).count())await page.getByRole('button',{name:'Actualizar catálogo',exact:true}).click();
 else{
  await page.getByLabel('Servidor Xtream').fill(panel.host);await page.getByLabel('Usuario Xtream').fill('fixture');await page.getByLabel('Contraseña Xtream').fill('fixture-password');await page.getByRole('button',{name:'Conectar',exact:true}).click();
 }
 await page.getByText(`${panel.channels.length} canales · ${panel.movies.length} películas · 0 series`,{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cerrar',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
};
