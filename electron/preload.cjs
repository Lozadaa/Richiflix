const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('richiflix',{
 xtreamStatus:()=>ipcRenderer.invoke('xtream-status'),
 xtreamRecommendations:()=>ipcRenderer.invoke('xtream-recommendations'),
 xtreamCachedRatings:()=>ipcRenderer.invoke('xtream-cached-ratings'),
 xtreamSave:input=>ipcRenderer.invoke('xtream-save',input),
 xtreamRemove:id=>ipcRenderer.invoke('xtream-remove',id),
 xtreamRestore:()=>ipcRenderer.invoke('xtream-restore'),
 xtreamCatalogue:refresh=>ipcRenderer.invoke('xtream-catalogue',refresh),
 xtreamEpisodes:(id,sourceId)=>ipcRenderer.invoke('xtream-episodes',id,sourceId),
 xtreamDetails:(id,type,sourceId)=>ipcRenderer.invoke('xtream-details',id,type,sourceId),
 xtreamSeason:(tmdbId,season)=>ipcRenderer.invoke('xtream-season',tmdbId,season),
 xtreamShortEpg:(id,sourceId)=>ipcRenderer.invoke('xtream-short-epg',id,sourceId),
 metadataStatus:()=>ipcRenderer.invoke('metadata-status'),
 metadataSave:token=>ipcRenderer.invoke('metadata-save',token),
 xtreamPlayback:item=>ipcRenderer.invoke('xtream-playback',item),
 pickVideos:()=>ipcRenderer.invoke('pick-videos'),
 pickPlaylist:()=>ipcRenderer.invoke('pick-playlist'),
 openSource:id=>ipcRenderer.invoke('open-source',id),
 openManualSource:url=>ipcRenderer.invoke('open-manual-source',url),
 fetchPlaylist:url=>ipcRenderer.invoke('fetch-playlist',url),
 getFullscreen:()=>ipcRenderer.invoke('get-fullscreen'),
 setFullscreen:enabled=>ipcRenderer.invoke('set-fullscreen',enabled),
 onFullscreenChange:callback=>{
  if(typeof callback!=='function')throw Error('Callback inválido');
  const listener=(_event,enabled)=>callback(enabled);
  ipcRenderer.on('fullscreen-change',listener);
  return()=>ipcRenderer.removeListener('fullscreen-change',listener);
 }
});
