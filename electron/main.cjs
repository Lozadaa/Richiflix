const {app,BrowserWindow,dialog,ipcMain,protocol,net,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');
const {providerDestinations}=require('./sources.cjs');
const icon=path.join(__dirname,'../public/brand/kingdom.ico');
if(process.platform==='win32')app.setAppUserModelId('local.richiflix');
if(process.env.RICHIFLIX_USER_DATA)app.setPath('userData',process.env.RICHIFLIX_USER_DATA);
protocol.registerSchemesAsPrivileged([{scheme:'richiflix',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true,corsEnabled:true}}]);
const files=new Map();
let window;
function trusted(event){if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame)throw new Error('Origen no permitido');}
app.whenReady().then(()=>{
 const xtream=require('./xtream-store.cjs').createXtreamStore(app.getPath('userData'),process.env.RICHIFLIX_TEST_EMPTY_SOURCE==='1'?{preset:null,metadataPreset:''}:{});
 // Node fetch exposes redirect locations; Electron net.fetch omits Response.url
 // and hides manual Location headers, breaking relative HLS segment resolution.
 const streams=require('./stream-gateway.cjs').createStreamGateway((url,options)=>fetch(url,options));
 protocol.handle('richiflix',request=>{if(streams.handles(request))return streams.handle(request);const file=files.get(new URL(request.url).hostname);return file?net.fetch(pathToFileURL(file).href,{headers:request.headers}):new Response('Archivo no disponible',{status:404});});
 window=new BrowserWindow({width:1480,height:940,minWidth:900,minHeight:650,backgroundColor:'#0d172b',title:'Kingdom Player',icon,fullscreen:true,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 if(process.platform==='win32')window.setAppDetails({appId:'local.richiflix',appIconPath:icon,relaunchDisplayName:'Kingdom Player',relaunchCommand:app.isPackaged?`"${process.execPath}"`:`"${process.execPath}" "${app.getAppPath()}"`});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 // Identify the local app to YouTube's embed API; no IPTV request is altered.
 window.webContents.session.webRequest.onBeforeSendHeaders({urls:['https://www.youtube.com/embed/*','https://www.youtube-nocookie.com/embed/*']},(details,callback)=>{
  const headers={...details.requestHeaders};if(!headers.Referer&&!headers.referer)headers.Referer='https://local.richiflix/';callback({requestHeaders:headers});
 });
 window.webContents.on('will-navigate',e=>e.preventDefault());
 window.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key.toUpperCase()==='F11'){event.preventDefault();window.setFullScreen(!window.isFullScreen());}});
 // Windows emits the native event before committing isFullScreen(). Read it
 // on the next main-process turn so the renderer receives the new state.
 const reportFullscreen=()=>setImmediate(()=>{if(!window.isDestroyed())window.webContents.send('fullscreen-change',window.isFullScreen());});
 // The page says Kingdom; the window and taskbar keep the full product name.
 window.on('page-title-updated',event=>event.preventDefault());
 window.on('enter-full-screen',reportFullscreen);
 window.on('leave-full-screen',reportFullscreen);
 window.loadFile(path.join(__dirname,'../dist/index.html'));
 ipcMain.handle('xtream-status',event=>{trusted(event);return xtream.status();});
 ipcMain.handle('xtream-recommendations',event=>{trusted(event);return xtream.recommendations();});
 ipcMain.handle('xtream-cached-ratings',event=>{trusted(event);return xtream.cachedRatings();});
 ipcMain.handle('xtream-save',async(event,input)=>{trusted(event);const result=await xtream.save(input);streams.clear();return result;});
 ipcMain.handle('xtream-catalogue',(event,refresh)=>{trusted(event);return xtream.catalogue(refresh===true);});
 ipcMain.handle('xtream-episodes',(event,id,sourceId)=>{trusted(event);return xtream.episodes(id,sourceId);});
 ipcMain.handle('xtream-details',(event,id,type,sourceId)=>{trusted(event);return xtream.details(id,type,sourceId);});
 ipcMain.handle('xtream-season',(event,tmdbId,season)=>{trusted(event);return xtream.season(tmdbId,season);});
 ipcMain.handle('xtream-tmdb-search',(event,query)=>{trusted(event);return xtream.tmdbSearch(query);});
 ipcMain.handle('xtream-short-epg',(event,id,sourceId)=>{trusted(event);return xtream.shortEpg(id,sourceId);});
 ipcMain.handle('xtream-remove',(event,id)=>{trusted(event);streams.clear();return xtream.remove(id);});
 ipcMain.handle('xtream-restore',event=>{trusted(event);streams.clear();return xtream.restore();});
 ipcMain.handle('metadata-status',event=>{trusted(event);return xtream.metadataStatus();});
 ipcMain.handle('metadata-save',(event,token)=>{trusted(event);return xtream.metadataSave(token);});
 ipcMain.handle('xtream-playback',async(event,item)=>{trusted(event);const url=await xtream.playback(item);streams.clear();return item.mediaType==='live'&&/\.m3u8$/i.test(url)?streams.start(url):url;});
 ipcMain.handle('pick-videos',async event=>{trusted(event);const result=await dialog.showOpenDialog(window,{properties:['openFile','multiSelections'],filters:[{name:'Vídeos',extensions:['mp4','webm','mkv','mov','m4v']}]});return result.filePaths.map(file=>{const id=randomUUID();files.set(id,file);return {id,title:path.basename(file,path.extname(file)),url:`richiflix://${id}/video`,kind:'local',description:'Archivo de tu biblioteca personal',genre:'Mi biblioteca'};});});
 ipcMain.handle('pick-playlist',async event=>{trusted(event);const result=await dialog.showOpenDialog(window,{properties:['openFile'],filters:[{name:'Lista IPTV',extensions:['m3u','m3u8']}]});if(result.canceled)return null;const stat=await fs.stat(result.filePaths[0]);if(stat.size>5*1024*1024)throw new Error('La lista supera los 5 MB');return fs.readFile(result.filePaths[0],'utf8');});
 ipcMain.handle('open-source',(event,id)=>{trusted(event);const url=providerDestinations[id];if(!url)throw Error('Fuente desconocida');return shell.openExternal(url);});
 ipcMain.handle('open-manual-source',(event,url)=>{trusted(event);if(typeof url!=='string')throw Error('URL no permitida');const target=new URL(url);if(!['https:','http:'].includes(target.protocol))throw Error('Usa HTTP o HTTPS');return shell.openExternal(target.href);});
 ipcMain.handle('get-fullscreen',event=>{trusted(event);return window.isFullScreen();});
 ipcMain.handle('set-fullscreen',(event,enabled)=>{
  trusted(event);if(typeof enabled!=='boolean')throw Error('Estado de pantalla completa inválido');
  if(window.isFullScreen()===enabled)return enabled;
  return new Promise(resolve=>{
   const changed=enabled?'enter-full-screen':'leave-full-screen';
   let timer;
   const finish=()=>setImmediate(()=>{clearTimeout(timer);window.removeListener(changed,finish);resolve(!window.isDestroyed()&&window.isFullScreen());});
   window.once(changed,finish);timer=setTimeout(finish,2000);window.setFullScreen(enabled);
  });
 });
 ipcMain.handle('fetch-playlist',async(event,url)=>{trusted(event);const target=new URL(url);if(!['https:','http:'].includes(target.protocol))throw Error('URL no permitida');const response=await net.fetch(target.href,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(`HTTP ${response.status}`);const reader=response.body.getReader();const chunks=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8*1024*1024)throw Error('Lista demasiado grande');chunks.push(Buffer.from(value));}return Buffer.concat(chunks).toString('utf8');}finally{await reader.cancel();}});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
