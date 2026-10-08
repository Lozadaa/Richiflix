const {_electron:electron,expect}=require('@playwright/test');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{createServer}=require('node:http');
(async()=>{
 const root=path.resolve(__dirname,'..'),userData=await fs.mkdtemp(path.join(os.tmpdir(),'richiflix-default-source-'));let app;
 const {fixtureResponse}=await import('../scripts/xtream-fixture.mjs');
 const server=createServer((request,response)=>{const data=fixtureResponse('http://localhost'+request.url);if(data.info)data.info.plot='Secondary fixture description';response.setHeader('Content-Type','application/json');response.end(JSON.stringify(data));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const host=`http://127.0.0.1:${server.address().port}`;
 try{
  const env={...process.env,RICHIFLIX_USER_DATA:userData};delete env.RICHIFLIX_TEST_EMPTY_SOURCE;
  app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'main.cjs')],env});
  // Replace only network responses; the shipped account and first-run path are unchanged.
  const {defaultMetadataToken}=await import('../src/metadataDefaults.js');
  const actions=['','get_live_categories','get_vod_categories','get_series_categories','get_live_streams','get_vod_streams','get_series','get_vod_info','get_series_info'],fixtures=Object.fromEntries(actions.map(action=>[action,fixtureResponse('http://fixture/player_api.php?action='+action)]));
  fixtures.get_vod_info.info.tmdb_id=999901;
  await app.evaluate(({net,BrowserWindow},{fixtures,preset})=>{const original=net.fetch.bind(net);net.fetch=async(address,options)=>{const url=new URL(address);if(String(address).startsWith('http://ebxvip.xyz:8080/player_api.php'))return new Response(JSON.stringify(fixtures[url.searchParams.get('action')||'']));if(url.hostname==='api.themoviedb.org'){
   let data={title:'Fixture Movie',overview:'Sinopsis española de prueba',vote_average:8.7,vote_count:1500};
   if(url.pathname.includes('/genre/'))data={genres:[{id:18,name:'Drama'}]};
   else if(url.pathname.includes('/discover/')){const tv=url.pathname.endsWith('/tv');data={results:Number(url.searchParams.get('page'))===1?[{id:tv?999902:999901,[tv?'name':'title']:tv?'Fixture Show':'Fixture Movie',vote_average:8.7,vote_count:1500,genre_ids:[18],[tv?'first_air_date':'release_date']:new Date().toISOString().slice(0,10)}]:[]};}
   else if(url.pathname.endsWith('/top_rated')){const tv=url.pathname.includes('/tv/');data={results:Number(url.searchParams.get('page'))===1?[{id:tv?999902:999901,[tv?'name':'title']:tv?'Fixture Show':'Fixture Movie',vote_average:8.7,vote_count:1500,genre_ids:[18]}]:[]};}
   return new Response(JSON.stringify(data),{status:url.searchParams.get('api_key')===preset?200:401});
  }return original(address,options);};BrowserWindow.getAllWindows().forEach(window=>window.webContents.setBackgroundThrottling(false));},{fixtures,preset:defaultMetadataToken});
  const page=await app.firstWindow(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'Crear perfil',exact:true}).click();await page.getByRole('button',{name:'Adulto',exact:true}).click();
  await page.locator('.hero .primary').waitFor();
  const initial=await page.evaluate(async()=>{const data=await window.richiflix.xtreamCatalogue();return {configured:data.connection.configured,sources:data.sources.length,movies:data.movies.length};});
  assert.deepEqual(initial,{configured:true,sources:1,movies:1});
  const translated=await page.evaluate(()=>window.richiflix.xtreamDetails('23','movie','eterboxtv'));assert.equal(translated.description,'Sinopsis española de prueba');assert.equal(translated.descriptionLanguage,'es');
  assert.equal(translated.tmdbScore,8.7);
  const selections=await page.evaluate(()=>window.richiflix.xtreamRecommendations());assert.equal(selections.status,'ready');assert.equal(selections.collections.length,4);assert.equal(selections.collections.filter(group=>group.name.includes('últimos 12 meses')).length,2);assert.equal(Object.keys(selections.metadata).length,2);assert.ok(Object.values(selections.metadata).every(item=>item.tmdbScore===8.7&&item.tmdbVotes===1500));
  const storedRankings=await fs.readFile(path.join(userData,'tmdb-selections.json'),'utf8');assert.ok(!storedRankings.includes(defaultMetadataToken));assert.ok(!storedRankings.includes('password='));
  await page.getByRole('button',{name:'Ajustes',exact:true}).click();
  await page.getByText('Tu clave de TMDB · Español preferido',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>window.richiflix.metadataStatus()),{configured:true,isDefault:true});assert.equal(await page.getByLabel('Token TMDB').inputValue(),'');
  const encryptedMetadata=await fs.readFile(path.join(userData,'metadata-token.enc'));assert.ok(!encryptedMetadata.includes(Buffer.from(defaultMetadataToken)));
  await page.getByRole('button',{name:'Desconectar TMDB',exact:true}).click();await page.getByRole('button',{name:'Restaurar mi clave',exact:true}).waitFor();
  const primary=page.locator('[data-source-id="eterboxtv"]');await primary.getByText('Principal',{exact:true}).waitFor();
  assert.equal(await primary.getByRole('button',{name:'Quitar fuente',exact:true}).count(),0);assert.equal(await page.getByLabel('Contraseña Xtream').count(),0);
  assert.ok((await fs.stat(path.join(userData,'xtream-sources.enc'))).size>0);
  await page.getByRole('button',{name:'Agregar fuente',exact:true}).click();await page.getByLabel('Nombre Xtream').fill('Mi segunda fuente');await page.getByLabel('Servidor Xtream').fill(host);await page.getByLabel('Usuario Xtream').fill('second-user');await page.getByLabel('Contraseña Xtream').fill('second-password');
  await page.getByRole('button',{name:'Conectar',exact:true}).click();await page.getByLabel('Contraseña Xtream').waitFor({state:'detached'});await expect(page.locator('.xtream-source')).toHaveCount(2);
  await expect(page.getByText('1 canales · 1 películas · 1 series',{exact:true})).toHaveCount(2);
  const routing=await page.evaluate(async()=>{const data=await window.richiflix.xtreamCatalogue(),item=data.movies.find(item=>item.sourceId!=='eterboxtv');const details=await window.richiflix.xtreamDetails(item.streamId,'movie',item.sourceId),url=await window.richiflix.xtreamPlayback(item);const seasons=await window.richiflix.xtreamEpisodes(data.shows.find(show=>show.sourceId===item.sourceId).streamId,item.sourceId),episode=seasons[0].episodes[0];return {sources:data.sources.length,movies:data.movies.length,distinct:new Set(data.movies.map(item=>item.id)).size,description:details.description,url,episodeURL:await window.richiflix.xtreamPlayback(episode)};});
  assert.equal(routing.sources,2);assert.equal(routing.movies,2);assert.equal(routing.distinct,2);assert.equal(routing.description,'Secondary fixture description');assert.equal(routing.url,host+'/movie/second-user/second-password/23.mp4');assert.equal(routing.episodeURL,host+'/series/second-user/second-password/88.mp4');
  const encrypted=await fs.readFile(path.join(userData,'xtream-sources.enc'));assert.ok(!encrypted.includes(Buffer.from('second-password')));const cache=await fs.readFile(path.join(userData,'xtream-catalogue.json'),'utf8');assert.ok(!cache.includes('password='));
  await page.reload();await page.getByRole('button',{name:'Adulto',exact:true}).click();await page.locator('.hero .primary').waitFor();await page.getByRole('button',{name:'Ajustes',exact:true}).click();await expect(page.locator('.xtream-source')).toHaveCount(2);
  assert.deepEqual(await page.evaluate(()=>window.richiflix.metadataStatus()),{configured:false,isDefault:false});await page.getByRole('button',{name:'Restaurar mi clave',exact:true}).click();await page.getByText('Tu clave de TMDB · Español preferido',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Quitar fuente',exact:true}).click();await expect(page.locator('.xtream-source')).toHaveCount(1);await primary.getByText('Principal',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Restaurar eterboxtv',exact:true}).click();await page.getByText('1 canales · 1 películas · 1 series',{exact:true}).waitFor();assert.deepEqual(errors,[]);
  console.log('Default settings OK: clean Windows install loads IPTV and the supplied TMDB key without setup; Spanish metadata, encrypted storage, persistent disconnection and restore; principal/additional sources, separate playback/episodes, reload and removal. Network responses simulated.');
 }finally{await app?.close();await new Promise(resolve=>server.close(resolve));const target=path.resolve(userData);assert.ok(target.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(target).startsWith('richiflix-default-source-'));await fs.rm(target,{recursive:true,force:true});}
})().catch(error=>{console.error(error.name+' '+error.message.replace(/https?:\/\/\S+/g,'[address]'));process.exitCode=1;});
